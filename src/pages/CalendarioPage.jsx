import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO_COLORS = {
    pendiente: { bg: 'var(--color-warning-soft)', color: 'var(--color-warning)', dot: 'var(--color-warning)' },
    confirmada: { bg: 'var(--color-success-soft)', color: 'var(--color-success)', dot: 'var(--color-success)' },
    completada: { bg: 'var(--color-info-soft)', color: 'var(--color-info)', dot: 'var(--color-info)' },
    cancelada: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)', dot: 'var(--color-danger)' },
}

export default function CalendarioPage() {
    const { agencia } = useAuth()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [ventaProductos, setVentaProductos] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState(null)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    async function loadVentas() {
        if (!agencia?.id) return
        setLoading(true)
        const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
        const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('venta_productos')
            .select(`
                id,
                fecha_servicio,
                precio_venta,
                ventas!inner (
                    id,
                    cliente_nombre,
                    pax,
                    estado,
                    agencia_id
                ),
                productos (
                    nombre
                )
            `)
            .eq('ventas.agencia_id', agencia.id)
            .gte('fecha_servicio', firstDay)
            .lte('fecha_servicio', lastDay)
            .order('fecha_servicio')

        if (!error && data) setVentaProductos(data)
        setLoading(false)
    }

    useEffect(() => { 
        if (agencia?.id) loadVentas() 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month, agencia?.id])

    function prevMonth() {
        setCurrentDate(new Date(year, month - 1, 1))
        setSelectedDay(null)
    }

    function nextMonth() {
        setCurrentDate(new Date(year, month + 1, 1))
        setSelectedDay(null)
    }

    function goToday() {
        setCurrentDate(new Date())
        setSelectedDay(null)
    }

    // Build calendar grid
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 // Monday-based
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null) // empty leading cells
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    // Group venta_productos by day
    const ventasByDay = {}
    ventaProductos.forEach(rt => {
        if (!rt.fecha_servicio) return
        const day = new Date(rt.fecha_servicio + 'T12:00:00').getDate()
        if (!ventasByDay[day]) ventasByDay[day] = []
        ventasByDay[day].push(rt)
    })

    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
    const todayDay = today.getDate()

    const selectedVentas = selectedDay ? (ventasByDay[selectedDay] || []) : []

    // Stats for the month
    const uniqueBookings = new Set(ventaProductos.map(rt => rt.ventas?.id).filter(Boolean))
    const totalVentas = uniqueBookings.size
    const uniqueVentasArray = Array.from(new Map(ventaProductos.filter(rt => rt.ventas).map(rt => [rt.ventas.id, rt.ventas])).values())
    const totalPax = uniqueVentasArray.reduce((s, r) => s + (r?.pax || 0), 0)
    const totalIngresos = ventaProductos.reduce((s, rt) => s + Number(rt.precio_venta || 0), 0)

    return (
        <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Calendario</h1>
                    <p className="page-subtitle">Vista mensual de productos programados</p>
                </div>
            </div>

            <div className="page-body">
                {/* Monthly Stats */}
                <div className="stats-grid" style={{ marginBottom: 20 }}>
                    <div className="stat-card">
                        <div className="stat-card-label">Ventas del Mes</div>
                        <div className="stat-card-value">{totalVentas}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Total Unidades</div>
                        <div className="stat-card-value">{totalPax}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Ingresos del Mes</div>
                        <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>${totalIngresos.toFixed(0)}</div>
                    </div>
                </div>

                {/* Calendar Navigation */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 16, gap: 12
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>◀</button>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, minWidth: 200, textAlign: 'center' }}>
                            {MONTHS[month]} {year}
                        </h2>
                        <button className="btn btn-secondary btn-sm" onClick={nextMonth}>▶</button>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={goToday}>Hoy</button>
                </div>

                {/* Calendar Grid */}
                <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    background: 'var(--color-bg-card)'
                }}>
                    {/* Day headers */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                        background: 'var(--color-bg-elevated)',
                        borderBottom: '1px solid var(--color-border)'
                    }}>
                        {DAYS.map(d => (
                            <div key={d} style={{
                                padding: '10px 8px', textAlign: 'center',
                                fontSize: '0.75rem', fontWeight: 600,
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                color: 'var(--color-text-muted)'
                            }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {cells.map((day, i) => {
                            const dayVentas = day ? (ventasByDay[day] || []) : []
                            const isToday = isCurrentMonth && day === todayDay
                            const isSelected = day === selectedDay

                            return (
                                <div
                                    key={i}
                                    onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                                    style={{
                                        minHeight: 90,
                                        padding: '6px 8px',
                                        borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--color-border)',
                                        borderBottom: '1px solid var(--color-border)',
                                        cursor: day ? 'pointer' : 'default',
                                        background: isSelected ? 'var(--color-accent-soft)' : day ? 'transparent' : 'var(--color-bg)',
                                        transition: 'background 150ms ease',
                                    }}
                                    onMouseEnter={(e) => { if (day && !isSelected) e.currentTarget.style.background = 'var(--color-bg-hover)' }}
                                    onMouseLeave={(e) => { if (day && !isSelected) e.currentTarget.style.background = 'transparent' }}
                                >
                                    {day && (
                                        <>
                                            <div style={{
                                                fontSize: '0.82rem',
                                                fontWeight: isToday ? 700 : 500,
                                                color: isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                                marginBottom: 4,
                                                display: 'flex', alignItems: 'center', gap: 6,
                                            }}>
                                                {isToday && (
                                                    <span style={{
                                                        width: 22, height: 22,
                                                        background: 'var(--color-accent)',
                                                        color: 'white', borderRadius: '50%',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.75rem', fontWeight: 700,
                                                    }}>{day}</span>
                                                )}
                                                {!isToday && day}
                                            </div>
                                            {dayVentas.slice(0, 3).map(rt => {
                                                const r = rt.ventas || {}
                                                const colors = ESTADO_COLORS[r.estado] || ESTADO_COLORS.pendiente
                                                return (
                                                    <div key={rt.id} style={{
                                                        background: colors.bg,
                                                        color: colors.color,
                                                        fontSize: '0.68rem',
                                                        fontWeight: 600,
                                                        padding: '2px 6px',
                                                        borderRadius: 4,
                                                        marginBottom: 2,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        borderLeft: `3px solid ${colors.dot}`,
                                                    }}>
                                                        {r.cliente_nombre?.split(' ')[0] || 'Sin nombre'}
                                                    </div>
                                                )
                                            })}
                                            {dayVentas.length > 3 && (
                                                <div style={{
                                                    fontSize: '0.65rem', color: 'var(--color-text-muted)',
                                                    textAlign: 'center', marginTop: 2,
                                                }}>
                                                    +{dayVentas.length - 3} más
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div style={{
                    display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap',
                    fontSize: '0.75rem', color: 'var(--color-text-secondary)'
                }}>
                    {Object.entries(ESTADO_COLORS).map(([estado, colors]) => (
                        <div key={estado} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: colors.dot, display: 'inline-block'
                            }} />
                            {estado.charAt(0).toUpperCase() + estado.slice(1)}
                        </div>
                    ))}
                </div>

                {/* Selected Day Detail Panel */}
                {selectedDay && (
                    <div style={{
                        marginTop: 20, animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <h3 style={{
                            fontSize: '1rem', fontWeight: 700, marginBottom: 12,
                            borderBottom: '1px solid var(--color-border)', paddingBottom: 8,
                        }}>
                            📅 {selectedDay} de {MONTHS[month]} — {selectedVentas.length} venta{selectedVentas.length !== 1 ? 's' : ''}
                        </h3>

                        {selectedVentas.length === 0 ? (
                            <div style={{
                                padding: '24px 16px', textAlign: 'center',
                                color: 'var(--color-text-muted)', fontSize: '0.9rem'
                            }}>
                                No hay productos programados para este día.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {selectedVentas.map(rt => {
                                    const r = rt.ventas || {}
                                    const t = rt.productos || {}
                                    return (
                                        <div key={rt.id} className="card" style={{
                                            display: 'grid', gridTemplateColumns: '1fr auto',
                                            alignItems: 'center', gap: 16, padding: '14px 18px',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                                                    {r.cliente_nombre || 'Sin nombre'}
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 8, fontWeight: 400 }}>
                                                        ({r.estado})
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                                                    {t.nombre || 'Producto Múltiple'} <span style={{ opacity: 0.5 }}>•</span> {r.pax} und. <span style={{ opacity: 0.5 }}>•</span> ${Number(rt.precio_venta || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {loading && (
                    <div style={{
                        position: 'fixed', bottom: 20, right: 20,
                        background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                        fontSize: '0.82rem', color: 'var(--color-text-secondary)',
                        boxShadow: 'var(--shadow-md)',
                    }}>
                        Cargando calendario…
                    </div>
                )}
            </div>
        </>
    )
}
