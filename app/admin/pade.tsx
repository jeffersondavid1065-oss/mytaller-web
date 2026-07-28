'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const [talleres, setTalleres] = useState<any[]>([])
  const [tallerSelId, setTallerSelId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Correo del administrador principal del SaaS
  const CORREO_ADMIN = "jefferson.david1065@gmail.com"

  useEffect(() => {
    cargarTalleres()
  }, [])

  const cargarTalleres = async () => {
    const { data, error } = await supabase
      .from('usuarios') // <-- Corregido a minúsculas
      .select('*')
      .order('id', { ascending: false })

    if (data) {
      setTalleres(data)
    }
    setLoading(false)
  }

  const tallerSeleccionado = talleres.find(t => t.id.toString() === tallerSelId)

  // Extender suscripción 30 días y activar cuenta
  const extenderSuscripcion = async (id: number) => {
    const hoy = new Date()
    hoy.setDate(hoy.getDate() + 30)
    const nuevaFechaStr = hoy.toISOString().split('T')[0]

    const { error } = await supabase
      .from('usuarios') // <-- Corregido a minúsculas
      .update({ fecha_pago_limite: nuevaFechaStr, activo: true })
      .eq('id', id)

    if (error) {
      alert('Error al actualizar la suscripción: ' + error.message)
    } else {
      alert(`¡Suscripción actualizada exitosamente! Nueva fecha de corte: ${nuevaFechaStr}`)
      cargarTalleres()
    }
  }

  // Suspender acceso (colocar fecha de corte al día anterior)
  const suspenderAcceso = async (id: number, nombreTaller: string) => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const fechaVencidaStr = ayer.toISOString().split('T')[0]

    const { error } = await supabase
      .from('usuarios') // <-- Corregido a minúsculas
      .update({ fecha_pago_limite: fechaVencidaStr, activo: false })
      .eq('id', id)

    if (error) {
      alert('Error al procesar la suspensión: ' + error.message)
    } else {
      alert(`El acceso para el taller '${nombreTaller}' ha sido suspendido.`)
      cargarTalleres()
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando panel de administración...</div>
  }

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Control de Suscripciones</h1>
        <p className="text-gray-600 mt-1">Módulo para la administración de usuarios, activación de cuentas y gestión de fechas de corte</p>
      </div>

      {/* 1. DIRECTORIO DE TALLERES REGISTRADOS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
        <h3 className="font-bold text-gray-800 text-lg mb-4">Directorio de Talleres Registrados</h3>
        
        {talleres.length === 0 ? (
          <p className="text-gray-500 italic text-center py-4">Actualmente no existen talleres registrados en el sistema.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b text-gray-700">
                  <th className="p-3">ID</th>
                  <th className="p-3">Nombre Taller</th>
                  <th className="p-3">Propietario</th>
                  <th className="p-3">Correo Electrónico</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Fecha de Corte</th>
                </tr>
              </thead>
              <tbody>
                {talleres.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold">#{t.id}</td>
                    <td className="p-3 font-semibold text-blue-600">{t.nombre_taller}</td>
                    <td className="p-3">{t.nombre_dueno}</td>
                    <td className="p-3 text-gray-500">{t.email}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {t.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-700">{t.fecha_pago_limite || 'Sin fecha asignada'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. GESTIÓN DE SUSCRIPCIONES Y ACCESOS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <h3 className="font-bold text-gray-800 text-lg">Gestión de Suscripciones y Accesos</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seleccione el taller a gestionar:</label>
          <select value={tallerSelId} onChange={e => setTallerSelId(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
            <option value="">-- Seleccione un taller --</option>
            {talleres.map(t => (
              <option key={t.id} value={t.id}>ID {t.id} - {t.nombre_taller} ({t.email})</option>
            ))}
          </select>
        </div>

        {tallerSeleccionado && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200 items-center">
            <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl space-y-2 text-sm text-blue-900">
              <p><strong>Propietario:</strong> {tallerSeleccionado.nombre_dueno}</p>
              <p><strong>Estado de la cuenta:</strong> {tallerSeleccionado.activo ? 'Activa' : 'Inactiva'}</p>
              <p><strong>Fecha de corte actual:</strong> {tallerSeleccionado.fecha_pago_limite || 'Sin fecha asignada'}</p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Acciones Disponibles</h4>
              <button 
                onClick={() => extenderSuscripcion(tallerSeleccionado.id)} 
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm"
              >
                Extender 30 días
              </button>
              <button 
                onClick={() => suspenderAcceso(tallerSeleccionado.id, tallerSeleccionado.nombre_taller)} 
                className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-bold hover:bg-red-200 transition"
              >
                Suspender Acceso
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
