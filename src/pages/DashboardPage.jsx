import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Elite inline error notification ───────────────────────
function DashboardError({ message, onRetry }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', margin: '0 0 24px 0',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 12, backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.4s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                    <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.9rem' }}>
                        Error al cargar el Dashboard
                    </div>
                    <div style={{ color: 'rgba(248,113,113,0.7)', fontSize: '0.8rem', marginTop: 2 }}>
                        {message || 'Hubo un problema al conectar con la base de datos.'}
                    </div>
                </div>
            </div>
            <button
                onClick={onRetry}
                style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
                    background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: '0.8rem',
                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.22)'}
                onMouseLeave={e => e.target.style.background = 'rgba(239,68,68,0.12)'}
            >
                🔄 Reintentar
            </button>
        </div>
    )
}

// ─── Individual card skeleton loader ───────────────────────
function SkeletonCard({ height = 80 }) {
    return (
        <div style={{
            height, borderRadius: 12, overflow: 'hidden',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
        }}>
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.6s infinite linear'
            }} />
        </div>
    )
}

export default function DashboardPage() {
    const { agencia } = useAuth()
    const [stats, setStats] = useState({
        leadsHoy: 0, leadsTotal: 0, ventasTotal: 0,
        ingresosMes: 0, costosMes: 0, utilidadMes: 0, winRate: 0,
        cplMes: 0,
        avgResponseMins: null, sleepingLeads: 0, fastLeads: 0, totalResponded: 0
    })
    const [chartData, setChartData] = useState([])
    const [topProductos, setTopProductos] = useState([])
    const [proxVentas, setProxVentas] = useState([])
    const [recentLeads, setRecentLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if(agencia?.id) loadDashboard()
        setTimeout(() => setIsVisible(true), 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia?.id])

    async function loadDashboard() {
        if (!agencia?.id) return
        setLoading(true)
        setError(null)

        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1)

            // Run independent queries in parallel for speed
            const [
                leadsCountResult,
                leadsHoyResult,
                ventasTotalResult,
                ventasMesResult,
                ventas6MResult,
                recentLeadsResult,
                inversionesMesResult,
                leadsMesResult,
                speedToLeadResult,
                sleepingLeadsResult
            ] = await Promise.all([
                supabase.from('leads').select('*', { count: 'exact', head: true }).eq('agencia_id', agencia.id),
                supabase.from('leads').select('*', { count: 'exact', head: true }).eq('agencia_id', agencia.id).gte('created_at', today.toISOString()),
                supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('agencia_id', agencia.id),
                supabase.from('ventas').select('precio_venta, costo_asesor').eq('agencia_id', agencia.id).gte('created_at', firstOfMonth.toISOString()),
                supabase.from('ventas').select('created_at, precio_venta, costo_asesor').eq('agencia_id', agencia.id).gte('created_at', sixMonthsAgo.toISOString()),
                supabase.from('leads').select('id, nombre, origen, estado, created_at').eq('agencia_id', agencia.id).order('created_at', { ascending: false }).limit(4),
                supabase.from('inversion_marketing').select('gasto_usd').eq('agencia_id', agencia.id).eq('mes', today.getMonth() + 1).eq('anio', today.getFullYear()),
                supabase.from('leads').select('*', { count: 'exact', head: true }).eq('agencia_id', agencia.id).gte('created_at', firstOfMonth.toISOString()),
                supabase.from('leads').select('time_to_respond_mins').eq('agencia_id', agencia.id).not('time_to_respond_mins', 'is', null).gte('created_at', firstOfMonth.toISOString()),
                supabase.from('leads').select('id, nombre, created_at', { count: 'exact' }).eq('agencia_id', agencia.id).eq('estado', 'nuevo').is('ultimo_contacto', null)
            ])

            // Surface first critical error
            const criticalError = [leadsCountResult, ventasTotalResult, ventasMesResult].find(r => r.error)
            if (criticalError?.error) throw criticalError.error

            const leadsTotal = leadsCountResult.count || 0
            const leadsHoy = leadsHoyResult.count || 0
            const ventasTotal = ventasTotalResult.count || 0
            const ventasMes = ventasMesResult.data || []
            const ventas6M = ventas6MResult.data || []
            const recentLeadsData = recentLeadsResult.data || []

            const ingresosMes = ventasMes.reduce((s, r) => s + Number(r.precio_venta || 0), 0)
            const costosMes = ventasMes.reduce((s, r) => s + Number(r.costo_asesor || 0), 0)
            const utilidadMes = ingresosMes - costosMes
            const winRate = leadsTotal > 0 ? (ventasTotal / leadsTotal) * 100 : 0
            
            const inversionesMes = inversionesMesResult?.data || []
            const leadsMesCount = leadsMesResult?.count || 0
            const gastoTotalMes = inversionesMes.reduce((s, i) => s + Number(i.gasto_usd || 0), 0)
            const cplMes = leadsMesCount > 0 ? (gastoTotalMes / leadsMesCount) : 0

            // Speed-to-Lead calculations
            const stlData = speedToLeadResult?.data || []
            const respondTimes = stlData.map(r => Number(r.time_to_respond_mins)).filter(n => !isNaN(n) && n >= 0)
            const avgResponseMins = respondTimes.length > 0 ? respondTimes.reduce((a, b) => a + b, 0) / respondTimes.length : null
            const fastLeads = respondTimes.filter(t => t <= 5).length
            const totalResponded = respondTimes.length
            const sleepingLeads = sleepingLeadsResult?.count || 0

            // Build 6-month chart
            const monthsMap = {}
            for (let i = 0; i < 6; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
                let label = d.toLocaleDateString('es-PE', { month: 'short' })
                label = label.charAt(0).toUpperCase() + label.slice(1)
                monthsMap[label] = { name: label, Ingresos: 0, Costos: 0, Utilidad: 0 }
            }
            ventas6M.forEach(r => {
                let label = new Date(r.created_at).toLocaleDateString('es-PE', { month: 'short' })
                label = label.charAt(0).toUpperCase() + label.slice(1)
                if (monthsMap[label]) {
                    monthsMap[label].Ingresos += Number(r.precio_venta || 0)
                    monthsMap[label].Costos += Number(r.costo_asesor || 0)
                    monthsMap[label].Utilidad += (Number(r.precio_venta || 0) - Number(r.costo_asesor || 0))
                }
            })
            const cData = []
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
                let label = d.toLocaleDateString('es-PE', { month: 'short' })
                label = label.charAt(0).toUpperCase() + label.slice(1)
                cData.push(monthsMap[label])
            }

            // Top productos — graceful fallback if venta_productos doesn't exist
            let topList = []
            try {
                const { data: rproductos } = await supabase.from('productos').select('nombre, venta_productos!inner(id)').eq('agencia_id', agencia.id)
                const productoCounts = {}
                ;(rproductos || []).forEach(producto => {
                    const name = producto.nombre
                    if (name && producto.venta_productos) productoCounts[name] = (productoCounts[name] || 0) + producto.venta_productos.length
                })
                topList = Object.entries(productoCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([nombre, ventas]) => ({ nombre, ventas }))
            } catch {
                // Table may not exist — not critical
            }

            // Próximas ventas — graceful fallback
            let proxList = []
            try {
                const nextWeek = new Date(today)
                nextWeek.setDate(nextWeek.getDate() + 7)
                const { data: proxRaw } = await supabase
                    .from('productos')
                    .select('nombre, venta_productos!inner(fecha_servicio, ventas:venta_id (cliente_nombre, pax))')
                    .eq('agencia_id', agencia.id)
                    .gte('venta_productos.fecha_servicio', today.toISOString().split('T')[0])
                    .lte('venta_productos.fecha_servicio', nextWeek.toISOString().split('T')[0])
                    // order clause removed as filtering across nested relationships with order is complex, we will sort in memory
                
                let flatProx = []
                ;(proxRaw || []).forEach(producto => {
                    if (producto.venta_productos) {
                        producto.venta_productos.forEach(rt => {
                            flatProx.push({
                                fecha_raw: rt.fecha_servicio,
                                fecha: new Date(rt.fecha_servicio).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }),
                                producto: producto.nombre || 'Desconocido',
                                cliente: rt.ventas?.cliente_nombre || 'Desconocido',
                                pax: rt.ventas?.pax || 1
                            })
                        })
                    }
                })
                proxList = flatProx.sort((a,b) => new Date(a.fecha_raw) - new Date(b.fecha_raw)).slice(0,5)
            } catch {
                // Table may not exist — not critical
            }

            setStats({ leadsHoy, leadsTotal, ventasTotal, ingresosMes, costosMes, utilidadMes, winRate, cplMes, avgResponseMins, sleepingLeads, fastLeads, totalResponded })
            setChartData(cData)
            setTopProductos(topList)
            setProxVentas(proxList)
            setRecentLeads(recentLeadsData)

        } catch (err) {
            console.error('Dashboard load error:', err)
            setError(err?.message || 'No se pudo conectar con la base de datos.')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    const badgeClass = (estado) => `badge badge-${estado}`

    const animStyle = (delay = 0) => ({
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`
    })

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-card" style={{ padding: '12px 16px', borderRadius: '8px', minWidth: '150px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: 'var(--color-text)' }}>{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} style={{ color: entry.color, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>{entry.name}:</span>
                            <span style={{ fontWeight: 600 }}>${Number(entry.value).toLocaleString('en-US')}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
            <style>{`
                @keyframes shimmer { to { background-position: -200% 0; } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div className="page-header" style={{ marginBottom: 32 }}>
                <h1 className="page-title" style={{ fontSize: '2rem', background: 'linear-gradient(to right, #fff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Dashboard BI
                </h1>
                <p className="page-subtitle" style={{ fontSize: '1rem' }}>Inteligencia de Negocios & Operaciones</p>
            </div>

            {/* ─── ELITE ERROR BANNER ─── */}
            {error && <DashboardError message={error} onRetry={loadDashboard} />}

            {/* ─── KPI SKELETON or REAL DATA ─── */}
            {loading ? (
                <div className="kpi-grid" style={{ marginBottom: 32 }}>
                    {[0, 1, 2, 3, 4].map(i => <SkeletonCard key={i} height={120} />)}
                </div>
            ) : (
                <>
                <div className="kpi-grid">
                    <div className="kpi-card kpi-card-hero" style={animStyle(0)}>
                        <div className="kpi-card-label">
                            <span style={{ color: 'var(--color-success)', fontSize: '1.2rem' }}>💰</span> Utilidad Neta (Mes)
                        </div>
                        <div className="kpi-card-value success" style={{ fontSize: '2.5rem' }}>
                            {formatCurrency(stats.utilidadMes)}
                        </div>
                        <div className="kpi-card-sub">Ingresos Reales - Costos de Op.</div>
                    </div>

                    <div className="kpi-card" style={animStyle(100)}>
                        <div className="kpi-card-label">
                            <span style={{ color: 'var(--color-info)', fontSize: '1.2rem' }}>📈</span> Ingresos Brutos
                        </div>
                        <div className="kpi-card-value">{formatCurrency(stats.ingresosMes)}</div>
                        <div className="kpi-card-sub">
                            Costos Asesor: <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(stats.costosMes)}</span>
                        </div>
                    </div>

                    <div className="kpi-card" style={animStyle(200)}>
                        <div className="kpi-card-label">
                            <span style={{ color: 'var(--color-warning)', fontSize: '1.2rem' }}>🎯</span> Win Rate
                        </div>
                        <div className="kpi-card-value">{stats.winRate.toFixed(1)}%</div>
                        <div className="kpi-card-sub">
                            {stats.ventasTotal} ventas de {stats.leadsTotal} leads totales
                        </div>
                    </div>

                    <div className="kpi-card" style={animStyle(300)}>
                        <div className="kpi-card-label">
                            <span style={{ color: 'var(--color-accent)', fontSize: '1.2rem' }}>🔥</span> Leads Hoy
                        </div>
                        <div className="kpi-card-value">{stats.leadsHoy}</div>
                        <div className="kpi-card-sub">Nuevas oportunidades en embudo</div>
                    </div>
                </div>
                
                <div className="kpi-grid" style={{ marginTop: '20px' }}>
                    <div className="kpi-card" style={animStyle(400)}>
                        <div className="kpi-card-label">
                            <span style={{ color: 'var(--color-primary)', fontSize: '1.2rem' }}>💸</span> CPL Promedio (Gasto / Lead)
                        </div>
                        <div className="kpi-card-value">${stats.cplMes.toFixed(2)}</div>
                        <div className="kpi-card-sub">Costo de adquisición de leads global activo este mes</div>
                    </div>
                </div>

                {/* ─── SPEED-TO-LEAD SECTION ─── */}
                <div style={{
                    ...animStyle(500),
                    marginTop: 28,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))',
                    border: '1px solid rgba(99,102,241,0.15)',
                    borderRadius: 16, padding: '24px 28px',
                    position: 'relative', overflow: 'hidden'
                }}>
                    {/* Decorative glow */}
                    <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent)', pointerEvents: 'none' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>⚡</div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-text)', fontWeight: 700 }}>Speed-to-Lead</h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Velocidad de respuesta a prospectos este mes</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        {/* Avg Response Time */}
                        <div style={{
                            background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '18px 16px',
                            border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Tiempo Promedio</div>
                            <div style={{
                                fontSize: '2rem', fontWeight: 800, lineHeight: 1,
                                color: stats.avgResponseMins === null ? 'var(--color-text-muted)'
                                    : stats.avgResponseMins <= 5 ? '#10b981'
                                    : stats.avgResponseMins <= 30 ? '#f59e0b'
                                    : '#ef4444'
                            }}>
                                {stats.avgResponseMins === null ? '—' : stats.avgResponseMins < 60 ? `${Math.round(stats.avgResponseMins)}m` : `${(stats.avgResponseMins / 60).toFixed(1)}h`}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                                {stats.avgResponseMins === null ? 'Sin datos' : stats.avgResponseMins <= 5 ? '🟢 Excelente' : stats.avgResponseMins <= 30 ? '🟡 Aceptable' : '🔴 Muy lento'}
                            </div>
                        </div>

                        {/* Sleeping Leads */}
                        <div style={{
                            background: stats.sleepingLeads > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.15)',
                            borderRadius: 12, padding: '18px 16px',
                            border: stats.sleepingLeads > 0 ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(255,255,255,0.04)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: stats.sleepingLeads > 0 ? '#f87171' : 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Leads Dormidos</div>
                            <div style={{
                                fontSize: '2rem', fontWeight: 800, lineHeight: 1,
                                color: stats.sleepingLeads > 0 ? '#ef4444' : '#10b981',
                                animation: stats.sleepingLeads > 0 ? 'pulse 2s ease-in-out infinite' : 'none'
                            }}>
                                {stats.sleepingLeads}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                                {stats.sleepingLeads > 0 ? '🚨 Sin contactar aún' : '✅ Todos atendidos'}
                            </div>
                        </div>

                        {/* Fast Response Rate */}
                        <div style={{
                            background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '18px 16px',
                            border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Respuesta {'<'}5 min</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#10b981' }}>
                                {stats.totalResponded > 0 ? `${Math.round((stats.fastLeads / stats.totalResponded) * 100)}%` : '—'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                                {stats.fastLeads} de {stats.totalResponded} leads
                            </div>
                        </div>

                        {/* Total Responded */}
                        <div style={{
                            background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '18px 16px',
                            border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Leads Contactados</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#60a5fa' }}>
                                {stats.totalResponded}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                                Este mes con tiempo registrado
                            </div>
                        </div>
                    </div>
                </div>
                </>
            )}

            {/* ─── MIDDLE: CHART & UPCOMING ─── */}
            <div className="dashboard-middle" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ ...animStyle(400), padding: '24px 24px 10px 10px' }}>
                    <h3 className="glass-card-title" style={{ paddingLeft: 14 }}>
                        Curva de Utilidad & Ingresos (6 Meses)
                    </h3>
                    {loading ? (
                        <SkeletonCard height={350} />
                    ) : (
                        <div style={{ height: 350, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9096a8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9096a8', fontSize: 12 }} tickFormatter={(val) => `$${val / 1000}k`} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="Ingresos" stroke="#60a5fa" strokeWidth={2} fillOpacity={1} fill="url(#colorIngresos)" />
                                    <Area type="monotone" dataKey="Utilidad" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorUtilidad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="glass-card" style={{ ...animStyle(500), display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="glass-card-title" style={{ margin: 0 }}>Operaciones a 7 Días</h3>
                        <span className="badge badge-nuevo">{proxVentas.length} Productos</span>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[0, 1, 2].map(i => <SkeletonCard key={i} height={52} />)}
                        </div>
                    ) : proxVentas.length === 0 ? (
                        <div className="empty-state" style={{ flex: 1, padding: '24px 0' }}>
                            <div className="empty-state-text">No hay productos programados para esta semana.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {proxVentas.map((pr, idx) => (
                                <div key={idx} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.02)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center', background: 'var(--color-accent-soft)', padding: '6px 10px', borderRadius: 8, color: 'var(--color-accent)', minWidth: 60 }}>
                                        <div style={{ fontSize: '0.7rem', textTransform: 'capitalize', fontWeight: 600, marginBottom: -2 }}>{pr.fecha.split(',')[0]}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{pr.fecha.split(' ')[1]}</div>
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.producto}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {pr.cliente}</div>
                                    </div>
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>{pr.pax} und.</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── BOTTOM: TOP TOURS & RECENT LEADS ─── */}
            <div className="dashboard-bottom" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <div className="glass-card" style={animStyle(600)}>
                    <h3 className="glass-card-title">🏆 Top 3 Productos Estrella</h3>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[0, 1, 2].map(i => <SkeletonCard key={i} height={40} />)}
                        </div>
                    ) : topProductos.length === 0 ? (
                        <div className="empty-state" style={{ padding: '20px 0' }}>
                            <div className="empty-state-text">No hay data suficiente</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {topProductos.map((t, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : '#cd7f32', opacity: 0.9 }}>
                                        #{idx + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{t.nombre}</div>
                                        <div className="progress-bar" style={{ marginTop: 6 }}>
                                            <div className="progress-bar-fill" style={{ width: `${(t.ventas / topProductos[0].ventas) * 100}%`, background: 'var(--color-info)' }} />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: 40, textAlign: 'right' }}>
                                        {t.ventas} v.
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass-card" style={animStyle(700)}>
                    <h3 className="glass-card-title">Últimos Leads (Adquisición)</h3>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={44} />)}
                        </div>
                    ) : recentLeads.length === 0 ? (
                        <div className="empty-state" style={{ padding: '20px 0' }}>
                            <div className="empty-state-text">Aún no hay leads registrados.</div>
                        </div>
                    ) : (
                        <div className="table-container" style={{ borderRadius: 8, background: 'rgba(0,0,0,0.1)' }}>
                            <table className="data-table" style={{ background: 'transparent' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: 'rgba(255,255,255,0.02)' }}>Nombre</th>
                                        <th style={{ background: 'rgba(255,255,255,0.02)' }}>Origen</th>
                                        <th style={{ background: 'rgba(255,255,255,0.02)' }}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentLeads.map(lead => (
                                        <tr key={lead.id}>
                                            <td style={{ color: 'var(--color-text)', fontWeight: 500 }}>{lead.nombre}</td>
                                            <td><span style={{ opacity: 0.8, fontSize: '0.85rem' }}>{lead.origen}</span></td>
                                            <td><span className={badgeClass(lead.estado)}>{lead.estado}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
