'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DirectorioPage() {
  const [activeTab, setActiveTab] = useState<'empresas' | 'mecanicos'>('empresas')

  // Estados Empresas
  const [empresas, setEmpresas] = useState<any[]>([])
  const [razonSocialReg, setRazonSocialReg] = useState('')
  const [nitReg, setNitReg] = useState('')
  const [telReg, setTelReg] = useState('')
  const [emailReg, setEmailReg] = useState('')
  const [empresaSelId, setEmpresaSelId] = useState('')
  
  // Edición y eliminación de empresas
  const [editEmpId, setEditEmpId] = useState<number | null>(null)
  const [updRazon, setUpdRazon] = useState('')
  const [updNit, setUpdNit] = useState('')
  const [updTel, setUpdTel] = useState('')
  const [updEmail, setUpdEmail] = useState('')
  const [deleteEmpConfirm, setDeleteEmpConfirm] = useState<number | null>(null)

  // Historial de la empresa seleccionada
  const [historialOrdenes, setHistorialOrdenes] = useState<any[]>([])
  const [tipoVistaHist, setTipoVistaHist] = useState<'resumida' | 'detallada'>('resumida')

  // Estados Mecánicos
  const [mecanicos, setMecanicos] = useState<any[]>([])
  const [nombreMecReg, setNombreMecReg] = useState('')
  const [docMecReg, setDocMecReg] = useState('')
  const [editMecId, setEditMecId] = useState<number | null>(null)
  const [updNombreMec, setUpdNombreMec] = useState('')
  const [updDocMec, setUpdDocMec] = useState('')
  const [updEstadoMec, setUpdEstadoMec] = useState('Activo')

  const USER_ID = 1 // Se adaptará al Auth definitivo

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    // Cargar empresas
    const { data: emp } = await supabase
      .from('Empresas_Clientes')
      .select('*')
      .order('razon_social', { ascending: true })
    if (emp) setEmpresas(emp)

    // Cargar mecánicos
    const { data: mec } = await supabase
      .from('Mecanicos')
      .select('*')
      .order('nombre', { ascending: true })
    if (mec) setMecanicos(mec)
  }

  // Cargar historial de la empresa seleccionada
  useEffect(() => {
    async function cargarHistorialEmpresa() {
      if (!empresaSelId) {
        setHistorialOrdenes([])
        return
      }

      const { data, error } = await supabase
        .from('Hojas_Trabajo')
        .select(`
          id, fecha_ingreso, placa, estado,
          Detalles_Orden (tipo_item, descripcion, precio_venta)
        `)
        .eq('empresa_id', empresaSelId)
        .order('id', { ascending: false })

      if (data) {
        setHistorialOrdenes(data)
      }
    }
    cargarHistorialEmpresa()
  }, [empresaSelId])

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  // Registrar Empresa
  const registrarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!razonSocialReg || !nitReg) return alert('La Razón Social y el NIT son obligatorios.')

    const { error } = await supabase.from('Empresas_Clientes').insert([{
      razon_social: razonSocialReg,
      nit: nitReg,
      telefono: telReg,
      email: emailReg
    }])

    if (error) {
      alert('Error al registrar empresa: ' + error.message)
    } else {
      alert('¡Empresa registrada con éxito!')
      setRazonSocialReg('')
      setNitReg('')
      setTelReg('')
      setEmailReg('')
      cargarDatos()
    }
  }

  // Actualizar Empresa
  const actualizarEmpresa = async (id: number) => {
    const { error } = await supabase
      .from('Empresas_Clientes')
      .update({ razon_social: updRazon, nit: updNit, telefono: updTel, email: updEmail })
      .eq('id', id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      alert('¡Empresa actualizada con éxito!')
      setEditEmpId(null)
      cargarDatos()
    }
  }

  // Eliminar Empresa
  const eliminarEmpresaDefinitiva = async (id: number) => {
    try {
      // Eliminar detalles e hijos relacionados por seguridad referencial
      const { data: hojas } = await supabase.from('Hojas_Trabajo').select('id').eq('empresa_id', id)
      if (hojas) {
        for (const h of hojas) {
          await supabase.from('Detalles_Orden').delete().eq('hoja_id', h.id)
        }
        await supabase.from('Hojas_Trabajo').delete().eq('empresa_id', id)
      }
      await supabase.from('Empresas_Clientes').delete().eq('id', id)

      alert('Empresa eliminada con éxito.')
      setDeleteEmpConfirm(null)
      setEmpresaSelId('')
      cargarDatos()
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  // Registrar Mecánico
  const registrarMecanico = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreMecReg || !docMecReg) return alert('Por favor, completa ambos campos.')

    const { error } = await supabase.from('Mecanicos').insert([{
      nombre: nombreMecReg,
      documento: docMecReg,
      estado: 'Activo'
    }])

    if (error) {
      alert('Error al registrar mecánico: ' + error.message)
    } else {
      alert('¡Mecánico registrado con éxito!')
      setNombreMecReg('')
      setDocMecReg('')
      cargarDatos()
    }
  }

  // Actualizar Mecánico
  const actualizarMecanico = async (id: number) => {
    const { error } = await supabase
      .from('Mecanicos')
      .update({ nombre: updNombreMec, documento: updDocMec, estado: updEstadoMec })
      .eq('id', id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      alert('¡Mecánico actualizado con éxito!')
      setEditMecId(null)
      cargarDatos()
    }
  }

  // Eliminar Mecánico
  const eliminarMecanico = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este mecánico?')) return
    const { error } = await supabase.from('Mecanicos').delete().eq('id', id)
    if (error) {
      alert('No se puede eliminar: tiene trabajos asociados en órdenes de servicio.')
    } else {
      alert('Mecánico eliminado.')
      cargarDatos()
    }
  }

  const empresaSeleccionadaInfo = empresas.find(e => e.id.toString() === empresaSelId)

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Directorio y Expediente de Clientes</h1>
        <p className="text-gray-600 mt-1">Administración de clientes, flotas y personal</p>
      </div>

      {/* PESTAÑAS */}
      <div className="flex bg-white rounded-t-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        <button 
          onClick={() => setActiveTab('empresas')} 
          className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'empresas' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Empresas y Flotas
        </button>
        <button 
          onClick={() => setActiveTab('mecanicos')} 
          className={`flex-1 py-3 font-semibold text-sm transition ${activeTab === 'mecanicos' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Equipo de Mecánicos
        </button>
      </div>

      {/* CONTENIDO PESTAÑA 1: EMPRESAS */}
      {activeTab === 'empresas' && (
        <div className="space-y-6">
          {/* REGISTRAR EMPRESA */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Registrar una nueva empresa o cliente</h3>
            <form onSubmit={registrarEmpresa} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social o Nombre del Cliente</label>
                  <input type="text" value={razonSocialReg} onChange={(e) => setRazonSocialReg(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: Transportes del Norte" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT o Cédula (Sin puntos)</label>
                  <input type="text" value={nitReg} onChange={(e) => setNitReg(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: 900123456" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de Contacto</label>
                  <input type="text" value={telReg} onChange={(e) => setTelReg(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: 3001234567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                  <input type="email" value={emailReg} onChange={(e) => setEmailReg(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: contacto@empresa.com" />
                </div>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
                Guardar Empresa
              </button>
            </form>
          </div>

          {/* BUSCADOR Y GESTIÓN DE CLIENTES */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Buscador y Gestión de Clientes / Empresas</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona o busca una empresa:</label>
              <select value={empresaSelId} onChange={(e) => setEmpresaSelId(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white">
                <option value="">-- Selecciona o busca una empresa --</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.razon_social} (NIT/CC: {e.nit})</option>
                ))}
              </select>
            </div>

            {empresaSeleccionadaInfo && (
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{empresaSeleccionadaInfo.razon_social}</h4>
                    <p className="text-sm text-gray-600">NIT / Cédula: <span className="font-semibold">{empresaSeleccionadaInfo.nit}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditEmpId(empresaSeleccionadaInfo.id)
                      setUpdRazon(empresaSeleccionadaInfo.razon_social)
                      setUpdNit(empresaSeleccionadaInfo.nit)
                      setUpdTel(empresaSeleccionadaInfo.telefono || '')
                      setUpdEmail(empresaSeleccionadaInfo.email || '')
                    }} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-300">
                      Editar
                    </button>
                    <button onClick={() => setDeleteEmpConfirm(empresaSeleccionadaInfo.id)} className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-200">
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Teléfono: <span className="font-medium text-gray-800">{empresaSeleccionadaInfo.telefono || 'No registrado'}</span></div>
                  <div>Email: <span className="font-medium text-gray-800">{empresaSeleccionadaInfo.email || 'No registrado'}</span></div>
                </div>

                {/* Formulario de Edición */}
                {editEmpId === empresaSeleccionadaInfo.id && (
                  <div className="border-t pt-4 mt-4 space-y-3">
                    <h5 className="font-semibold text-gray-800">Actualizar Datos</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="text" value={updRazon} onChange={e => setUpdRazon(e.target.value)} placeholder="Razón social" className="border p-2 rounded bg-white text-sm" />
                      <input type="text" value={updNit} onChange={e => setUpdNit(e.target.value)} placeholder="NIT" className="border p-2 rounded bg-white text-sm" />
                      <input type="text" value={updTel} onChange={e => setUpdTel(e.target.value)} placeholder="Teléfono" className="border p-2 rounded bg-white text-sm" />
                      <input type="text" value={updEmail} onChange={e => setUpdEmail(e.target.value)} placeholder="Email" className="border p-2 rounded bg-white text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => actualizarEmpresa(empresaSeleccionadaInfo.id)} className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-semibold">Guardar Cambios</button>
                      <button onClick={() => setEditEmpId(null)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-xs font-semibold">Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Confirmación de Eliminación */}
                {deleteEmpConfirm === empresaSeleccionadaInfo.id && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-red-700 font-medium">¿Estás seguro de eliminar a esta empresa? Se borrarán también sus órdenes asociadas.</p>
                    <div className="flex gap-2">
                      <button onClick={() => eliminarEmpresaDefinitiva(empresaSeleccionadaInfo.id)} className="bg-red-600 text-white px-4 py-2 rounded text-xs font-semibold">Sí, eliminar definitivamente</button>
                      <button onClick={() => setDeleteEmpConfirm(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-xs font-semibold">Cancelar</button>
                    </div>
                  </div>
                )}

                {/* HISTORIAL DE TRABAJOS */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-bold text-gray-800 mb-3">Historial de Trabajos y Flota</h4>
                  
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="vista" checked={tipoVistaHist === 'resumida'} onChange={() => setTipoVistaHist('resumida')} />
                      <span>Vista Resumida (Solo Órdenes)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="vista" checked={tipoVistaHist === 'detallada'} onChange={() => setTipoVistaHist('detallada')} />
                      <span>Vista Detallada (Ítems y Repuestos)</span>
                    </label>
                  </div>

                  {historialOrdenes.length === 0 ? (
                    <p className="text-gray-500 italic text-sm">No hay órdenes registradas para esta empresa.</p>
                  ) : (
                    <div className="space-y-3">
                      {historialOrdenes.map(ord => {
                        const totalOrd = ord.Detalles_Orden?.reduce((acc: number, curr: any) => acc + (Number(curr.precio_venta) || 0), 0) || 0
                        return (
                          <div key={ord.id} className="bg-white p-4 rounded-lg border shadow-sm text-sm space-y-2">
                            <div className="flex justify-between items-center font-semibold">
                              <span>Orden #{ord.id} - Placa: <span className="text-blue-600">{ord.placa}</span></span>
                              <span className="text-green-700">{formatoCOP(totalOrd)}</span>
                            </div>
                            <p className="text-xs text-gray-500">Fecha: {ord.fecha_ingreso ? ord.fecha_ingreso.split('T')[0] : ''} | Estado: {ord.estado}</p>
                            
                            {tipoVistaHist === 'detallada' && ord.Detalles_Orden && (
                              <div className="bg-gray-50 p-2 rounded border mt-2 space-y-1">
                                {ord.Detalles_Orden.map((d: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs text-gray-700">
                                    <span>[{d.tipo_item}] {d.descripcion}</span>
                                    <span className="font-semibold">{formatoCOP(d.precio_venta)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: MECÁNICOS */}
      {activeTab === 'mecanicos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* REGISTRAR MECÁNICO */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Agregar Nuevo Mecánico</h3>
            <form onSubmit={registrarMecanico} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input type="text" value={nombreMecReg} onChange={(e) => setNombreMecReg(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: Carlos Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento de Identidad</label>
                <input type="text" value={docMecReg} onChange={(e) => setDocMecReg(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white" placeholder="Ej: 1065432100" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
                Contratar / Registrar Mecánico
              </button>
            </form>
          </div>

          {/* LISTA DE MECÁNICOS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Personal Actual</h3>
            {mecanicos.length === 0 ? (
              <p className="text-gray-500 italic">No hay mecánicos registrados.</p>
            ) : (
              <div className="space-y-3">
                {mecanicos.map(m => (
                  <div key={m.id} className="bg-gray-50 p-4 rounded-lg border space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900">{m.nombre}</p>
                        <p className="text-xs text-gray-500">Doc: {m.documento} | Estado: <span className="font-semibold text-gray-700">{m.estado}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditMecId(m.id)
                          setUpdNombreMec(m.nombre)
                          setUpdDocMec(m.documento)
                          setUpdEstadoMec(m.estado)
                        }} className="text-xs bg-gray-200 px-3 py-1 rounded font-semibold">Editar</button>
                        <button onClick={() => eliminarMecanico(m.id)} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded font-semibold">Eliminar</button>
                      </div>
                    </div>

                    {editMecId === m.id && (
                      <div className="border-t pt-3 mt-2 space-y-2">
                        <input type="text" value={updNombreMec} onChange={e => setUpdNombreMec(e.target.value)} className="w-full border p-1.5 rounded text-sm bg-white" placeholder="Nombre" />
                        <input type="text" value={updDocMec} onChange={e => setUpdDocMec(e.target.value)} className="w-full border p-1.5 rounded text-sm bg-white" placeholder="Documento" />
                        <select value={updEstadoMec} onChange={e => setUpdEstadoMec(e.target.value)} className="w-full border p-1.5 rounded text-sm bg-white">
                          <option value="Activo">Activo</option>
                          <option value="Inactivo">Inactivo</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => actualizarMecanico(m.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold">Guardar</button>
                          <button onClick={() => setEditMecId(null)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs font-semibold">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}