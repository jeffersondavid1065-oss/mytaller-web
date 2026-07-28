'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'nuevo'>('stock')

  // Estados de inventario
  const [inventario, setInventario] = useState<any[]>([])
  const [editEdits, setEditEdits] = useState<{ [key: string]: any }>({})

  // Formulario Nuevo Producto
  const [nomP, setNomP] = useState('')
  const [refP, setRefP] = useState('')
  const [stkP, setStkP] = useState<number>(5)
  const [stkMinP, setStkMinP] = useState<number>(2)
  const [costoP, setCostoP] = useState<number>(0)
  const [ventaP, setVentaP] = useState<number>(0)

  const USER_ID = 1 // Se adaptará al Auth definitivo

  useEffect(() => {
    cargarInventario()
  }, [])

  const cargarInventario = async () => {
    const { data, error } = await supabase
      .from('Inventario')
      .select('*')
      .order('nombre_producto', { ascending: true })

    if (data) {
      setInventario(data)
      const inicial: any = {}
      data.forEach(item => {
        inicial[item.id] = {
          nombre_producto: item.nombre_producto,
          codigo_ref: item.codigo_ref || '',
          stock_actual: item.stock_actual,
          stock_minimo: item.stock_minimo,
          costo_compra: item.costo_compra,
          precio_venta: item.precio_venta
        }
      })
      setEditEdits(inicial)
    }
  }

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  // Métricas financieras y de stock
  const valCosto = inventario.reduce((acc, curr) => acc + ((curr.stock_actual || 0) * (curr.costo_compra || 0)), 0)
  const valVenta = inventario.reduce((acc, curr) => acc + ((curr.stock_actual || 0) * (curr.precio_venta || 0)), 0)
  const porAgotarse = inventario.filter(i => (i.stock_actual || 0) > 0 && (i.stock_actual || 0) <= (i.stock_minimo || 0)).length
  const agotados = inventario.filter(i => (i.stock_actual || 0) <= 0).length

  // Guardar cambios masivos de inventario
  const guardarCambiosInventario = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      for (const [idStr, valores] of Object.entries(editEdits)) {
        await supabase
          .from('Inventario')
          .update({
            nombre_producto: (valores as any).nombre_producto,
            codigo_ref: (valores as any).codigo_ref,
            stock_actual: Number((valores as any).stock_actual),
            stock_minimo: Number((valores as any).stock_minimo),
            costo_compra: Number((valores as any).costo_compra),
            precio_venta: Number((valores as any).precio_venta)
          })
          .eq('id', parseInt(idStr))
      }
      alert('¡Inventario actualizado y sincronizado con éxito!')
      cargarInventario()
    } catch (err: any) {
      alert('Error al actualizar inventario: ' + err.message)
    }
  }

  // Registrar Nuevo Producto
  const registrarProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomP || ventaP <= 0) return alert('Escribe el nombre del producto y asigna un precio de venta válido.')

    const { error } = await supabase.from('Inventario').insert([{
      nombre_producto: nomP,
      codigo_ref: refP,
      stock_actual: stkP,
      stock_minimo: stkMinP,
      costo_compra: costoP,
      precio_venta: ventaP
    }])

    if (error) {
      alert('Error al guardar producto: ' + error.message)
    } else {
      alert(`¡Producto '${nomP}' registrado con éxito en el almacén!`)
      setNomP('')
      setRefP('')
      setStkP(5)
      setStkMinP(2)
      setCostoP(0)
      setVentaP(0)
      cargarInventario()
      setActiveTab('stock')
    }
  }

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventario de Almacén</h1>
        <p className="text-gray-600 mt-1">Control de stock de repuestos e insumos</p>
      </div>

      {/* PESTAÑAS */}
      <div className="flex bg-white rounded-t-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        <button 
          onClick={() => setActiveTab('stock')} 
          className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'stock' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Stock Actual y Alertas
        </button>
        <button 
          onClick={() => setActiveTab('nuevo')} 
          className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'nuevo' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Agregar Producto al Almacén
        </button>
      </div>

      {/* TAB 1: STOCK Y EDICIÓN */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* MÉTRICAS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <span className="text-xs text-gray-500 block font-semibold uppercase">Inversión en Stock (Costo)</span>
              <span className="text-2xl font-bold text-gray-900 mt-1 block">{formatoCOP(valCosto)}</span>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <span className="text-xs text-gray-500 block font-semibold uppercase">Valor Comercial (Venta)</span>
              <span className="text-2xl font-bold text-gray-900 mt-1 block">{formatoCOP(valVenta)}</span>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-200 bg-orange-50/20">
              <span className="text-xs text-orange-700 block font-semibold uppercase">Por Agotarse (Alerta)</span>
              <span className="text-2xl font-bold text-orange-800 mt-1 block">{porAgotarse}</span>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-red-200 bg-red-50/20">
              <span className="text-xs text-red-700 block font-semibold uppercase">Agotados (Sin Stock)</span>
              <span className="text-2xl font-bold text-red-800 mt-1 block">{agotados}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Gestión de Productos en Stock</h3>
            <p className="text-sm text-gray-500 mb-6">Modifica los valores en los campos y haz clic en guardar cambios.</p>

            {inventario.length === 0 ? (
              <p className="text-gray-500 italic text-center py-6">Aún no tienes repuestos o insumos registrados en el almacén de tu taller.</p>
            ) : (
              <form onSubmit={guardarCambiosInventario} className="space-y-4">
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {inventario.map(item => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-gray-50 p-4 rounded-lg border text-sm">
                      <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 block">Producto / Repuesto</label>
                        <input 
                          type="text" 
                          value={editEdits[item.id]?.nombre_producto || ''}
                          onChange={e => setEditEdits({
                            ...editEdits,
                            [item.id]: { ...editEdits[item.id], nombre_producto: e.target.value }
                          })}
                          className="w-full border p-1.5 rounded bg-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Código / Ref</label>
                        <input 
                          type="text" 
                          value={editEdits[item.id]?.codigo_ref || ''}
                          onChange={e => setEditEdits({
                            ...editEdits,
                            [item.id]: { ...editEdits[item.id], codigo_ref: e.target.value }
                          })}
                          className="w-full border p-1.5 rounded bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Cantidad Stock</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editEdits[item.id]?.stock_actual ?? 0}
                          onChange={e => setEditEdits({
                            ...editEdits,
                            [item.id]: { ...editEdits[item.id], stock_actual: Number(e.target.value) }
                          })}
                          className="w-full border p-1.5 rounded bg-white font-bold text-center"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Costo Compra ($)</label>
                        <input 
                          type="number" 
                          step="1000"
                          value={editEdits[item.id]?.costo_compra || 0}
                          onChange={e => setEditEdits({
                            ...editEdits,
                            [item.id]: { ...editEdits[item.id], costo_compra: Number(e.target.value) }
                          })}
                          className="w-full border p-1.5 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Precio Venta ($)</label>
                        <input 
                          type="number" 
                          step="1000"
                          value={editEdits[item.id]?.precio_venta || 0}
                          onChange={e => setEditEdits({
                            ...editEdits,
                            [item.id]: { ...editEdits[item.id], precio_venta: Number(e.target.value) }
                          })}
                          className="w-full border p-1.5 rounded bg-white font-bold text-green-700"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t text-right">
                  <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm">
                    Guardar Cambios de Inventario
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NUEVO PRODUCTO */}
      {activeTab === 'nuevo' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
          <h3 className="font-bold text-gray-800 text-lg mb-4">Registrar Nuevo Producto o Insumo</h3>
          <form onSubmit={registrarProducto} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Repuesto / Insumo</label>
              <input type="text" value={nomP} onChange={e => setNomP(e.target.value)} placeholder="Ej: Filtro de Aceite NPR" className="w-full border p-2.5 rounded-lg bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código o Referencia (Opcional)</label>
              <input type="text" value={refP} onChange={e => setRefP(e.target.value)} placeholder="Ej: REF-9876" className="w-full border p-2.5 rounded-lg bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad Inicial en Stock</label>
                <input type="number" value={stkP} onChange={e => setStkP(Number(e.target.value))} min="1" className="w-full border p-2.5 rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo (Alerta)</label>
                <input type="number" value={stkMinP} onChange={e => setStkMinP(Number(e.target.value))} min="1" className="w-full border p-2.5 rounded-lg bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Compra ($)</label>
                <input type="number" value={costoP || ''} onChange={e => setCostoP(Number(e.target.value))} step="1000" placeholder="0" className="w-full border p-2.5 rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta ($)</label>
                <input type="number" value={ventaP || ''} onChange={e => setVentaP(Number(e.target.value))} step="1000" placeholder="0" className="w-full border p-2.5 rounded-lg bg-white" />
              </div>
            </div>

            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-sm mt-4">
              Guardar en Inventario
            </button>
          </form>
        </div>
      )}
    </main>
  )
}