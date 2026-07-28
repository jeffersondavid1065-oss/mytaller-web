'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PendientesPage() {
  const [ordenesSinPrecio, setOrdenesSinPrecio] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [ordenSelId, setOrdenSelId] = useState<string>('')
  const [itemsOrden, setItemsOrden] = useState<any[]>([])
  const [preciosEditados, setPreciosEditados] = useState<{ [key: string]: { costo: number; pvp: number } }>({})

  const USER_ID = 1 // Se adaptará al Auth definitivo posteriormente

  // Cargar datos iniciales
  const cargarDatos = async () => {
    // 1. Obtener órdenes con ítems pendientes ($0 o null)
    // Hacemos una consulta para filtrar órdenes que contengan detalles con precio 0
    const { data: detallesPendientes } = await supabase
      .from('Detalles_Orden')
      .select(`
        hoja_id,
        Hojas_Trabajo!inner (id, placa, empresa_id, Empresas_Clientes (razon_social))
      `)
      .or('precio_venta.eq.0,precio_venta.is.null')

    if (detallesPendientes) {
      // Agrupar únicas por hoja_id para el selector
      const mapUnicos = new Map()
      detallesPendientes.forEach((d: any) => {
        if (d.Hojas_Trabajo) {
          mapUnicos.set(d.Hojas_Trabajo.id, {
            id: d.Hojas_Trabajo.id,
            placa: d.Hojas_Trabajo.placa,
            razon_social: d.Hojas_Trabajo.Empresas_Clientes?.razon_social || 'N/A'
          })
        }
      })
      setOrdenesSinPrecio(Array.from(mapUnicos.values()))
    }

    // 2. Obtener todos los vehículos para el Tablero Kanban
    const { data: hojas } = await supabase
      .from('Hojas_Trabajo')
      .select(`
        id,
        placa,
        estado,
        Empresas_Clientes (razon_social),
        Detalles_Orden (precio_venta)
      `)

    if (hojas) {
      const formateados = hojas.map((h: any) => {
        const sinPrecioCount = h.Detalles_Orden?.filter((d: any) => d.precio_venta === 0 || d.precio_venta === null).length || 0
        return {
          id: h.id,
          placa: h.placa,
          razon_social: h.Empresas_Clientes?.razon_social || 'N/A',
          estado: h.estado,
          items_sin_precio: sinPrecioCount
        }
      })
      setVehiculos(formateados)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Cargar ítems específicos de la orden seleccionada para editar
  useEffect(() => {
    async function cargarItemsDeOrden() {
      if (!ordenSelId) {
        setItemsOrden([])
        return
      }

      const { data } = await supabase
        .from('Detalles_Orden')
        .select(`
          id,
          tipo_item,
          descripcion,
          costo_compra,
          precio_venta,
          Mecanicos (nombre)
        `)
        .eq('hoja_id', ordenSelId)

      if (data) {
        setItemsOrden(data)
        // Inicializar estado de inputs
        const inicial: any = {}
        data.forEach((i: any) => {
          inicial[i.id] = {
            costo: i.costo_compra || 0,
            pvp: i.precio_venta || 0
          }
        })
        setPreciosEditados(inicial)
      }
    }
    cargarItemsDeOrden()
  }, [ordenSelId])

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  const guardarPrecios = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      for (const [idItem, valores] of Object.entries(preciosEditados)) {
        await supabase
          .from('Detalles_Orden')
          .update({
            costo_compra: valores.costo,
            precio_venta: valores.pvp
          })
          .eq('id', idItem)
      }

      alert('¡Precios actualizados y sincronizados con éxito!')
      setOrdenSelId('')
      cargarDatos()
    } catch (error: any) {
      alert('Error al actualizar precios: ' + error.message)
    }
  }

  // Columnas Kanban
  const columnasConfig = [
    { titulo: 'Cotizar', estado: 'Cotizar', bg: 'bg-blue-50 border-blue-100' },
    { titulo: 'En Revisión', estado: 'En revision', bg: 'bg-amber-50 border-amber-100' },
    { titulo: 'Esperando Repuestos', estado: 'Esperando repuestos', bg: 'bg-orange-50 border-orange-100' },
    { titulo: 'En Reparación', estado: 'En reparacion', bg: 'bg-purple-50 border-purple-100' },
    { titulo: 'Listo para Facturar', estado: 'Listo para facturar', bg: 'bg-emerald-50 border-emerald-100' },
  ]

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tablero de Control Operativo</h1>
          <p className="text-gray-600 mt-1">Gestión del patio y cotizaciones pendientes</p>
        </div>
        <button onClick={cargarDatos} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition shadow-sm">
          Actualizar Tablero
        </button>
      </div>

      {/* 1. MÓDULO PARA LIQUIDAR TRABAJOS EN $0 */}
      {ordenesSinPrecio.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200 mb-8">
          <h2 className="text-lg font-bold text-orange-800 mb-3">
            ⚠️ Atención: Hay {ordenesSinPrecio.length} orden(es) con trabajos sin precio asignado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona la orden para editar precios:</label>
              <select 
                value={ordenSelId} 
                onChange={(e) => setOrdenSelId(e.target.value)}
                className="w-full border border-gray-300 p-2.5 rounded-lg bg-white"
              >
                <option value="">-- Seleccionar Orden --</option>
                {ordenesSinPrecio.map((o) => (
                  <option key={o.id} value={o.id}>Orden #{o.id} - Placa: {o.placa} ({o.razon_social})</option>
                ))}
              </select>
            </div>
          </div>

          {ordenSelId && itemsOrden.length > 0 && (
            <form onSubmit={guardarPrecios} className="border-t pt-4 mt-4 space-y-4">
              <h3 className="font-semibold text-gray-800">Editando Precios para Orden #{ordenSelId}</h3>
              {itemsOrden.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-800">{item.tipo_item}: {item.descripcion}</p>
                    {item.Mecanicos?.nombre && <p className="text-xs text-gray-500">Técnico: {item.Mecanicos.nombre}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Costo Compra</label>
                    <input 
                      type="number" 
                      step="1000"
                      disabled={item.tipo_item !== 'Repuesto'}
                      value={preciosEditados[item.id]?.costo || 0}
                      onChange={(e) => setPreciosEditados({
                        ...preciosEditados,
                        [item.id]: { ...preciosEditados[item.id], costo: Number(e.target.value) }
                      })}
                      className="w-full border p-2 rounded bg-white disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Precio Venta Cliente</label>
                    <input 
                      type="number" 
                      step="5000"
                      value={preciosEditados[item.id]?.pvp || 0}
                      onChange={(e) => setPreciosEditados({
                        ...preciosEditados,
                        [item.id]: { ...preciosEditados[item.id], pvp: Number(e.target.value) }
                      })}
                      className="w-full border p-2 rounded bg-white"
                    />
                  </div>
                  <div className="text-right font-semibold text-gray-700">
                    {formatoCOP(preciosEditados[item.id]?.pvp || 0)}
                  </div>
                </div>
              ))}
              <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
                Guardar Precios y Actualizar Orden
              </button>
            </form>
          )}
        </div>
      )}

      {/* 2. TABLERO KANBAN DE PENDIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {columnasConfig.map((col) => {
          const vehiculosCol = vehiculos.filter((v) => v.estado === col.estado)
          return (
            <div key={col.estado} className={`p-4 rounded-xl border ${col.bg} flex flex-col gap-3 min-h-[400px]`}>
              <h3 className="font-bold text-gray-800 text-base border-b pb-2">{col.titulo}</h3>
              {vehiculosCol.length === 0 ? (
                <p className="text-gray-400 text-sm italic text-center my-auto">Vacío</p>
              ) : (
                vehiculosCol.map((v) => (
                  <div key={v.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-1">
                    <p className="font-bold text-gray-900">Orden #{v.id}</p>
                    <p className="text-sm font-semibold text-blue-600">Placa: {v.placa}</p>
                    <p className="text-xs text-gray-500 truncate">Empresa: {v.razon_social}</p>
                    {v.items_sin_precio > 0 && (
                      <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-medium mt-1">
                        Pendiente por Cotizar ($0)
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}