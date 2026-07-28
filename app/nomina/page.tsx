'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function NominaPage() {
  const [mecanicos, setMecanicos] = useState<any[]>([])
  const [mecanicoSel, setMecanicoSel] = useState('')
  const [porcentajePago, setPorcentajePago] = useState<number>(50)
  
  // Rango de fechas por defecto (últimos 15 días)
  const hoy = new Date()
  const hace15Dias = new Date()
  hace15Dias.setDate(hoy.getDate() - 15)

  const [fechaInicio, setFechaInicio] = useState(hace15Dias.toISOString().split('T')[0])
  const [fechaFin, setFechaFin] = useState(hoy.toISOString().split('T')[0])

  // Datos para auditoría / corrección
  const [trabajosAuditoria, setTrabajosAuditoria] = useState<any[]>([])
  const [edicionesAuditoria, setEdicionesAuditoria] = useState<{ [key: string]: { desc: string; precio: number } }>({})

  // Resultados de Nómina
  const [nominaItems, setNominaItems] = useState<any[]>([])

  const USER_ID = 1 // Se adaptará al Auth definitivo

  useEffect(() => {
    async function cargarDatosIniciales() {
      // Cargar mecánicos activos
      const { data: mec } = await supabase
        .from('Mecanicos')
        .select('id, nombre')
        .eq('estado', 'Activo')

      if (mec) setMecanicos(mec)
    }
    cargarDatosIniciales()
    cargarAuditoria()
  }, [])

  // Cargar trabajos para el módulo de auditoría rápida
  const cargarAuditoria = async () => {
    const { data, error } = await supabase
      .from('Detalles_Orden')
      .select(`
        id, tipo_item, descripcion, precio_venta,
        Hojas_Trabajo!inner (id, placa, estado, fecha_ingreso, usuario_id, Empresas_Clientes (razon_social)),
        Mecanicos (nombre)
      `)
      .neq('Hojas_Trabajo.estado', 'Facturado')
      .order('id', { ascending: false })
      .limit(20)

    if (data) {
      const formateados = data.map((d: any) => ({
        detalle_id: d.id,
        orden_nro: d.Hojas_Trabajo?.id,
        placa: d.Hojas_Trabajo?.placa,
        empresa: d.Hojas_Trabajo?.Empresas_Clientes?.razon_social || 'N/A',
        mecanico: d.Mecanicos?.nombre || '-',
        tipo_item: d.tipo_item,
        descripcion: d.descripcion,
        precio_venta: d.precio_venta || 0
      }))
      setTrabajosAuditoria(formateados)

      // Inicializar estados editables
      const edits: any = {}
      formateados.forEach((f: any) => {
        edits[f.detalle_id] = { desc: f.descripcion, precio: f.precio_venta }
      })
      setEdicionesAuditoria(edits)
    }
  }

  // Cargar liquidación de nómina al seleccionar mecánico y fechas
  useEffect(() => {
    async function calcularNomina() {
      if (!mecanicoSel) {
        setNominaItems([])
        return
      }

      const fechaFinExt = new Date(fechaFin)
      fechaFinExt.setDate(fechaFinExt.getDate() + 1)
      const fechaFinStr = fechaFinExt.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('Detalles_Orden')
        .select(`
          id, descripcion, precio_venta, costo_compra,
          Hojas_Trabajo!inner (id, placa, fecha_ingreso, usuario_id, Empresas_Clientes (razon_social)),
          Mecanicos!inner (id, nombre)
        `)
        .eq('mecanico_id', mecanicoSel)
        .eq('tipo_item', 'Mano de Obra')
        .gte('Hojas_Trabajo.fecha_ingreso', fechaInicio)
        .lt('Hojas_Trabajo.fecha_ingreso', fechaFinStr)
        .order('id', { ascending: false })

      if (data) {
        const calculados = data.map((d: any) => {
          const cobroCliente = Number(d.precio_venta) || 0
          const retencion = Number(d.costo_compra) || 0
          const baseReal = Math.max(0, cobroCliente - retencion)
          const comision = (baseReal * (porcentajePago / 100))

          return {
            orden_id: d.Hojas_Trabajo?.id,
            placa: d.Hojas_Trabajo?.placa,
            empresa: d.Hojas_Trabajo?.Empresas_Clientes?.razon_social || 'N/A',
            fecha: d.Hojas_Trabajo?.fecha_ingreso ? d.Hojas_Trabajo.fecha_ingreso.split('T')[0] : '',
            descripcion_trabajo: d.descripcion,
            cobro_cliente: cobroCliente,
            retencion_aplicada: retencion,
            base_real_nomina: baseReal,
            comision_mecanico: comision
          }
        })
        setNominaItems(calculados)
      }
    }
    calcularNomina()
  }, [mecanicoSel, porcentajePago, fechaInicio, fechaFin])

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  const guardarCorreccionesAuditoria = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      for (const [idDetalle, valores] of Object.entries(edicionesAuditoria)) {
        await supabase
          .from('Detalles_Orden')
          .update({
            descripcion: valores.desc,
            precio_venta: valores.precio
          })
          .eq('id', idDetalle)
      }
      alert('¡Correcciones guardadas con éxito!')
      cargarAuditoria()
    } catch (err: any) {
      alert('Error al guardar: ' + err.message)
    }
  }

  // Totales de Nómina
  const totalCobradoCliente = nominaItems.reduce((acc, curr) => acc + curr.cobro_cliente, 0)
  const totalBaseReal = nominaItems.reduce((acc, curr) => acc + curr.base_real_nomina, 0)
  const totalComision = nominaItems.reduce((acc, curr) => acc + curr.comision_mecanico, 0)

  // Descargar CSV de Soporte de Pago
  const descargarCSV = () => {
    const headers = ['N° Orden', 'Placa', 'Cliente / Empresa', 'Fecha', 'Descripción', 'Cobro Cliente', 'Retención', 'Base Nómina', 'Comisión Técnico']
    const rows = nominaItems.map(i => [
      i.orden_id, i.placa, `"${i.empresa}"`, i.fecha, `"${i.descripcion_trabajo}"`, i.cobro_cliente, i.retencion_aplicada, i.base_real_nomina, i.comision_mecanico
    ])
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Liquidacion_Mecanico_${mecanicoSel}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Liquidación de Nómina Dinámica</h1>
        <p className="text-gray-600 mt-1">Auditoría de comisiones y ajustes de personal</p>
      </div>

      {/* 1. MÓDULO DE AUDITORÍA Y CORRECCIÓN */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
        <h3 className="font-bold text-gray-800 text-lg mb-2">Auditoría y Corrección de Trabajos Recientes</h3>
        <p className="text-sm text-gray-500 mb-4">Modifica directamente descripciones o precios antes de liquidar.</p>

        {trabajosAuditoria.length === 0 ? (
          <p className="text-gray-400 italic">No hay trabajos activos para auditar.</p>
        ) : (
          <form onSubmit={guardarCorreccionesAuditoria} className="space-y-4">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {trabajosAuditoria.map((t) => (
                <div key={t.detalle_id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-gray-50 p-3 rounded-lg border text-sm">
                  <div>
                    <span className="font-bold text-gray-900">Orden #{t.orden_nro}</span>
                    <p className="text-xs text-blue-600 font-semibold">{t.placa}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Técnico</span>
                    <span className="font-medium text-gray-800">{t.mecanico}</span>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 block">Descripción</label>
                    <input 
                      type="text" 
                      value={edicionesAuditoria[t.detalle_id]?.desc || ''}
                      onChange={(e) => setEdicionesAuditoria({
                        ...edicionesAuditoria,
                        [t.detalle_id]: { ...edicionesAuditoria[t.detalle_id], desc: e.target.value }
                      })}
                      className="w-full border p-1.5 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block">Precio Venta ($)</label>
                    <input 
                      type="number" 
                      step="5000"
                      value={edicionesAuditoria[t.detalle_id]?.precio || 0}
                      onChange={(e) => setEdicionesAuditoria({
                        ...edicionesAuditoria,
                        [t.detalle_id]: { ...edicionesAuditoria[t.detalle_id], precio: Number(e.target.value) }
                      })}
                      className="w-full border p-1.5 rounded bg-white font-bold"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Tipo</span>
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">{t.tipo_item}</span>
                  </div>
                </div>
              ))}
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
              Guardar Correcciones en la Base de Datos
            </button>
          </form>
        )}
      </div>

      {/* 2. LIQUIDACIÓN DE NÓMINA */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-800 text-lg mb-4">Filtros y Parámetros de Liquidación</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona el Técnico</label>
            <select value={mecanicoSel} onChange={(e) => setMecanicoSel(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
              <option value="">-- Selecciona un trabajador --</option>
              {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde - Hasta</label>
            <div className="flex gap-2">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="border p-2 rounded-lg bg-white text-sm flex-1" />
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="border p-2 rounded-lg bg-white text-sm flex-1" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje a Pagar (%)</label>
            <input type="number" value={porcentajePago} onChange={(e) => setPorcentajePago(Number(e.target.value))} className="w-full border p-2.5 rounded-lg bg-white" min="0" max="100" step="5" />
          </div>
        </div>

        {!mecanicoSel ? (
          <p className="text-gray-500 italic text-center py-4">Selecciona un trabajador en la casilla de arriba para ver su resumen de liquidación.</p>
        ) : (
          <div>
            {nominaItems.length === 0 ? (
              <p className="text-orange-600 bg-orange-50 p-4 rounded-lg border border-orange-200 text-center">No se encontraron trabajos de mano de obra para este técnico en el periodo seleccionado.</p>
            ) : (
              <div className="space-y-6">
                {/* MÉTRICAS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <span className="text-xs text-gray-500 block">Trabajos Realizados</span>
                    <span className="text-2xl font-bold text-gray-800">{nominaItems.length}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <span className="text-xs text-gray-500 block">Total Cobrado Cliente</span>
                    <span className="text-2xl font-bold text-gray-800">{formatoCOP(totalCobradoCliente)}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <span className="text-xs text-gray-500 block">Base Neta (Tras Retención)</span>
                    <span className="text-2xl font-bold text-gray-800">{formatoCOP(totalBaseReal)}</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <span className="text-xs text-green-700 block font-medium">Total a Pagar ({porcentajePago}%)</span>
                    <span className="text-2xl font-bold text-green-800">{formatoCOP(totalComision)}</span>
                  </div>
                </div>

                {/* TABLA DETALLE */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3">Detalle de Trabajos para el Recibo de Pago</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b text-gray-700">
                          <th className="p-3">N° Orden</th>
                          <th className="p-3">Placa</th>
                          <th className="p-3">Cliente / Empresa</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Descripción</th>
                          <th className="p-3 text-right">Cobro Cliente</th>
                          <th className="p-3 text-right">Retención</th>
                          <th className="p-3 text-right">Base Nómina</th>
                          <th className="p-3 text-right">Comisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nominaItems.map((n, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-bold">#{n.orden_id}</td>
                            <td className="p-3 font-semibold text-blue-600">{n.placa}</td>
                            <td className="p-3">{n.empresa}</td>
                            <td className="p-3 text-gray-500">{n.fecha}</td>
                            <td className="p-3">{n.descripcion_trabajo}</td>
                            <td className="p-3 text-right">{formatoCOP(n.cobro_cliente)}</td>
                            <td className="p-3 text-right text-red-600">{formatoCOP(n.retencion_aplicada)}</td>
                            <td className="p-3 text-right">{formatoCOP(n.base_real_nomina)}</td>
                            <td className="p-3 text-right font-bold text-green-700">{formatoCOP(n.comision_mecanico)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-right pt-2">
                  <button onClick={descargarCSV} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition">
                    Descargar Soporte de Pago (CSV)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}