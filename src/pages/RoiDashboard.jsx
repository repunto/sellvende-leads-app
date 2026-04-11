/**
 * RoiDashboard.jsx — Analítica y ROI Dashboard
 * 
 * Cruza leads (con UTM tracking) contra ventas cerradas e inversión
 * publicitaria para calcular ROAS, CPL y CAC por campaña/mes.
 * 
 * Auditoría 2026-04-09: Refactorizado para rendimiento O(N+M),
 * responsive design, y UX profesional de drawer lateral.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

/** Retorna color semáforo según umbral de ROAS */
const roasColor = (v) => v >= 3 ? '#10b981' : v >= 1 ? '#f59e0b' : '#ef4444'

export default function RoiDashboard() {
    const { agencia } = useAuth()
    const [roasData, setRoasData] = useState([])
    const [loading, setLoading] = useState(true) // FIX #10: inicia true para evitar flash
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        utm_campaign: '',
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        gasto_usd: ''
    })
    const [toastMsg, setToastMsg] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 4000)
    }

    // ── Escape key handler (FIX #5) ─────────────────────────────
    const handleEscape = useCallback((e) => {
        if (e.key === 'Escape' && showForm) setShowForm(false)
    }, [showForm])

    useEffect(() => {
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [handleEscape])

    // ── Data loading ────────────────────────────────────────────
    useEffect(() => {
        if (agencia?.id) loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia?.id])

    async function loadData() {
        setLoading(true)
        try {
            const [invResp, leadsResp, ventasResp] = await Promise.all([
                supabase
                    .from('inversion_marketing')
                    .select('id, campana_origen, mes, anio, gasto_usd')
                    .eq('agencia_id', agencia.id)
                    .order('anio', { ascending: false })
                    .order('mes', { ascending: false }),
                supabase
                    .from('leads')
                    .select('id, origen, utm_campaign, created_at')
                    .eq('agencia_id', agencia.id),
                supabase
                    .from('ventas')
                    .select('id, lead_id, precio_venta, estado')
                    .eq('agencia_id', agencia.id)
                    .in('estado', ['confirmada', 'completada', 'pagada', 'cerrada'])
            ])

            const inv = invResp.data || []
            const leads = leadsResp.data || []
            const ventas = ventasResp.data || []

            // ── FIX #3: Index Map O(M) en vez de filter O(N×M) ──
            const ventasByLead = new Map()
            ventas.forEach(v => {
                if (!ventasByLead.has(v.lead_id)) ventasByLead.set(v.lead_id, [])
                ventasByLead.get(v.lead_id).push(v)
            })

            // Agrupar leads por campaña + periodo
            const groups = {}

            leads.forEach(l => {
                const dt = new Date(l.created_at)
                const m = dt.getMonth() + 1
                const y = dt.getFullYear()
                const campana = l.utm_campaign?.trim() || l.origen?.trim() || 'Desconocido'
                const key = `${campana}_${m}_${y}`

                if (!groups[key]) {
                    groups[key] = {
                        campana,
                        mes: m,
                        anio: y,
                        leadsCount: 0,
                        ventasCount: 0,
                        ingresos: 0,
                        gasto_usd: 0,
                        inv_id: null
                    }
                }

                groups[key].leadsCount += 1

                // O(1) lookup vs O(M) filter anterior
                const sales = ventasByLead.get(l.id) || []
                groups[key].ventasCount += sales.length
                groups[key].ingresos += sales.reduce((sum, s) => sum + (Number(s.precio_venta) || 0), 0)
            })

            // Superponer inversión publicitaria
            inv.forEach(i => {
                const key = `${i.campana_origen?.trim()}_${i.mes}_${i.anio}`
                if (groups[key]) {
                    groups[key].gasto_usd = Number(i.gasto_usd)
                    groups[key].inv_id = i.id
                } else {
                    groups[key] = {
                        campana: i.campana_origen,
                        mes: i.mes,
                        anio: i.anio,
                        leadsCount: 0,
                        ventasCount: 0,
                        ingresos: 0,
                        gasto_usd: Number(i.gasto_usd),
                        inv_id: i.id
                    }
                }
            })

            const computed = Object.values(groups).map(g => {
                const cpl = g.leadsCount > 0 ? g.gasto_usd / g.leadsCount : 0
                const cac = g.ventasCount > 0 ? g.gasto_usd / g.ventasCount : 0
                const roas = g.gasto_usd > 0 ? g.ingresos / g.gasto_usd : 0
                return { ...g, cpl, cac, roas }
            }).sort((a, b) => {
                if (a.anio !== b.anio) return b.anio - a.anio
                if (a.mes !== b.mes) return b.mes - a.mes
                return b.roas - a.roas
            })

            setRoasData(computed)
        } catch (err) {
            console.error('Error loading ROI data:', err)
            showToast('Error cargando datos de ROI', 'error')
        } finally {
            setLoading(false)
        }
    }

    // ── KPI Totals (memoized) ───────────────────────────────────
    const kpis = useMemo(() => {
        const totalInv = roasData.reduce((a, c) => a + Number(c.gasto_usd), 0)
        const totalLeads = roasData.reduce((a, c) => a + c.leadsCount, 0)
        const totalVentas = roasData.reduce((a, c) => a + c.ventasCount, 0)
        const totalRevenue = roasData.reduce((a, c) => a + c.ingresos, 0)
        return {
            totalInv,
            totalLeads,
            totalVentas,
            totalRevenue,
            overallCPL: totalLeads > 0 ? totalInv / totalLeads : 0,
            overallCAC: totalVentas > 0 ? totalInv / totalVentas : 0,
            overallROAS: totalInv > 0 ? totalRevenue / totalInv : 0,
        }
    }, [roasData])

    // ── Formulario Drawer ───────────────────────────────────────
    function openForm(row = null) {
        if (row?.inv_id) {
            setEditingId(row.inv_id)
            setForm({ utm_campaign: row.campana, mes: row.mes, anio: row.anio, gasto_usd: row.gasto_usd })
        } else if (row) {
            setEditingId(null)
            setForm({ utm_campaign: row.campana, mes: row.mes, anio: row.anio, gasto_usd: '' })
        } else {
            setEditingId(null)
            setForm({ utm_campaign: '', mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), gasto_usd: '' })
        }
        setShowForm(true)
    }

    async function handleSave() {
        if (!form.utm_campaign?.trim() || !form.gasto_usd) return
        try {
            const payload = {
                campana_origen: form.utm_campaign.trim(),
                mes: form.mes,
                anio: form.anio,
                gasto_usd: parseFloat(form.gasto_usd),
                agencia_id: agencia.id
            }
            if (editingId) {
                const { error } = await supabase.from('inversion_marketing').update(payload).eq('id', editingId)
                if (error) throw error
                showToast('Inversión actualizada ✅')
            } else {
                const { error } = await supabase.from('inversion_marketing').insert([payload])
                if (error) throw error
                showToast('Inversión registrada ✅')
            }
            setShowForm(false)
            loadData()
        } catch (err) {
            showToast('Error: ' + err.message, 'error')
        }
    }

    return (
        <div className="page-container">
            {toastMsg && <div className={`toast toast-${toastMsg.type}`}>{toastMsg.msg}</div>}

            <div className="page-header">
                <div>
                    <h1 className="page-title">📈 Analítica y ROI Dashboard</h1>
                    <p className="page-subtitle">Mide el rendimiento exacto por campaña UTM. Agrega tu gasto publicitario y calcula tu ROAS en tiempo real.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => openForm(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <span style={{ fontSize: '1.2rem' }}>💰</span> Asignar Presupuesto
                </button>
            </div>

            {/* ── Global KPIs (FIX #6: responsive grid) ────────── */}
            {roasData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 32 }}>
                    {[
                        { label: 'Gasto Total', value: `$${kpis.totalInv.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#ef4444' },
                        { label: 'Leads UTM', value: kpis.totalLeads.toLocaleString(), color: '#3b82f6' },
                        { label: 'Ventas Reales', value: kpis.totalVentas.toLocaleString(), color: '#8b5cf6' },
                        { label: 'CPL', value: `$${kpis.overallCPL.toFixed(2)}`, color: '#f59e0b' },
                        { label: 'CAC', value: `$${kpis.overallCAC.toFixed(2)}`, color: '#ec4899' },
                        { label: 'ROAS Global', value: `${kpis.overallROAS.toFixed(2)}x`, color: roasColor(kpis.overallROAS) },
                    ].map((kpi, i) => (
                        <div key={i} className="card" style={{ padding: '20px', textAlign: 'center', borderTop: `3px solid ${kpi.color}` }}>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 700 }}>{kpi.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Table ─────────────────────────────────────────── */}
            {loading ? (
                <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    Calculando Atribución y ROAS...
                </div>
            ) : roasData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{ fontSize: '3rem' }}>🎯</div>
                    <h3>No hay campañas con UTMs o inversión registradas aún.</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>Asigna presupuesto a tus campañas para comenzar a ver métricas.</p>
                </div>
            ) : (
                <div className="card" style={{ overflow: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '16px' }}>Campaña (UTM / Origen)</th>
                                <th style={{ textAlign: 'center' }}>Período</th>
                                <th style={{ textAlign: 'center' }}>Leads</th>
                                <th style={{ textAlign: 'center' }}>Ventas</th>
                                <th style={{ textAlign: 'right' }}>Ingresos</th>
                                <th style={{ textAlign: 'right' }}>Gasto Ads</th>
                                <th style={{ textAlign: 'right' }}>CPL</th>
                                <th style={{ textAlign: 'right' }}>CAC</th>
                                <th style={{ textAlign: 'center' }}>ROAS</th>
                                <th style={{ textAlign: 'center' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roasData.map((row, i) => (
                                <tr key={`${row.campana}_${row.mes}_${row.anio}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '16px', fontWeight: 700, color: 'var(--color-text)' }}>{row.campana}</td>
                                    <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                        {MESES[row.mes - 1]} {row.anio}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.leadsCount}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#8b5cf6' }}>{row.ventasCount}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                        ${row.ingresos.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                        {row.gasto_usd > 0 ? `$${row.gasto_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>${row.cpl.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                                        {row.ventasCount > 0 ? `$${row.cac.toFixed(2)}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                            fontWeight: 900,
                                            padding: '4px 12px',
                                            borderRadius: 20,
                                            background: `${roasColor(row.roas)}18`,
                                            color: roasColor(row.roas)
                                        }}>
                                            {row.roas > 0 ? `${row.roas.toFixed(2)}x` : (row.ingresos > 0 && row.gasto_usd === 0 ? 'INF🚀' : '—')}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => openForm(row)}>
                                            {row.inv_id ? '✏️ Editar' : '💰 Asignar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── FIX #5: Drawer con overlay + animación ────────── */}
            {showForm && (
                <>
                    {/* Overlay backdrop */}
                    <div
                        onClick={() => setShowForm(false)}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(2px)',
                            zIndex: 9998,
                            animation: 'fadeIn 0.2s ease'
                        }}
                    />
                    {/* Drawer */}
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
                        background: 'var(--color-surface)', zIndex: 9999,
                        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                        borderLeft: '1px solid var(--color-border)',
                        padding: 30, display: 'flex', flexDirection: 'column',
                        animation: 'slideInRight 0.25s ease'
                    }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {editingId ? 'Actualizar Gasto' : 'Asignar Gasto a Campaña'}
                            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.4rem', cursor: 'pointer', padding: '4px' }}>✕</button>
                        </h2>

                        <div className="form-group">
                            <label>UTM Campaign / Origen</label>
                            <input className="form-input" value={form.utm_campaign} onChange={e => setForm({ ...form, utm_campaign: e.target.value })} placeholder="Ej: Q4_Promo_2026" />
                            <small className="help-text">El ID de campaña que se cruza con los leads UTM.</small>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Mes</label>
                                <select className="form-input" value={form.mes} onChange={e => setForm({ ...form, mes: parseInt(e.target.value) })}>
                                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Año</label>
                                <input type="number" className="form-input" value={form.anio} onChange={e => setForm({ ...form, anio: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Gasto en Ads (USD) 💸</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-input"
                                style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}
                                value={form.gasto_usd}
                                onChange={e => setForm({ ...form, gasto_usd: e.target.value })}
                                placeholder="150.00"
                            />
                        </div>

                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Guardar Gasto</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
