'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ControlAceitesPage() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'flota'>('agenda')

  // Estados Agenda
  const [vehiculosAgenda, setVehiculosAgenda] = useState<any[]>([])

  // Estados Flota & Registro
  const [empresas, setEmpresas] = useState<any[]>([])
  const [vehiculosFlota, setVehiculosFlota] = useState<any[]>([])
  const [vehIdActivo, setVehIdActivo] = useState<string>('')
  const [vehInfo, setVehInfo] = useState<any>(null)

  // Formulario Nuevo Vehículo
  const [placaV, setPlacaV] = useState('')
  const [empresaSelV, setEmpresaSelV] = useState('')
  const [modeloV, setModeloV] = useState('')
  const [kmV, setKmV] = useState<number>(50000)
  const [intervaloV, setIntervaloV] = useState<number>(3)
  const [fechaUltV, setFechaUltV] = useState(new Date().toISOString().split('T')[0])

  // Sub-tabs de vehículo seleccionado
  const [subTab, setSubTab] = useState<'receta' | 'despacho'>('receta')
  const [recetasVehiculo, setRecetasVehiculo] = useState<any[]>([])

  // Formulario Insumo Receta
  const [itemDesc, setItemDesc] = useState('')
  const [cantItem, setCantItem] = useState<number>(1)
  const [costoCompra, setCostoCompra] = useState<number>(0)
  const [precioVenta, setPrecioVenta] = useState<number>(0)

  // Despacho
  const [mecanicos, setMecanicos] = useState<any[]>([])
  const [mecSel, setMecSel] = useState('')
  const [valorMo, setValorMo] = useState<number>(30000)
  const [nuevoKm, setNuevoKm] = useState<number>(0)

  const USER_ID = 1 // Se adaptará al Auth definitivo

  useEffect(() => {
    cargarDatosGenerales()
  }, [])

  const cargarDatosGenerales = async () => {
    // 1. Cargar Agenda
    const { data: agenda } = await supabase
      .from('Vehiculos_Flota')
      .select(`
        id, placa, modelo_vehiculo, fecha_ultimo_servicio, fecha_proximo_servicio, kilometraje_actual,
        Empresas_Clientes (razon_social)
      `)
      .order('fecha_proximo_servicio', { ascending: true })

    if (agenda) setVehiculosAgenda(agenda)

    // 2. Cargar Empresas para el selector de registro
    const { data: emp } = await supabase.from('Empresas_Clientes').select('id, razon_social')
    if (emp) setEmpresas(emp)

    // 3. Cargar Lista de Vehículos de Flota
    const { data: flt } = await supabase
      .from('Vehiculos_Flota')
      .select(`
        id, placa, modelo_vehiculo,
        Empresas_Clientes (razon_social)
      `)
      .order('placa', { ascending: true })

    if (flt) {
      setVehiculosFlota(flt)
      if (flt.length > 0 && !vehIdActivo) {
        setVehIdActivo(flt[0].id.toString())
      }
    }

    // 4. Cargar Mecánicos activos
    const { data: mec } = await supabase.from('Mecanicos').select('id, nombre').eq('estado', 'Activo')
    if (mec) setMecanicos(mec)
  }

  // Cargar info y receta del vehículo seleccionado
  useEffect(() => {
    async function cargarDetalleVehiculo() {
      if (!vehIdActivo) {
        setVehInfo(null)
        setRecetasVehiculo([])
        return
      }

      const { data: info } = await supabase
        .from('Vehiculos_Flota')
        .select('*')
        .eq('id', vehIdActivo)
        .single()

      if (info) {
        setVehInfo(info)
        setNuevoKm(Number(info.kilometraje_actual || 0) + 5000)
      }

      // Cargar Recetas (Insumos) ligados al vehículo
      const { data: rec } = await supabase
        .from('Recetas_Vehiculo')
        .select(`
          id, cantidad,
          Inventario (id, nombre_producto, precio_venta, costo_compra)
        `)
        .eq('vehiculo_id', vehIdActivo)

      if (rec) setRecetasVehiculo(rec)
    }
    cargarDetalleVehiculo()
  }, [vehIdActivo])

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  // Registrar Nuevo Vehículo de Flota
  const registrarVehiculoFlota = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!placaV || !empresaSelV) return alert('La placa y la empresa son obligatorias.')

    const fUlt = new Date(fechaUltV)
    const proximaFecha = new Date(fUlt)
    proximaFecha.setDate(proximaFecha.getDate() + (intervaloV * 30))

    const { error } = await supabase.from('Vehiculos_Flota').insert([{
      empresa_id: parseInt(empresaSelV),
      placa: placaV.toUpperCase(),
      modelo_vehiculo: modeloV,
      fecha_ultimo_servicio: fechaUltV,
      fecha_proximo_servicio: proximaFecha.toISOString().split('T')[0],
      kilometraje_actual: kmV,
      intervalo_meses: intervaloV
    }])

    if (error) {
      alert('Error al registrar vehículo: ' + error.message)
    } else {
      alert('¡Vehículo registrado con éxito!')
      setPlacaV('')
      setModeloV('')
      cargarDatosGenerales()
    }
  }

  // Agregar insumo a la receta del vehículo y al inventario general
  const agregarInsumoReceta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemDesc) return alert('Ingresa el nombre del insumo.')

    try {
      // 1. Crear producto en Inventario con stock 0
      const { data: invData, error: errInv } = await supabase
        .from('Inventario')
        .insert([{
          nombre_producto: itemDesc,
          costo_compra: costoCompra,
          precio_venta: precioVenta,
          stock_actual: 0
        }])
        .select()
        .single()

      if (errInv) throw errInv

      // 2. Ligar a la Receta del Vehículo
      const { error: errRec } = await supabase
        .from('Recetas_Vehiculo')
        .insert([{
          vehiculo_id: parseInt(vehIdActivo),
          inventario_id: invData.id,
          cantidad: cantItem
        }])

      if (errRec) throw errRec

      alert('¡Insumo agregado a la lista y al almacén!')
      setItemDesc('')
      setCostoCompra(0)
      setPrecioVenta(0)
      setCantItem(1)
      cargarDatosGenerales()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const eliminarItemReceta = async (recId: number) => {
    const { error } = await supabase.from('Recetas_Vehiculo').delete().eq('id', recId)
    if (error) alert('Error al eliminar: ' + error.message)
    else cargarDatosGenerales()
  }

  // Generar Orden de Trabajo (Despacho)
  const ejecutarDespacho = async () => {
    if (!mecSel) return alert('Selecciona un técnico a cargo.')
    if (recetasVehiculo.length === 0) return alert('Configura los insumos de este vehículo primero.')

    try {
      // 1. Crear la Hoja de Trabajo
      const { data: hoja, error: errHoja } = await supabase
        .from('Hojas_Trabajo')
        .insert([{
          placa: vehInfo.placa,
          empresa_id: vehInfo.empresa_id,
          estado: 'Facturado'
        }])
        .select()
        .single()

      if (errHoja) throw errHoja

      // 2. Registrar Detalles (Repuestos) y descontar stock
      for (const r of recetasVehiculo) {
        const inv = r.Inventario
        const pvpItem = (Number(inv.precio_venta) || 0) * Number(r.cantidad)

        await supabase.from('Detalles_Orden').insert([{
          hoja_id: hoja.id,
          tipo_item: 'Repuesto',
          descripcion: `${inv.nombre_producto} (x${r.cantidad})`,
          precio_venta: pvpItem
        }])

        // Descontar inventario
        // Nota: para obtener stock actual podríamos consultar o restar directamente
        const { data: prodActual } = await supabase.from('Inventario').select('stock_actual').eq('id', inv.id).single()
        if (prodActual) {
          await supabase.from('Inventario')
            .update({ stock_actual: Math.max(0, prodActual.stock_actual - r.cantidad) })
            .eq('id', inv.id)
        }
      }

      // 3. Registrar Mano de Obra (Sincroniza con Nómina)
      await supabase.from('Detalles_Orden').insert([{
        hoja_id: hoja.id,
        tipo_item: 'Mano de Obra',
        descripcion: 'Servicio Cambio de Aceite',
        mecanico_id: parseInt(mecSel),
        precio_venta: valorMo
      }])

      // 4. Actualizar fechas y kilometraje en Vehiculos_Flota
      const hoy = new Date()
      const proximaFecha = new Date(hoy)
      proximaFecha.setDate(proximaFecha.getDate() + ((vehInfo.intervalo_meses || 3) * 30))

      await supabase
        .from('Vehiculos_Flota')
        .update({
          fecha_ultimo_servicio: hoy.toISOString().split('T')[0],
          fecha_proximo_servicio: proximaFecha.toISOString().split('T')[0],
          kilometraje_actual: nuevoKm
        })
        .eq('id', vehInfo.id)

      alert(`¡Orden #${hoja.id} creada con éxito! Stock descontado y mano de obra sumada al técnico.`)
      cargarDatosGenerales()
    } catch (err: any) {
      alert('Error en el despacho: ' + err.message)
    }
  }

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Control de Cambios de Aceite y Flotas</h1>
        <p className="text-gray-600 mt-1">Mantenimiento preventivo e insumos</p>
      </div>

      {/* PESTAÑAS PRINCIPALES */}
      <div className="flex bg-white rounded-t-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        <button 
          onClick={() => setActiveTab('agenda')} 
          className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'agenda' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Agenda y Próximos Servicios
        </button>
        <button 
          onClick={() => setActiveTab('flota')} 
          className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'flota' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Gestión de Vehículos y Filtros
        </button>
      </div>

      {/* TAB 1: AGENDA */}
      {activeTab === 'agenda' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Vehículos con Mantenimiento Próximo o Vencido</h2>
          {vehiculosAgenda.length === 0 ? (
            <p className="text-gray-500 italic">No hay vehículos registrados en el sistema de flotas todavía.</p>
          ) : (
            vehiculosAgenda.map(v => {
              const hoy = new Date()
              const fechaProx = v.fecha_proximo_servicio ? new Date(v.fecha_proximo_servicio) : new Date()
              const diffTime = fechaProx.getTime() - hoy.getTime()
              const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

              return (
                <div key={v.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Placa: {v.placa}</h4>
                    <p className="text-xs text-gray-500">Cliente: {(v.Empresas_Clientes as any)?.razon_social || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Vehículo: {v.modelo_vehiculo || 'No especificado'}</p>
                    <p className="text-xs text-gray-500">Km Actual: {Number(v.kilometraje_actual || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Último Serv: {v.fecha_ultimo_servicio || 'N/A'}</p>
                    <p className="text-xs text-gray-500 font-medium">Próximo Serv: {v.fecha_proximo_servicio || 'N/A'}</p>
                  </div>
                  <div>
                    {diasRestantes < 0 ? (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold block text-center">Vencido hace {Math.abs(diasRestantes)} días</span>
                    ) : diasRestantes <= 10 ? (
                      <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold block text-center">Programado en {diasRestantes} días</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold block text-center">Al día (en {diasRestantes} días)</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* TAB 2: GESTIÓN Y FILTROS */}
      {activeTab === 'flota' && (
        <div className="space-y-6">
          {/* REGISTRAR VEHÍCULO */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Registrar Nuevo Vehículo a una Empresa</h3>
            <form onSubmit={registrarVehiculoFlota} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehículo</label>
                  <input type="text" value={placaV} onChange={e => setPlacaV(e.target.value.toUpperCase())} className="w-full border p-2.5 rounded-lg uppercase bg-white" placeholder="Ej: XYZ123" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa / Propietario</label>
                  <select value={empresaSelV} onChange={e => setEmpresaSelV(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
                    <option value="">-- Seleccionar Empresa --</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo / Marca</label>
                  <input type="text" value={modeloV} onChange={e => setModeloV(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: Chevrolet NPR" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kilometraje Actual</label>
                  <input type="number" value={kmV} onChange={e => setKmV(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-white" step="1000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo de Recordatorio (Meses)</label>
                  <input type="number" value={intervaloV} onChange={e => setIntervaloV(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-white" min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Último Servicio</label>
                  <input type="date" value={fechaUltV} onChange={e => setFechaUltV(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white text-sm" />
                </div>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
                Guardar Vehículo
              </button>
            </form>
          </div>

          {/* SELECCIÓN DE VEHÍCULO PARA CONFIGURAR O DESPACHAR */}
          {vehiculosFlota.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona un vehículo para configurar o despachar:</label>
                <select value={vehIdActivo} onChange={e => setVehIdActivo(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
                  {vehiculosFlota.map(v => (
                    <option key={v.id} value={v.id}>{v.placa} - {v.modelo_vehiculo} ({(v.Empresas_Clientes as any)?.razon_social})</option>
                  ))}
                </select>
              </div>

              {vehInfo && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-900 font-medium">
                  Placa: {vehInfo.placa} | Último servicio: {vehInfo.fecha_ultimo_servicio || 'Pendiente'} | Próximo: {vehInfo.fecha_proximo_servicio}
                </div>
              )}

              {/* SUB-TABS */}
              <div className="flex border-b">
                <button onClick={() => setSubTab('receta')} className={`py-2 px-4 font-semibold text-sm border-b-2 ${subTab === 'receta' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                  Configurar Filtros e Insumos (Lista)
                </button>
                <button onClick={() => setSubTab('despacho')} className={`py-2 px-4 font-semibold text-sm border-b-2 ${subTab === 'despacho' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                  Generar Orden de Trabajo (Despachar)
                </button>
              </div>

              {/* SUB-TAB 1: RECETAS */}
              {subTab === 'receta' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Agrega los insumos uno por uno (ej: Filtro de aceite, cuartos de aceite).</p>
                  
                  {recetasVehiculo.length === 0 ? (
                    <p className="text-gray-400 italic text-sm">No hay insumos configurados para este vehículo.</p>
                  ) : (
                    <div className="space-y-2">
                      {recetasVehiculo.map(r => (
                        <div key={r.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border text-sm">
                          <span>{r.Inventario?.nombre_producto} (Cant: {r.cantidad}) - {formatoCOP(r.Inventario?.precio_venta || 0)} c/u</span>
                          <button onClick={() => eliminarItemReceta(r.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Eliminar</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={agregarInsumoReceta} className="border-t pt-4 space-y-3">
                    <h5 className="font-semibold text-gray-800 text-sm">Agregar Insumo a la Lista</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input type="text" value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Nombre del filtro o aceite" className="border p-2 rounded bg-white text-sm md:col-span-2" />
                      <input type="number" value={cantItem} onChange={e => setCantItem(Number(e.target.value))} placeholder="Cantidad" min="1" className="border p-2 rounded bg-white text-sm" />
                      <input type="number" value={precioVenta || ''} onChange={e => setPrecioVenta(Number(e.target.value))} placeholder="Precio Venta ($)" step="1000" className="border p-2 rounded bg-white text-sm" />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-semibold hover:bg-blue-700">
                      Guardar en Lista y Almacén
                    </button>
                  </form>
                </div>
              )}

              {/* SUB-TAB 2: DESPACHO */}
              {subTab === 'despacho' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Genera la orden de trabajo. El sistema cobrará los insumos, descontará el stock y sumará la mano de obra a la nómina del técnico.</p>
                  
                  {recetasVehiculo.length === 0 ? (
                    <p className="text-orange-600 bg-orange-50 p-3 rounded border border-orange-200 text-sm">Configura los insumos de este vehículo en la pestaña anterior para poder despachar.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
                        <h5 className="font-semibold text-gray-800 text-sm">Insumos a Despachar:</h5>
                        {recetasVehiculo.map(r => (
                          <div key={r.id} className="flex justify-between text-xs text-gray-600">
                            <span>- {r.Inventario?.nombre_producto} (x{r.cantidad})</span>
                            <span className="font-semibold">{formatoCOP((r.Inventario?.precio_venta || 0) * r.cantidad)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Técnico a cargo</label>
                          <select value={mecSel} onChange={e => setMecSel(e.target.value)} className="w-full border p-2 rounded bg-white text-sm">
                            <option value="">-- Seleccionar Técnico --</option>
                            {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Valor Mano de Obra ($)</label>
                          <input type="number" value={valorMo} onChange={e => setValorMo(Number(e.target.value))} step="5000" className="w-full border p-2 rounded bg-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Kilometraje de Ingreso</label>
                          <input type="number" value={nuevoKm} onChange={e => setNuevoKm(Number(e.target.value))} step="500" className="w-full border p-2 rounded bg-white text-sm" />
                        </div>
                      </div>

                      <button onClick={ejecutarDespacho} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-sm">
                        Ejecutar y Crear Orden
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}