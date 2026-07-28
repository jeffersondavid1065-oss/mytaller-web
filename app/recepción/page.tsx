'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function RecepcionVehiculosPage() {
  // ================= ESTADOS GENERALES =================
  const [placa, setPlaca] = useState('')
  const [empresaSel, setEmpresaSel] = useState('')
  const [estado, setEstado] = useState('En revision')
  const [carrito, setCarrito] = useState<any[]>([])
  
  // Catálogos desde Supabase
  const [empresas, setEmpresas] = useState<any[]>([])
  const [mecanicos, setMecanicos] = useState<any[]>([])
  const [inventario, setInventario] = useState<any[]>([])

  // Control de Pestañas
  const [activeTab, setActiveTab] = useState<'mano_obra' | 'repuestos'>('mano_obra')

  // Estados Formulario Mano de Obra
  const [descMo, setDescMo] = useState('')
  const [mecanicoMo, setMecanicoMo] = useState('')
  const [ventaMo, setVentaMo] = useState<number>(0)
  const [retencionPct, setRetencionPct] = useState<number>(0)

  // Estados Formulario Repuestos
  const [origenRep, setOrigenRep] = useState<'externo' | 'interno'>('externo')
  
  // Repuestos Externos
  const [descRepExt, setDescRepExt] = useState('')
  const [costoRepExt, setCostoRepExt] = useState<number>(0)
  const [ventaRepExt, setVentaRepExt] = useState<number>(0)
  
  // Repuestos Internos
  const [prodSel, setProdSel] = useState('')
  const [cantUsar, setCantUsar] = useState<number>(1)

  // Asumimos un ID de usuario fijo por ahora (hasta que conectemos el Auth real)
  const USER_ID = 1 

  // ================= EFECTO: CARGAR DATOS (SÚPER RÁPIDO) =================
  useEffect(() => {
    async function cargarCatalogos() {
      // Cargamos empresas y mecánicos
      const { data: emp } = await supabase.from('Empresas_Clientes').select('id, razon_social') // Añade .eq('usuario_id', USER_ID) cuando actives Auth
      const { data: mec } = await supabase.from('Mecanicos').select('id, nombre')
      
      // Cargamos inventario con stock > 0
      const { data: inv } = await supabase
        .from('Inventario')
        .select('id, nombre_producto, stock_actual, costo_compra, precio_venta')
        .gt('stock_actual', 0)
        .order('nombre_producto', { ascending: true })

      if (emp) setEmpresas(emp)
      if (mec) setMecanicos(mec)
      if (inv) setInventario(inv)
    }
    cargarCatalogos()
  }, [])

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  // ================= LÓGICA DEL CARRITO =================
  const agregarManoObra = (e: React.FormEvent) => {
    e.preventDefault()
    if (!descMo || !mecanicoMo) return alert('Completa la descripción y selecciona un mecánico.')

    const valorDescontado = ventaMo * (retencionPct / 100)
    const netoMo = Math.max(0, ventaMo - valorDescontado)
    const mecanicoObj = mecanicos.find(m => m.id.toString() === mecanicoMo)

    const descFinal = retencionPct > 0 ? `${descMo} (Ret ${retencionPct}% aplicada a nómina)` : descMo

    setCarrito([...carrito, {
      Tipo: 'Mano de Obra',
      Descripción: descFinal,
      Mecánico: mecanicoObj?.nombre,
      Mecánico_ID: parseInt(mecanicoMo),
      Costo: valorDescontado,
      'PVP Cliente': ventaMo,
      Base_Nomina: netoMo,
      Inventario_ID: null,
      Cantidad_Descontar: 0
    }])

    setDescMo('')
    setVentaMo(0)
    setRetencionPct(0)
  }

  const agregarRepuesto = (e: React.FormEvent) => {
    e.preventDefault()
    if (origenRep === 'externo') {
      if (!descRepExt) return alert('Completa la descripción del repuesto.')
      setCarrito([...carrito, {
        Tipo: 'Repuesto',
        Descripción: descRepExt,
        Mecánico: '-',
        Mecánico_ID: null,
        Costo: costoRepExt,
        'PVP Cliente': ventaRepExt,
        Base_Nomina: null,
        Inventario_ID: null,
        Cantidad_Descontar: 0
      }])
      setDescRepExt('')
      setCostoRepExt(0)
      setVentaRepExt(0)
    } else {
      if (!prodSel) return alert('Selecciona un producto del almacén.')
      const prodData = inventario.find(p => p.id.toString() === prodSel)
      if (!prodData) return

      if (cantUsar > prodData.stock_actual) {
        return alert(`Solo tienes ${prodData.stock_actual} unidades en stock.`)
      }

      setCarrito([...carrito, {
        Tipo: 'Repuesto',
        Descripción: `${prodData.nombre_producto} (x${cantUsar})`,
        Mecánico: '-',
        Mecánico_ID: null,
        Costo: prodData.costo_compra * cantUsar,
        'PVP Cliente': prodData.precio_venta * cantUsar,
        Base_Nomina: null,
        Inventario_ID: prodData.id,
        Cantidad_Descontar: cantUsar
      }])
      setCantUsar(1)
    }
  }

  const quitarItem = (index: number) => {
    setCarrito(carrito.filter((_, i) => i !== index))
  }

  const totalCobro = carrito.reduce((acc, item) => acc + item['PVP Cliente'], 0)

  // ================= GUARDAR ORDEN EN SUPABASE =================
  const guardarOrdenCompleta = async () => {
    if (!placa) return alert("Falta ingresar la placa del vehículo.")
    if (!empresaSel) return alert("Por favor, selecciona una Empresa / Cliente válida.")
    if (carrito.length === 0) return alert("Aún no se han agregado trabajos ni repuestos.")

    try {
      // 1. Guardar la Hoja de Trabajo principal
      const { data: hoja, error: errHoja } = await supabase
        .from('Hojas_Trabajo')
        .insert([{
          // usuario_id: USER_ID, // Descomenta cuando actives Auth
          placa: placa,
          empresa_id: parseInt(empresaSel),
          estado: estado
        }])
        .select()
        .single()

      if (errHoja) throw errHoja

      // 2. Preparar los Detalles de la Orden
      const detallesAInsertar = carrito.map(item => ({
        hoja_id: hoja.id,
        tipo_item: item.Tipo,
        descripcion: item.Descripción,
        mecanico_id: item.Mecánico_ID,
        costo_compra: item.Costo,
        precio_venta: item['PVP Cliente']
      }))

      // Guardar todos los detalles de un solo golpe (Bulk Insert)
      const { error: errDetalles } = await supabase.from('Detalles_Orden').insert(detallesAInsertar)
      if (errDetalles) throw errDetalles

      // 3. Descontar Inventario (Si aplica)
      for (const item of carrito) {
        if (item.Inventario_ID) {
          const prodObj = inventario.find(p => p.id === item.Inventario_ID)
          if (prodObj) {
            const nuevoStock = prodObj.stock_actual - item.Cantidad_Descontar
            await supabase
              .from('Inventario')
              .update({ stock_actual: nuevoStock })
              .eq('id', item.Inventario_ID)
          }
        }
      }

      alert(`¡Orden #${hoja.id} guardada con éxito para el vehículo ${placa}!`)
      
      // Limpiar formulario
      setPlaca('')
      setCarrito([])
      // Idealmente aquí haríamos un refetch del inventario para actualizar los selects
      const { data: inv } = await supabase.from('Inventario').select('*').gt('stock_actual', 0)
      if (inv) setInventario(inv)

    } catch (error: any) {
      console.error(error)
      alert("Error al guardar: " + error.message)
    }
  }

  // ================= RENDERIZADO =================
  return (
    <main className="p-8 max-w-6xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Recepción y Asignación de Trabajos</h1>
        <p className="text-gray-600 mt-1">Registrando órdenes de servicio</p>
      </div>

      {/* 1. DATOS DEL VEHÍCULO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">1. Datos del Vehículo</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehículo</label>
            <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} className="w-full border p-2.5 rounded-lg uppercase bg-gray-50" placeholder="Ej: ABC123" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa / Cliente</label>
            <select value={empresaSel} onChange={(e) => setEmpresaSel(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50">
              <option value="">-- Seleccionar Empresa --</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado Operativo</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50">
              <option value="Cotizar">Cotizar</option>
              <option value="En revision">En revisión</option>
              <option value="Esperando repuestos">Esperando repuestos</option>
              <option value="En reparacion">En reparación</option>
              <option value="Listo para facturar">Listo para facturar</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. AGREGAR TRABAJOS Y REPUESTOS */}
      <div className="bg-white p-0 rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
        <div className="flex bg-gray-100 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('mano_obra')} 
            className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'mano_obra' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Mano de Obra
          </button>
          <button 
            onClick={() => setActiveTab('repuestos')} 
            className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'repuestos' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Repuestos
          </button>
        </div>

        <div className="p-6">
          {/* TABS - MANO DE OBRA */}
          {activeTab === 'mano_obra' && (
            <form onSubmit={agregarManoObra}>
              <h3 className="font-semibold text-gray-800 mb-4">Agregar Mano de Obra con Retención Fiscal (%)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div className="col-span-2">
                  <input type="text" placeholder="Descripción del trabajo realizado" value={descMo} onChange={e => setDescMo(e.target.value)} className="w-full border p-2.5 rounded-lg mb-2 bg-gray-50" />
                  <select value={mecanicoMo} onChange={e => setMecanicoMo(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50">
                    <option value="">-- Seleccionar Mecánico --</option>
                    {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cobro Bruto al Cliente</label>
                  <input type="number" value={ventaMo || ''} onChange={e => setVentaMo(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-gray-50" placeholder="$0 si pdte" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Retención (%)</label>
                  <input type="number" value={retencionPct || ''} onChange={e => setRetencionPct(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-gray-50" placeholder="Ej. 4" />
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600 bg-gray-100 p-3 rounded-lg border border-gray-200">
                Descuento estimado: <span className="font-semibold">{formatoCOP(ventaMo * (retencionPct/100))}</span> | Valor Neto para Nómina: <span className="font-bold text-gray-900">{formatoCOP(Math.max(0, ventaMo - (ventaMo * (retencionPct/100))))}</span>
              </div>
              <button type="submit" className="mt-4 w-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold py-2.5 rounded-lg hover:bg-blue-100 transition">
                + Agregar Trabajo
              </button>
            </form>
          )}

          {/* TABS - REPUESTOS */}
          {activeTab === 'repuestos' && (
            <form onSubmit={agregarRepuesto}>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="origen" checked={origenRep === 'externo'} onChange={() => setOrigenRep('externo')} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium">Comprado afuera (Encargo)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="origen" checked={origenRep === 'interno'} onChange={() => setOrigenRep('interno')} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium">Tomado del Almacén Propio</span>
                </label>
              </div>

              {origenRep === 'externo' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="text" placeholder="Nombre del Repuesto" value={descRepExt} onChange={e => setDescRepExt(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50" />
                  <div>
                    <input type="number" placeholder="Costo Compra" value={costoRepExt || ''} onChange={e => setCostoRepExt(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-gray-50" />
                    <span className="text-xs text-gray-500 mt-1 block">Costo: {formatoCOP(costoRepExt)}</span>
                  </div>
                  <div>
                    <input type="number" placeholder="Precio Venta" value={ventaRepExt || ''} onChange={e => setVentaRepExt(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-gray-50" />
                    <span className="text-xs text-gray-500 mt-1 block">Venta: {formatoCOP(ventaRepExt)}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="col-span-2">
                    <select value={prodSel} onChange={e => setProdSel(e.target.value)} className="w-full border p-2.5 rounded-lg bg-gray-50">
                      <option value="">-- Selecciona un producto del almacén --</option>
                      {inventario.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre_producto} (Stock: {p.stock_actual}) - PVP: {formatoCOP(p.precio_venta)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input type="number" placeholder="Cantidad" min="1" value={cantUsar} onChange={e => setCantUsar(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-gray-50" />
                  </div>
                </div>
              )}
              
              <button type="submit" className="mt-4 w-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold py-2.5 rounded-lg hover:bg-blue-100 transition">
                + Agregar Repuesto
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3. RESUMEN DE LA ORDEN */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">3. Resumen de la Orden</h2>
        {carrito.length === 0 ? (
          <p className="text-gray-500 italic text-center py-4">Aún no se han agregado trabajos ni repuestos.</p>
        ) : (
          <div className="space-y-3">
            {carrito.map((item, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{item.Tipo}: <span className="font-normal text-gray-700">{item.Descripción}</span></p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.Tipo === 'Mano de Obra' ? `Técnico: ${item.Mecánico}` : `Costo Interno: ${formatoCOP(item.Costo)}`}
                  </p>
                </div>
                <div className="flex-1 text-center">
                  {item['PVP Cliente'] === 0 ? (
                    <span className="font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded">Por Cotizar ($0)</span>
                  ) : (
                    <>
                      <p className="font-bold text-gray-800">Cobro al Cliente: {formatoCOP(item['PVP Cliente'])}</p>
                      {item.Base_Nomina && item.Base_Nomina < item['PVP Cliente'] && (
                        <p className="text-xs text-gray-500 mt-1">Base Nómina: {formatoCOP(item.Base_Nomina)}</p>
                      )}
                    </>
                  )}
                </div>
                <div className="w-24 text-right">
                  <button onClick={() => quitarItem(index)} className="text-red-500 hover:text-red-700 text-sm font-semibold hover:underline">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            
            <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg">
                <span className="text-green-800 font-semibold text-lg">Total a cobrar: {formatoCOP(totalCobro)}</span>
              </div>
              <button onClick={guardarOrdenCompleta} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-sm">
                Guardar Orden Completa
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}