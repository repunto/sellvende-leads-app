import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import MetaCalculator from '../components/finanzas/MetaCalculator'


const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const FUENTES_COMUNES = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'Instagram Ads', 'YouTube Ads', 'LinkedIn Ads', 'Orgánico']

export default function FinanzasPage() {
    const { agencia } = useAuth()
    const [roasData, setRoasData] = useState([])
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        campana_origen: 'Meta Ads',
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        gasto_usd: ''
    })
    const [confirmDialog, setConfirmDialog] = useState(null)
    const [toastMsg, setToastMsg] = useState(null)

    // ── Calculadora de Metas ──────────────────────────────────────────────────
    const [calc, setCalc] = useState({ meta: '', ticket: '', cierre: '' })

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 4000)
    }

    // ── Escape key handler ────────────────────────────────────────────────────
    const handleEscape = useCallback((e) => {
        if (e.key === 'Escape' && showForm) setShowForm(false)
    }, [showForm])

    useEffect(() => {
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [handleEscape])

    useEffect(() => {
        if (agencia?.id) loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia])

    async function loadData() {
        setLoading(true)
        const [invResp, leadsResp, resResp] = await Promise.all([
            supabase.from('inversion_marketing').select('*').eq('agencia_id', agencia.id).order('anio', { ascending: false }).order('mes', { ascending: false }),
            supabase.from('leads').select('id, origen, campaign_name, created_at').eq('agencia_id', agencia.id),
            supabase.from('ventas').select('id, lead_id, precio_venta, estado').eq('agencia_id', agencia.id).in('estado', ['confirmada', 'completada', 'pagada'])
        ])

        const inv = invResp.data || []
        const leads = leadsResp.data || []
        const res = resResp.data || []

        const computed = inv.map(i => {
            const leadsFromInv = leads.filter(l => {
                const dt = new Date(l.created_at)
                const isSameDate = dt.getMonth() + 1 === i.mes && dt.getFullYear() === i.anio
                const matchInv = (name) => name && i.campana_origen && name.toLowerCase().trim() === i.campana_origen.toLowerCase().trim()
                return isSameDate && (matchInv(l.campaign_name) || matchInv(l.origen))
            })
            const numLeads = leadsFromInv.length
            const leadIds = leadsFromInv.map(l => l.id)
            const resFromInv = res.filter(r => r.lead_id && leadIds.includes(r.lead_id))
            const numClientes = resFromInv.length
            const totalVenta = resFromInv.reduce((sum, r) => sum + Number(r.precio_venta || 0), 0)
            const cpl = numLeads > 0 ? (i.gasto_usd / numLeads) : 0
            const cac = numClientes > 0 ? (i.gasto_usd / numClientes) : 0
            const roas = i.gasto_usd > 0 ? (totalVenta / i.gasto_usd) : 0
            return { ...i, numLeads, numClientes, totalVenta, cpl, cac, roas }
        })

        setRoasData(computed)
        setLoading(false)
    }

    function openForm(inv = null) {
        if (inv) {
            setEditingId(inv.id)
            setForm({ campana_origen: inv.campana_origen, mes: inv.mes, anio: inv.anio, gasto_usd: inv.gasto_usd })
        } else {
            setEditingId(null)
            setForm({ campana_origen: 'Meta Ads', mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), gasto_usd: '' })
        }
        setShowForm(true)
    }

    async function handleSave(e) {
        if (e && e.preventDefault) e.preventDefault()
        if (!form.campana_origen || !form.gasto_usd) return
        try {
            const payload = { ...form, gasto_usd: parseFloat(form.gasto_usd), agencia_id: agencia.id }
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

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Registro',
            message: '¿Eliminar este registro de inversión? Los cálculos de ROAS se actualizarán.',
            danger: true,
            confirmLabel: '🗑️ Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                const { error } = await supabase.from('inversion_marketing').delete().eq('id', id)
                if (error) showToast('Error al eliminar', 'error')
                else { showToast('Eliminado'); loadData() }
            }
        })
    }

    // ── KPI Totals ─────────────────────────────────────────────────────────────
    const totalInv     = roasData.reduce((a, c) => a + Number(c.gasto_usd), 0)
    const totalLeads   = roasData.reduce((a, c) => a + c.numLeads, 0)
    const totalVentas  = roasData.reduce((a, c) => a + c.numClientes, 0)
    const totalRevenue = roasData.reduce((a, c) => a + c.totalVenta, 0)
    const overallCPL   = totalLeads > 0 ? totalInv / totalLeads : 0
    const overallCAC   = totalVentas > 0 ? totalInv / totalVentas : 0
    const overallROAS  = totalInv > 0 ? totalRevenue / totalInv : 0

    const roasColor = (v) => v >= 3 ? '#10b981' : v >= 1.5 ? '#f59e0b' : '#ef4444'

    const gastoNum = parseFloat(form.gasto_usd) || 0

    return (
        <div className="page-container">
            {toastMsg && <div className={`toast toast-${toastMsg.type}`}>{toastMsg.msg}</div>}

            {/* ── Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Finanzas & ROAS</h1>
                    <p className="page-subtitle">Inteligencia financiera de tus campañas — Mide el retorno real de cada peso invertido en publicidad.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => openForm(null)}
                    style={{ boxShadow: '0 4px 12px rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <span style={{ fontSize: '1.1rem' }}>+</span> Registrar Inversión
                </button>
            </div>

            {/* ── Global KPI Bar ── */}
            {roasData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 32 }}>
                    {[
                        { label: 'Total Invertido', value: `$${totalInv.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#ef4444', icon: '💸' },
                        { label: 'Total Leads', value: totalLeads.toLocaleString(), color: '#3b82f6', icon: '🎯' },
                        { label: 'Ventas Cerradas', value: totalVentas.toLocaleString(), color: '#8b5cf6', icon: '🏆' },
                        { label: 'Costo por Lead (CPL)', value: `$${overallCPL.toFixed(2)}`, color: '#f59e0b', icon: '📊' },
                        { label: 'Costo por Cliente (CAC)', value: `$${overallCAC.toFixed(2)}`, color: '#ec4899', icon: '👤' },
                        { label: 'ROAS Global', value: `${overallROAS.toFixed(2)}x`, color: roasColor(overallROAS), icon: overallROAS >= 3 ? '🚀' : overallROAS >= 1 ? '📈' : '⚠️' },
                    ].map((kpi, i) => (
                        <div key={i} className="card" style={{ padding: '20px', textAlign: 'center', borderTop: `3px solid ${kpi.color}` }}>
                            <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{kpi.icon}</div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 700 }}>{kpi.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Explainer ── */}
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>💡</div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#3b82f6', marginBottom: 4 }}>¿Cómo funciona el ROAS?</div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                        Registra cuánto gastas en publicidad por campaña y mes. El sistema cruza esos datos con tus Leads y Ventas cerradas para calcular
                        <strong style={{ color: 'var(--color-text)' }}> CPL</strong> (Costo por Lead),
                        <strong style={{ color: 'var(--color-text)' }}> CAC</strong> (Costo de Adquisición) y
                        <strong style={{ color: 'var(--color-text)' }}> ROAS</strong> (Retorno). Un ROAS de
                        <strong style={{ color: '#10b981' }}> 3x</strong> = por cada $1 invertido recuperaste $3.
                    </div>
                </div>
            </div>

            {/* ── Calculadora de Metas ── */}
            <MetaCalculator calc={calc} setCalc={setCalc} />

            {/* ── Data Table ── */}
            {loading ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Calculando ROAS...</p>
                </div>
            ) : roasData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>💰</div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 10 }}>Sin registros de inversión</h3>
                    <p style={{ color: 'var(--color-text-secondary)', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        Empieza registrando cuánto invertiste en Meta Ads este mes. El sistema calculará tu rentabilidad automáticamente.
                    </p>
                    <button className="btn btn-primary" onClick={() => openForm(null)}>+ Registrar Primera Inversión</button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Campaña / Fuente</th>
                                <th style={{ textAlign: 'center' }}>Período</th>
                                <th style={{ textAlign: 'right' }}>Gasto USD</th>
                                <th style={{ textAlign: 'center' }}>Leads</th>
                                <th style={{ textAlign: 'right' }}>CPL</th>
                                <th style={{ textAlign: 'center' }}>Ventas</th>
                                <th style={{ textAlign: 'right' }}>CAC</th>
                                <th style={{ textAlign: 'right' }}>Revenue</th>
                                <th style={{ textAlign: 'center' }}>ROAS</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {roasData.map(row => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: 700 }}>{row.campana_origen}</td>
                                    <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                        {MESES[row.mes - 1]} {row.anio}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                        ${Number(row.gasto_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: 20, padding: '2px 10px', fontWeight: 700, fontSize: '0.85rem' }}>
                                            {row.numLeads}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>${row.cpl.toFixed(2)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', borderRadius: 20, padding: '2px 10px', fontWeight: 700, fontSize: '0.85rem' }}>
                                            {row.numClientes}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                                        {row.numClientes > 0 ? `$${row.cac.toFixed(2)}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                        {row.totalVenta > 0 ? `$${row.totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                            fontWeight: 900, fontSize: '0.95rem',
                                            color: roasColor(row.roas),
                                            background: `${roasColor(row.roas)}18`,
                                            padding: '4px 12px', borderRadius: 20, display: 'inline-block'
                                        }}>
                                            {row.roas > 0 ? `${row.roas.toFixed(2)}x` : '—'}
                                        </span>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openForm(row)}>✏️</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(row.id)} style={{ color: 'var(--color-danger)' }}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PREMIUM SIDE DRAWER — Registrar / Editar Inversión
            ══════════════════════════════════════════════════════ */}
            {showForm && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setShowForm(false)}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(2,6,23,0.7)',
                            backdropFilter: 'blur(5px)',
                            zIndex: 999
                        }}
                    />

                    {/* Drawer Panel */}
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0,
                        width: 500,
                        background: 'var(--color-surface, #1e293b)',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '-32px 0 80px rgba(0,0,0,0.6)',
                        zIndex: 1000,
                        borderLeft: '1px solid rgba(255,255,255,0.06)'
                    }}>

                        {/* ── Drawer Header ── */}
                        <div style={{
                            background: editingId
                                ? 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)'
                                : 'linear-gradient(135deg, #431407 0%, #0f172a 80%)',
                            padding: '24px 28px',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            flexShrink: 0
                        }}>
                            <div style={{ display: 'flex', justify: 'space-between', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    {/* Icon badge */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                                        background: editingId ? 'rgba(59,130,246,0.18)' : 'rgba(249,115,22,0.18)',
                                        border: `1.5px solid ${editingId ? 'rgba(59,130,246,0.35)' : 'rgba(249,115,22,0.35)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.5rem', boxShadow: editingId ? '0 0 20px rgba(59,130,246,0.2)' : '0 0 20px rgba(249,115,22,0.2)'
                                    }}>
                                        {editingId ? '✏️' : '💸'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#f8fafc', letterSpacing: '-0.3px' }}>
                                            {editingId ? 'Editar Inversión' : 'Nueva Inversión Publicitaria'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                                            {editingId ? 'Actualiza los datos de esta campaña' : 'Registra tu gasto en publicidad y calcula tu ROAS'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                                        ESC
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.07)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            color: 'rgba(255,255,255,0.5)',
                                            borderRadius: 9, width: 34, height: 34,
                                            cursor: 'pointer', fontSize: '1.05rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Drawer Body ── */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px' }}>

                            {/* Fuente de campaña */}
                            <div style={{ marginBottom: 28 }}>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: '0.72rem', fontWeight: 800,
                                    textTransform: 'uppercase', letterSpacing: '0.9px',
                                    color: 'var(--color-text-secondary)', marginBottom: 10
                                }}>
                                    📡 Campaña / Plataforma
                                </label>
                                {/* Quick-select chips */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                    {FUENTES_COMUNES.map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setForm({ ...form, campana_origen: f })}
                                            style={{
                                                padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                                                cursor: 'pointer', transition: 'all 0.15s ease', border: '1.5px solid',
                                                background: form.campana_origen === f ? 'var(--color-primary)' : 'transparent',
                                                borderColor: form.campana_origen === f ? 'var(--color-primary)' : 'var(--color-border)',
                                                color: form.campana_origen === f ? '#fff' : 'var(--color-text-secondary)'
                                            }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    style={{
                                        width: '100%', padding: '13px 16px', borderRadius: 12,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1.5px solid var(--color-border)',
                                        color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 600,
                                        outline: 'none', boxSizing: 'border-box'
                                    }}
                                    value={form.campana_origen}
                                    onChange={e => setForm({ ...form, campana_origen: e.target.value })}
                                    placeholder="O escribe el nombre exacto de la fuente..."
                                    required
                                />
                                <div style={{
                                    marginTop: 10, padding: '10px 14px', borderRadius: 10,
                                    background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)',
                                    fontSize: '0.77rem', color: '#60a5fa', lineHeight: 1.6
                                }}>
                                    💡 Este nombre debe coincidir exactamente con el campo <strong>Origen</strong> de tus Leads.
                                </div>
                            </div>

                            {/* Mes + Año */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                                <div>
                                    <label style={{
                                        display: 'block', fontSize: '0.72rem', fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.9px',
                                        color: 'var(--color-text-secondary)', marginBottom: 8
                                    }}>
                                        📅 Mes
                                    </label>
                                    <select
                                        style={{
                                            width: '100%', padding: '13px 16px', borderRadius: 12,
                                            background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--color-border)',
                                            color: 'var(--color-text)', fontSize: '0.92rem', fontWeight: 600,
                                            outline: 'none', cursor: 'pointer', boxSizing: 'border-box'
                                        }}
                                        value={form.mes}
                                        onChange={e => setForm({ ...form, mes: parseInt(e.target.value) })}
                                        required
                                    >
                                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block', fontSize: '0.72rem', fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.9px',
                                        color: 'var(--color-text-secondary)', marginBottom: 8
                                    }}>
                                        🗓️ Año
                                    </label>
                                    <input
                                        type="number" min="2020" max="2035"
                                        style={{
                                            width: '100%', padding: '13px 16px', borderRadius: 12,
                                            background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--color-border)',
                                            color: 'var(--color-text)', fontSize: '0.92rem', fontWeight: 600,
                                            outline: 'none', boxSizing: 'border-box'
                                        }}
                                        value={form.anio}
                                        onChange={e => setForm({ ...form, anio: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Gasto — campo grande rojo */}
                            <div style={{ marginBottom: 28 }}>
                                <label style={{
                                    display: 'block', fontSize: '0.72rem', fontWeight: 800,
                                    textTransform: 'uppercase', letterSpacing: '0.9px',
                                    color: 'var(--color-text-secondary)', marginBottom: 8
                                }}>
                                    💰 Gasto Total (USD)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{
                                        position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
                                        fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', pointerEvents: 'none', lineHeight: 1
                                    }}>$</span>
                                    <input
                                        type="number" min="0" step="0.01"
                                        style={{
                                            width: '100%', padding: '20px 18px 20px 46px',
                                            borderRadius: 14, boxSizing: 'border-box',
                                            background: 'rgba(239,68,68,0.06)',
                                            border: '2px solid rgba(239,68,68,0.25)',
                                            color: '#ef4444', fontSize: '2.2rem', fontWeight: 900,
                                            outline: 'none', letterSpacing: '-0.5px'
                                        }}
                                        value={form.gasto_usd}
                                        onChange={e => setForm({ ...form, gasto_usd: e.target.value })}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>

                            {/* ── Live ROI Preview ── */}
                            {gastoNum > 0 && (
                                <div style={{
                                    borderRadius: 16, overflow: 'hidden',
                                    border: '1px solid rgba(16,185,129,0.2)',
                                    background: 'rgba(15,23,42,0.5)'
                                }}>
                                    <div style={{
                                        padding: '14px 18px',
                                        background: 'linear-gradient(90deg, rgba(16,185,129,0.14), rgba(59,130,246,0.1))',
                                        borderBottom: '1px solid rgba(16,185,129,0.15)',
                                        fontSize: '0.72rem', fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.8px', color: '#10b981'
                                    }}>
                                        ⚡ Para rentabilizar ${gastoNum.toLocaleString('en-US')} necesitas generar...
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                        {[
                                            { label: 'ROAS 2x', mult: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', ok: false },
                                            { label: 'ROAS 3x ✓', mult: 3, color: '#10b981', bg: 'rgba(16,185,129,0.1)', ok: true },
                                            { label: 'ROAS 5x 🚀', mult: 5, color: '#3b82f6', bg: 'rgba(59,130,246,0.09)', ok: false },
                                        ].map((item, i) => (
                                            <div key={i} style={{
                                                padding: '18px 12px', textAlign: 'center',
                                                background: item.bg,
                                                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                            }}>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: item.color, letterSpacing: '-0.5px' }}>
                                                    ${(gastoNum * item.mult).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 4, fontWeight: 700 }}>
                                                    {item.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Drawer Footer ── */}
                        <div style={{
                            padding: '18px 28px',
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                            background: 'rgba(0,0,0,0.2)',
                            display: 'flex', gap: 12, justifyContent: 'flex-end',
                            flexShrink: 0
                        }}>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                style={{
                                    padding: '12px 22px', borderRadius: 10,
                                    border: '1px solid var(--color-border)',
                                    background: 'transparent', color: 'var(--color-text-secondary)',
                                    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                style={{
                                    padding: '12px 28px', borderRadius: 10, border: 'none',
                                    background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                                    color: '#fff', fontSize: '0.92rem', fontWeight: 800,
                                    cursor: 'pointer', boxShadow: '0 4px 18px rgba(249,115,22,0.4)',
                                    display: 'flex', alignItems: 'center', gap: 8
                                }}
                            >
                                💾 {editingId ? 'Actualizar' : 'Registrar Inversión'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            <ConfirmModal
                show={!!confirmDialog}
                title={confirmDialog?.title || ''}
                message={confirmDialog?.message || ''}
                danger={confirmDialog?.danger || false}
                confirmLabel={confirmDialog?.confirmLabel}
                onConfirm={confirmDialog?.onConfirm}
                onClose={() => setConfirmDialog(null)}
            />
        </div>
    )
}
