'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  // 1. ESTADOS DE SESIÓN Y FORMULARIOS
  const [isLogged, setIsLogged] = useState(false)
  const [user, setUser] = useState<{ id: number; nombre_taller: string } | null>(null)
  
  // Estados para Login
  const [emailLogin, setEmailLogin] = useState('')
  const [passLogin, setPassLogin] = useState('')
  
  // Estados para Registro
  const [tallerReg, setTallerReg] = useState('')
  const [duenoReg, setDuenoReg] = useState('')
  const [emailReg, setEmailReg] = useState('')
  const [passReg, setPassReg] = useState('')
  const [showRegistro, setShowRegistro] = useState(false)

  // Estados para las Métricas
  const [metricas, setMetricas] = useState({
    activos: 0,
    cotizar: 0,
    ordenes: 0,
    empresas: 0
  })

  // 2. FUNCIÓN DE INICIO DE SESIÓN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailLogin || !passLogin) return alert("Completa todos los campos")

    const { data, error } = await supabase
      .from('usuarios') // <-- Corregido a minúsculas
      .select('id, nombre_taller, password, fecha_pago_limite')
      .eq('email', emailLogin)
      .single()

    if (error || !data) {
      return alert("Credenciales incorrectas o usuario no encontrado.")
    }

    if (data.password === passLogin) {
      const hoy = new Date()
      const fechaLimite = data.fecha_pago_limite ? new Date(data.fecha_pago_limite) : null

      if (!fechaLimite || fechaLimite < hoy) {
        alert("Tu suscripción se encuentra inactiva o ha expirado. Comunícate con el administrador.")
      } else {
        setUser({ id: data.id, nombre_taller: data.nombre_taller })
        setIsLogged(true)
        cargarMetricas(data.id)
      }
    } else {
      alert("Credenciales incorrectas.")
    }
  }

  // 3. FUNCIÓN DE REGISTRO
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tallerReg || !duenoReg || !emailReg || !passReg) return alert("Completa todos los campos")

    const { error } = await supabase
      .from('usuarios') // <-- Corregido a minúsculas
      .insert([
        {
          nombre_taller: tallerReg,
          nombre_dueno: duenoReg,
          email: emailReg,
          password: passReg
        }
      ])

    if (error) {
      alert("Error al registrar el taller: " + error.message)
    } else {
      alert("Cuenta creada con éxito. Contacta al administrador para activar tu suscripción.")
      setShowRegistro(false)
    }
  }

  // 4. FUNCIÓN PARA OBTENER MÉTRICAS
  const cargarMetricas = async (uid: number) => {
    const { count: cotizarCount } = await supabase
      .from('Hojas_Trabajo')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', uid)
      .eq('estado', 'Cotizar')

    const { count: ordenesCount } = await supabase
      .from('Hojas_Trabajo')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', uid)
      .neq('estado', 'Facturado')

    const { count: empresasCount } = await supabase
      .from('Empresas_Clientes')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', uid)

    const { data: detalles } = await supabase
      .from('Detalles_Orden')
      .select(`precio_venta, Hojas_Trabajo!inner(estado, usuario_id)`)
      .eq('Hojas_Trabajo.usuario_id', uid)
      .neq('Hojas_Trabajo.estado', 'Facturado')

    const valorActivos = detalles ? detalles.reduce((acc, curr) => acc + Number(curr.precio_venta), 0) : 0

    setMetricas({
      activos: valorActivos,
      cotizar: cotizarCount || 0,
      ordenes: ordenesCount || 0,
      empresas: empresasCount || 0
    })
  }

  const formatoCOP = (numero: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numero)
  }

  // ================= RENDERIZADO DE LA INTERFAZ =================
  if (!isLogged) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <div className="text-center mb-8">
          <h1 className="font-extrabold text-5xl tracking-tight mb-2 text-gray-900">
            My<span className="text-red-500">Taller</span>
          </h1>
          <p className="text-gray-500">Gestión inteligente para talleres automotrices</p>
        </div>

        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Iniciar Sesión</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
              <input type="email" value={emailLogin} onChange={e => setEmailLogin(e.target.value)} className="w-full border p-2.5 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={passLogin} onChange={e => setPassLogin(e.target.value)} className="w-full border p-2.5 rounded-lg text-gray-900" />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">
              Ingresar
            </button>
          </form>
        </div>

        <div className="w-full max-w-md mt-4">
          <button onClick={() => setShowRegistro(!showRegistro)} className="w-full bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-300 transition">
            {showRegistro ? 'Ocultar Registro' : 'Registrar Nuevo Taller'}
          </button>
          
          {showRegistro && (
            <form onSubmit={handleRegistro} className="mt-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <input type="text" placeholder="Nombre del Taller" value={tallerReg} onChange={e => setTallerReg(e.target.value)} className="w-full border p-2.5 rounded-lg text-gray-900" />
              <input type="text" placeholder="Nombre del Dueño" value={duenoReg} onChange={e => setDuenoReg(e.target.value)} className="w-full border p-2.5 rounded-lg text-gray-900" />
              <input type="email" placeholder="Correo Electrónico Comercial" value={emailReg} onChange={e => setEmailReg(e.target.value)} className="w-full border p-2.5 rounded-lg text-gray-900" />
              <input type="password" placeholder="Contraseña" value={passReg} onChange={e => setPassReg(e.target.value)} className="w-full border p-2.5 rounded-lg text-gray-900" />
              <button type="submit" className="w-full bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition">
                Crear Cuenta
              </button>
            </form>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-7xl mx-auto text-gray-800 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel Principal</h1>
          <p className="text-gray-600 mt-1">Resumen gerencial y contable para: <span className="font-bold">{user?.nombre_taller}</span></p>
        </div>
        <button onClick={() => setIsLogged(false)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 transition">
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Valor Trabajos Activos</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatoCOP(metricas.activos)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Órdenes por Cotizar</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{metricas.cotizar}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Órdenes Activas</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{metricas.ordenes}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Empresas Registradas</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{metricas.empresas}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Control Contable</h3>
          <p className="text-gray-600">Desde este panel puedes supervisar de forma general el estado financiero de tus operaciones en curso.</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Accesos Rápidos</h3>
          <ul className="text-gray-600 space-y-2">
            <li>• Gestiona tus órdenes y expedientes.</li>
            <li>• Consulta la nómina y comisiones de personal.</li>
            <li>• Administra el inventario de repuestos.</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
