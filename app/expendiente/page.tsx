'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ExpedientePage() {
  const [empresas, setEmpresas] = useState<any[]>([])
  const [mecanicos, setMecanicos] = useState<any[]>([])
  
  // Filtros de búsqueda
  const [filtroEstado, setFiltroEstado] = useState('-- Todos los estados --')
  const [filtroPlaca, setFiltroPlaca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('-- Todas las empresas --')
  const [ordenesLista, setOrdenesLista] = useState<any[]>([])

  // Búsqueda de Expediente Específico
  const [busquedaInput, setBusquedaInput] = useState('')
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null)
  const [detallesOrden, setDetallesOrden] = useState<any[]>([])
  const [nuevoEstado, setNuevoEstado] = useState('')

  // Formulario nuevo ítem dentro del expediente
  const [tipoItemNuevo, setTipoItemNuevo] = useState<'Mano de Obra' | 'Repuesto'>('Mano de Obra')
  const [descNuevo, setDescNuevo] = useState('')
  const [mecNuevo, setMecNuevo] = useState('')
  const [ventaNuevo, setVentaNuevo] = useState<number>(0)
  const [costoNuevo, setCostoNuevo] = useState<number>(0)

  const USER_ID = 1 // Se adaptará al Auth definitivo

  useEffect(() => {
    async function cargarCatalogosIniciales() {
      const { data: emp } = await supabase.from('Empresas_Clientes').select('id, razon_social').order('razon_social', { ascending: true })
      const { data: mec } = await supabase.from('Mecanicos').select('id, nombre')
      if (emp) setEmpresas(emp)
      if (mec) setMecanicos(mec)
    }
    cargarCatalogosIniciales()
    buscarOrdenesFiltros()
  }, [])

  // Buscar órdenes aplicando filtros
  const buscarOrdenesFiltros = async () => {
    let query = supabase
      .from('Hojas_Trabajo')
      .select(`
        id,
        fecha_ingreso,
        placa,
        estado,
        Empresas_Clientes (razon_social),
        Detalles_Orden (precio_venta)
      `)
      .order('id', { ascending: false })

    if (filtroEstado !== '-- Todos los estados --') {
      query = query.eq('estado', filtroEstado)
    }
    if (filtroPlaca.trim() !== '') {
      query = query.ilike('placa', `%${filtroPlaca.trim()}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error(error)
      return
    }

    if (data) {
      // Filtrar por empresa si está seleccionada
      let filtrados = data
      if (filtroEmpresa !== '-- Todas las empresas --') {
        filtrados = data.filter((o: any) => o.Empresas_Clientes?.razon_social === filtroEmpresa)
      }

      // Calcular totales por orden
      const resultadoFormateado = filtrados.map((o: any) => {
        const total = o.Detalles_Orden?.reduce((acc: number, curr: any) => acc + (Number(curr.precio_venta) || 0), 0) || 0
        return {
          id: o.id,
          fecha: o.fecha_ingreso ? o.fecha_ingreso.split('T')[0] : '',
          placa: o.placa,
          empresa: o.Empresas_Clientes?.razon_social || 'N/A',
          total: total,
          estado: o.estado
        }
      })
      setOrdenesLista(resultadoFormateado)
    }
  }

  useEffect(() => {
    buscarOrdenesFiltros()
  }, [filtroEstado, filtroPlaca, filtroEmpresa])

  // Abrir Expediente Específico
  const consultarExpediente = async (idBuscado: number) => {
    const { data: hoja, error } = await supabase
      .from('Hojas_Trabajo')
      .select(`
        id, placa, estado, fecha_ingreso,
        Empresas_Clientes (razon_social, nit)
      `)
      .eq('id', idBuscado)
      .single()

    if (error || !hoja) {
      alert(`No se encontró ninguna orden con el número #${idBuscado}.`)
      setOrdenSeleccionada(null)
      return
    }

    setOrdenSeleccionada({
      id: hoja.id,
      placa: hoja.placa,
      estado: hoja.estado,
      fecha: hoja.fecha_ingreso ? hoja.fecha_ingreso.split('T')[0] : '',
      cliente: (hoja.Empresas_Clientes as any)?.razon_social || 'N/A',
      nit: (hoja.Empresas_Clientes as any)?.nit || 'N/A'
    })
    setNuevoEstado(hoja.estado)

    // Cargar detalles
    const { data: detalles } = await supabase
      .from('Detalles_Orden')
      .select(`
        id, tipo_item, descripcion, costo_compra, precio_venta,
        Mecanicos (nombre)
      `)
      .eq('hoja_id', idBuscado)

    if (detalles) {
      setDetallesOrden(detalles)
    }
  }

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  const actualizarEstadoOrden = async () => {
    if (!ordenSeleccionada) return
    const { error } = await supabase
      .from('Hojas_Trabajo')
      .update({ estado: nuevoEstado })
      .eq('id', ordenSeleccionada.id)

    if (error) {
      alert('Error al actualizar estado: ' + error.message)
    } else {
      alert('¡Estado actualizado con éxito!')
      consultarExpediente(ordenSeleccionada.id)
    }
  }

  const eliminarDetalle = async (detId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este ítem?')) return
    const { error } = await supabase.from('Detalles_Orden').delete().eq('id', detId)
    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      consultarExpediente(ordenSeleccionada.id)
    }
  }

  const agregarItemExpediente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descNuevo || ventaNuevo <= 0) return alert('Completa la descripción y un precio válido.')

    const payload: any = {
      hoja_id: ordenSeleccionada.id,
      tipo_item: tipoItemNuevo,
      descripcion: descNuevo,
      precio_venta: ventaNuevo,
      costo_compra: costoNuevo
    }

    if (tipoItemNuevo === 'Mano de Obra' && mecNuevo) {
      payload.mecanico_id = parseInt(mecNuevo)
    }

    const { error } = await supabase.from('Detalles_Orden').insert([payload])
    if (error) {
      alert('Error al agregar ítem: ' + error.message)
    } else {
      alert('¡Ítem agregado con éxito!')
      setDescNuevo('')
      setVentaNuevo(0)
      setCostoNuevo(0)
      consultarExpediente(ordenSeleccionada.id)
    }
  }

  const granTotal = detallesOrden.reduce((acc, curr) => acc + (Number(curr.precio_venta) || 0), 0)

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Expediente de Orden y Facturación</h1>
        <p className="text-gray-600 mt-1">Gestión de órdenes, auditoría y consulta general para tu taller</p>
      </div>

      {/* FILTROS DE BÚSQUEDA */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">Filtros de Búsqueda Avanzada</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado del Trabajo</label>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
              <option value="-- Todos los estados --">-- Todos los estados --</option>
              <option value="Cotizar">Cotizar</option>
              <option value="En revision">En revisión</option>
              <option value="Esperando repuestos">Esperando repuestos</option>
              <option value="En reparacion">En reparación</option>
              <option value="Listo para facturar">Listo para facturar</option>
              <option value="Facturado">Facturado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehículo</label>
            <input type="text" placeholder="Ej: ABC123" value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value.toUpperCase())} className="w-full border p-2.5 rounded-lg uppercase bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa / Cliente</label>
            <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
              <option value="-- Todas las empresas --">-- Todas las empresas --</option>
              {empresas.map(e => <option key={e.id} value={e.razon_social}>{e.razon_social}</option>)}
            </select>
          </div>
        </div>

        {/* TABLA DE RESULTADOS */}
        <div className="mt-6 overflow-x-auto">
          {ordenesLista.length === 0 ? (
            <p className="text-gray-500 italic text-center py-4">No se encontraron órdenes con estos filtros.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b text-sm text-gray-700">
                  <th className="p-3">N° Orden</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Placa</th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesLista.map(o => (
                  <tr key={o.id} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-bold">#{o.id}</td>
                    <td className="p-3 text-gray-600">{o.fecha}</td>
                    <td className="p-3 font-semibold text-blue-600">{o.placa}</td>
                    <td className="p-3">{o.empresa}</td>
                    <td className="p-3 font-bold text-gray-900">{formatoCOP(o.total)}</td>
                    <td className="p-3"><span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{o.estado}</span></td>
                    <td className="p-3 text-center">
                      <button onClick={() => consultarExpediente(o.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition">
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ABRIR EXPEDIENTE ESPECÍFICO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
        <h3 className="font-bold text-gray-800 text-lg mb-3">Abrir Expediente Específico por Número</h3>
        <div className="flex gap-4">
          <input type="number" placeholder="Número de Orden (Ej: 12)" value={busquedaInput} onChange={(e) => setBusquedaInput(e.target.value)} className="border p-2.5 rounded-lg w-64 bg-white" />
          <button onClick={() => { if(busquedaInput) consultarExpediente(Number(busquedaInput)) }} className="bg-gray-800 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-900 transition">
            Buscar Orden
          </button>
        </div>
      </div>

      {/* VISTA DETALLADA DE LA ORDEN SELECCIONADA */}
      {ordenSeleccionada && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-200 space-y-6">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Expediente de Orden #{ordenSeleccionada.id} | Placa: {ordenSeleccionada.placa}</h2>
              <p className="text-sm text-gray-500">Cliente: <span className="font-semibold text-gray-800">{ordenSeleccionada.cliente}</span> (NIT: {ordenSeleccionada.nit})</p>
            </div>
            <button onClick={() => setOrdenSeleccionada(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕ Cerrar</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs text-gray-500 block">Fecha de Ingreso</span>
              <span className="font-semibold text-gray-800">{ordenSeleccionada.fecha}</span>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs text-gray-500 block">Estado Operativo</span>
              <div className="flex gap-2 mt-1">
                <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} className="border p-1.5 rounded text-sm bg-white flex-1">
                  <option value="Cotizar">Cotizar</option>
                  <option value="En revision">En revisión</option>
                  <option value="Esperando repuestos">Esperando repuestos</option>
                  <option value="En reparacion">En reparación</option>
                  <option value="Listo para facturar">Listo para facturar</option>
                  <option value="Facturado">Facturado</option>
                </select>
                <button onClick={actualizarEstadoOrden} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-700">Guardar</button>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <span className="text-xs text-green-700 block font-medium">Gran Total Orden</span>
              <span className="text-xl font-bold text-green-800">{formatoCOP(granTotal)}</span>
            </div>
          </div>

          {/* LISTA DE ÍTEMS */}
          <div>
            <h4 className="font-bold text-gray-800 mb-3">Detalles de Trabajos y Repuestos</h4>
            {detallesOrden.length === 0 ? (
              <p className="text-gray-500 italic">No hay ítems registrados en esta orden.</p>
            ) : (
              <div className="space-y-2">
                {detallesOrden.map(d => (
                  <div key={d.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border text-sm">
                    <div>
                      <p className="font-semibold text-gray-800">[{d.tipo_item}] {d.descripcion}</p>
                      {d.Mecanicos?.nombre && <span className="text-xs text-gray-500">Técnico: {d.Mecanicos.nombre}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-gray-900">{formatoCOP(d.precio_venta)}</span>
                      <button onClick={() => eliminarDetalle(d.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AGREGAR NUEVO ÍTEM AL EXPEDIENTE */}
          <div className="border-t pt-4">
            <h4 className="font-bold text-gray-800 mb-3">Agregar Nuevo Ítem a esta Orden</h4>
            <form onSubmit={agregarItemExpediente} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select value={tipoItemNuevo} onChange={(e: any) => setTipoItemNuevo(e.target.value)} className="w-full border p-2 rounded bg-white text-sm">
                  <option value="Mano de Obra">Mano de Obra</option>
                  <option value="Repuesto">Repuesto</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                <input type="text" value={descNuevo} onChange={(e) => setDescNuevo(e.target.value)} placeholder="Descripción del trabajo o repuesto" className="w-full border p-2 rounded bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cobro Cliente ($)</label>
                <input type="number" value={ventaNuevo || ''} onChange={(e) => setVentaNuevo(Number(e.target.value))} placeholder="0" className="w-full border p-2 rounded bg-white text-sm" />
              </div>
              <div>
                <button type="submit" className="w-full bg-green-600 text-white p-2 rounded text-sm font-semibold hover:bg-green-700 transition">
                  + Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}