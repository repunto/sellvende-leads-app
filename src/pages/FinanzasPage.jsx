import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/leads/modals/ConfirmModal'

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

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
        gasto_usd: 0
    })
    const [confirmDialog, setConfirmDialog] = useState(null)
    const [toastMsg, setToastMsg] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 4000)
    }

    useEffect(() => {
        if (agencia?.id) loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia])

    async function loadData() {
        setLoading(true)
        const [invResp, leadsResp, resResp] = await Promise.all([
            supabase.from('inversion_marketing').select('*').eq('agencia_id', agencia.id).order('anio', { ascending: false }).order('mes', { ascending: false }),
            supabase.from('leads').select('id, origen, campaign_name, created_at').eq('agencia_id', agencia.id),
            supabase.from('reservas').select('id, lead_id, precio_venta, estado').eq('agencia_id', agencia.id).in('estado', ['confirmada', 'completada', 'pagada'])
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
            setForm({ campana_origen: 'Meta Ads', mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), gasto_usd: 0 })
        }
        setShowForm(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        try {
            const payload = { ...form, agencia_id: agencia.id }
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

    // ─── KPI Totals ─────────────────────────────────────────────────────────────
    const totalInv      = roasData.reduce((a, c) => a + c.gasto_usd, 0)
    const totalLeads    = roasData.reduce((a, c) => a + c.numLeads, 0)
    const totalVentas   = roasData.reduce((a, c) => a + c.numClientes, 0)
    const totalRevenue  = roasData.reduce((a, c) => a + c.totalVenta, 0)
    const overallCPL    = totalLeads > 0 ? totalInv / totalLeads : 0
    const overallCAC    = totalVentas > 0 ? totalInv / totalVentas : 0
    const overallROAS   = totalInv > 0 ? totalRevenue / totalInv : 0

    const roasColor = (v) => v >= 3 ? '#10b981' : v >= 1.5 ? '#f59e0b' : '#ef4444'

    return (
        <div className="page-container">
            {toastMsg && <div className={`toast toast-${toastMsg.type}`}>{toastMsg.msg}</div>}

            {/* ── Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Finanzas & ROAS</h1>
                    <p className="page-subtitle">Inteligencia financiera de tus campañas publicitarias — Mide el retorno real de cada peso invertido en Meta Ads.</p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm(null)} style={{ boxShadow: '0 4px 12px rgba(250,114,55,0.25)' }}>
                    + Registrar Inversión
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
                            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 700 }}>{kpi.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── ROAS Formula Explainer ── */}
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ fontSize: '1.6rem' }}>💡</div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#3b82f6', marginBottom: 4 }}>¿Cómo funciona el ROAS?</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                        Registra cuánto gastas en publicidad por campaña y mes. El sistema cruza esos datos con tus Leads y Ventas cerradas para calcular automáticamente:
                        <strong style={{ color: 'var(--color-text)' }}> CPL</strong> (Costo por Lead),
                        <strong style={{ color: 'var(--color-text)' }}> CAC</strong> (Costo de Adquisición de Cliente) y
                        <strong style={{ color: 'var(--color-text)' }}> ROAS</strong> (Retorno de Inversión Publicitaria).
                        Un ROAS de <strong style={{ color: '#10b981' }}>3x</strong> significa que por cada $1 invertido recuperaste $3.
                    </div>
                </div>
            </div>

            {/* ── Data Table ── */}
            {loading ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px auto', borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }}></div>
                    <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Calculando ROAS...</p>
                </div>
            ) : roasData.length === 0 ? (
                <div className="elite-empty-state" style={{ marginTop: 32 }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>💰</div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12 }}>Sin registros de inversión</h3>
                    <p style={{ color: 'var(--color-text-secondary)', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
                        Empieza por registrar cuánto invertiste en Meta Ads este mes. El sistema calculará tu rentabilidad automáticamente.
                    </p>
                    <button className="btn btn-primary" onClick={() => openForm(null)}>+ Registrar Primera Inversión</button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Campaña / Fuente</th>
                                <th style={{ textAlign: 'center' }}>Mes / Año</th>
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
                                    <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{MESES[row.mes - 1]} {row.anio}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
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
                                            fontWeight: 900, fontSize: '1rem',
                                            color: roasColor(row.roas),
                                            background: `${roasColor(row.roas)}18`,
                                            padding: '4px 12px', borderRadius: 20,
                                            display: 'inline-block'
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

            {/* ── Form Modal ── */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: 480, padding: '32px', borderRadius: 20 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 24 }}>
                            {editingId ? '✏️ Editar Inversión' : '💸 Registrar Gasto Publicitario'}
                        </h2>
                        <form onSubmit={handleSave}>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Campaña / Fuente de Lead</label>
                                <input
                                    className="form-control"
                                    value={form.campana_origen}
                                    onChange={e => setForm({ ...form, campana_origen: e.target.value })}
                                    placeholder="Ej: Meta Ads, Google Ads, TikTok Ads..."
                                    required
                                />
                                <small style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                                    Debe coincidir exactamente con el campo "Origen" o "Campaña" de tus Leads para que el ROAS se calcule correctamente.
                                </small>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Mes</label>
                                    <select className="form-control" value={form.mes} onChange={e => setForm({ ...form, mes: parseInt(e.target.value) })} required>
                                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Año</label>
                                    <input className="form-control" type="number" min="2020" max="2030" value={form.anio} onChange={e => setForm({ ...form, anio: parseInt(e.target.value) })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gasto (USD)</label>
                                    <input className="form-control" type="number" min="0" step="0.01" value={form.gasto_usd} onChange={e => setForm({ ...form, gasto_usd: parseFloat(e.target.value) })} required />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">💾 Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
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
