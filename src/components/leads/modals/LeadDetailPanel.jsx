import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'

// ── Sub-component: Email timeline with expandable HTML preview ──
function EmailTimeline({ detailEmails }) {
    const [expanded, setExpanded] = useState(null)

    if (!detailEmails || detailEmails.length === 0) {
        return (
            <div>
                <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>📜 Historial de Correos (Timeline)</h3>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', padding: 16, background: 'var(--color-bg-hover)', borderRadius: 8, textAlign: 'center' }}>
                    No hay correos enviados a este lead aún.
                </div>
            </div>
        )
    }

    return (
        <div>
            <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>📜 Historial de Correos (Timeline)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {detailEmails.map(log => {
                    const isExpanded = expanded === log.id
                    const hasHtml = !!(log.cuerpo && log.cuerpo.trim().length > 10)
                    const bodyText = hasHtml
                        ? log.cuerpo.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
                        : null

                    return (
                        <div key={log.id} style={{
                            position: 'relative', paddingLeft: 20,
                            borderLeft: '2px solid var(--color-border)', paddingBottom: 16
                        }}>
                            {/* Timeline dot */}
                            <div style={{
                                position: 'absolute', left: -7, top: 0, width: 12, height: 12, borderRadius: '50%',
                                background: log.estado === 'enviado' ? '#10b981' : log.estado === 'fallido' ? '#ef4444' : '#f59e0b',
                                border: '2px solid var(--color-bg)'
                            }} />

                            {/* Date + type */}
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                                {new Date(log.created_at).toLocaleString('es-PE')} •{' '}
                                {log.tipo === 'secuencia' ? '🤖 Automático' : '👤 Manual'}
                                {' • '}
                                <span style={{
                                    color: log.estado === 'enviado' ? '#10b981' : '#ef4444',
                                    fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem'
                                }}>{log.estado}</span>
                            </div>

                            {/* Subject */}
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 6 }}>
                                {log.asunto || '(sin asunto)'}
                            </div>

                            {/* Body preview + toggle */}
                            {hasHtml ? (
                                <div>
                                    {!isExpanded && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-hover)', padding: '8px 10px', borderRadius: 6, lineHeight: 1.4, marginBottom: 6 }}>
                                            {bodyText}…
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                                        style={{
                                            background: 'transparent', border: '1px solid var(--color-border)',
                                            color: 'var(--color-primary)', fontSize: '0.75rem', padding: '3px 10px',
                                            borderRadius: 6, cursor: 'pointer', marginBottom: isExpanded ? 8 : 0
                                        }}
                                    >
                                        {isExpanded ? '▲ Ocultar preview' : '👁 Ver correo completo'}
                                    </button>
                                    {isExpanded && (
                                        <iframe
                                            srcDoc={log.cuerpo}
                                            style={{
                                                width: '100%', height: 420, border: '1px solid var(--color-border)',
                                                borderRadius: 8, background: '#fff'
                                            }}
                                            sandbox="allow-same-origin"
                                            title="Preview del correo enviado"
                                        />
                                    )}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '6px 10px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
                                    ⚠️ Este registro no tiene preview (enviado antes de la actualización)
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function LeadDetailPanel({
    detailLead, setDetailLead, openForm, handleWhatsAppClick,
    getLeadScore, badgeClass, getColdLevel, leadSecuencia,
    secuencias, handleAssignSecuencia, forceNextDripStep, detailEmails,
    handleIndividualEmailClick, emailTemplates = []
}) {
    const [selectedPanelTemplate, setSelectedPanelTemplate] = useState('')
    const [bounceLoading, setBounceLoading]                 = useState(false)

    // Sort templates alphabetically so the list is deterministic
    const sortedTemplates = [...emailTemplates].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))

    // ── Toggle email_rebotado on/off ──────────────────────────────────────────
    const handleToggleBounce = useCallback(async () => {
        if (!detailLead) return
        setBounceLoading(true)
        const nowBounced = !detailLead.email_rebotado
        try {
            const update = nowBounced
                ? { email_rebotado: true, fecha_rebote: new Date().toISOString(), motivo_rebote: 'Marcado manualmente', estado: 'correo_falso' }
                : { email_rebotado: false, fecha_rebote: null, motivo_rebote: null }
            const { error } = await supabase.from('leads').update(update).eq('id', detailLead.id)
            if (error) throw error
            // If marking as bounced, cancel active sequences
            if (nowBounced) {
                await supabase.from('leads_secuencias')
                    .update({ estado: 'cancelada' })
                    .eq('lead_id', detailLead.id)
                    .in('estado', ['en_progreso', 'pausado'])
            }
            // Update local panel state immediately (Realtime will sync the parent)
            setDetailLead(prev => ({ ...prev, ...update }))
        } catch (e) {
            alert('Error al actualizar: ' + e.message)
        } finally {
            setBounceLoading(false)
        }
    }, [detailLead, setDetailLead])

    useEffect(() => {
        if (!detailLead) return
        // Auto-preselect the first sorted template if available
        if (sortedTemplates.length > 0) {
            setTimeout(() => setSelectedPanelTemplate(sortedTemplates[0].id), 0)
        }
        const handle = (e) => { if (e.key === 'Escape') setDetailLead(null) }
        document.addEventListener('keydown', handle, true)
        return () => document.removeEventListener('keydown', handle, true)
    }, [detailLead, setDetailLead])

    if (!detailLead) return null

    // Score helpers (getLeadScore returns 1-5)
    const score = getLeadScore(detailLead)
    const scoreData = score >= 4
        ? { icon: '🔥', text: 'Hot', color: '#ef4444' }
        : score >= 2
        ? { icon: '⭐', text: 'Warm', color: '#f59e0b' }
        : { icon: '❄️', text: 'Cold', color: '#3b82f6' }

    // "Secuencia anterior" label - hide name if unknown
    const seqName = leadSecuencia?.secuencias_marketing?.nombre
    const seqLabel = seqName || null  // null means we skip the name

    return (
        <>
            <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setDetailLead(null)}></div>
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 450,
                background: 'var(--color-bg)', zIndex: 99999, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)',
                display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out'
            }}>
                {/* ── Header ── */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--color-bg-card)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--color-text)' }}>{detailLead.nombre}</h2>
                            <span className={badgeClass(detailLead.estado)}>{detailLead.estado}</span>
                            {getColdLevel(detailLead) && (
                                <span style={{
                                    fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12,
                                    background: getColdLevel(detailLead).color + '20', color: getColdLevel(detailLead).color, fontWeight: 700
                                }}>
                                    {getColdLevel(detailLead).icon} {getColdLevel(detailLead).label}
                                </span>
                            )}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', display: 'flex', gap: 16 }}>
                            <span>📧 {detailLead.email || '—'}</span>
                            {detailLead.telefono && (
                                <span style={{ cursor: 'pointer', color: '#25D366', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => handleWhatsAppClick(detailLead)}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    {detailLead.telefono}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setDetailLead(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--color-text-secondary)', padding: 4 }}>✕</button>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

                    {/* ── Bounce Alert (shown when email is bounced/invalid) ── */}
                    {detailLead.email_rebotado && (
                        <div style={{
                            marginBottom: 20, padding: '14px 16px',
                            background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04))',
                            border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12,
                            borderLeft: '4px solid #ef4444'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>❌</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.95rem', marginBottom: 4 }}>
                                        Correo inválido — Excluido de todos los envíos
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                        {detailLead.motivo_rebote && <div>Motivo: <strong>{detailLead.motivo_rebote}</strong></div>}
                                        {detailLead.fecha_rebote && <div>Detectado el: {new Date(detailLead.fecha_rebote).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                                        <div style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: '0.77rem' }}>
                                            Este lead no recibirá correos ni seguirá ninguna secuencia automática.
                                            Si el correo fue corregido, usa el botón para habilitarlo nuevamente.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleBounce}
                                disabled={bounceLoading}
                                style={{
                                    marginTop: 12, width: '100%', padding: '8px 0',
                                    background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
                                    borderRadius: 8, color: '#ef4444', fontWeight: 600,
                                    fontSize: '0.85rem', cursor: bounceLoading ? 'wait' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                                {bounceLoading ? '⏳ Actualizando...' : '✅ Marcar email como válido (reactivar)'}
                            </button>
                        </div>
                    )}

                {/* Score + Producto cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div style={{ background: 'var(--color-bg-hover)', padding: 16, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Score del Lead</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: scoreData.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {scoreData.icon} {scoreData.text}
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-bg-hover)', padding: 16, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Producto Cotizado</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                {detailLead.producto_interes || 'No especificado'}
                            </div>
                        </div>
                    </div>

                    {/* ── Autopilot (Playbook) ── */}
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            🚀 Estado de Autopilot (Playbook)
                        </h3>
                        {leadSecuencia && leadSecuencia.estado === 'en_progreso' ? (
                            <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: 16, borderRadius: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <strong style={{ color: 'var(--color-primary)' }}>{leadSecuencia.secuencias_marketing?.nombre || 'Secuencia Activa'}</strong>
                                    <span style={{
                                        background: leadSecuencia.estado === 'completada' ? '#10b98120' : leadSecuencia.estado === 'pausado' ? '#f59e0b20' : '#8b5cf620',
                                        color: leadSecuencia.estado === 'completada' ? '#10b981' : leadSecuencia.estado === 'pausado' ? '#f59e0b' : '#8b5cf6',
                                        padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600
                                    }}>
                                        {leadSecuencia.estado.toUpperCase()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                    <span>Pasos completados: <strong>{leadSecuencia.ultimo_paso_ejecutado}</strong></span>
                                    {leadSecuencia.estado === 'en_progreso' && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => forceNextDripStep()} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                                            Saltar Espera (Forzar Paso)
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: 'var(--color-bg-hover)', padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
                                {/* Previous sequence row — hidden if name is unknown */}
                                {leadSecuencia && leadSecuencia.estado !== 'en_progreso' && seqLabel && (
                                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>
                                            Secuencia anterior: <strong style={{ color: 'var(--color-text)' }}>{seqLabel}</strong>
                                        </span>
                                        <span style={{
                                            background: leadSecuencia.estado === 'completada' ? '#10b98120' : leadSecuencia.estado === 'pausado' ? '#f59e0b20' : '#ef444420',
                                            color: leadSecuencia.estado === 'completada' ? '#10b981' : leadSecuencia.estado === 'pausado' ? '#f59e0b' : '#ef4444',
                                            padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600
                                        }}>
                                            {leadSecuencia.estado.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                {!leadSecuencia && (
                                    <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>Este lead no está en ninguna secuencia.</div>
                                )}
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <select id="seq-select-modal" className="form-input" style={{ flex: 1, padding: '6px 10px' }}>
                                        <option value="">Seleccionar secuencia para matricular...</option>
                                        {(secuencias || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>
                                    <button className="btn btn-primary btn-sm" onClick={() => {
                                        const sel = document.getElementById('seq-select-modal')
                                        if (sel && sel.value) handleAssignSecuencia(sel.value)
                                    }}>Matricular</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Enviar Correo Único (inline) ── */}
                    {detailLead.email && (
                        <div style={{ marginBottom: 20 }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                ✉️ Enviar Correo Único
                            </h3>
                            <div style={{ background: 'var(--color-bg-hover)', padding: 16, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <select
                                        className="form-input"
                                        style={{ flex: 1, padding: '6px 10px' }}
                                        value={selectedPanelTemplate}
                                        onChange={e => setSelectedPanelTemplate(e.target.value)}
                                    >
                                        <option value="">Abrir Editor</option>
                                        {sortedTemplates.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre}</option>
                                        ))}
                                    </select>
                                    <button
                                        className="btn btn-sm"
                                        style={{ background: '#1a73e8', color: 'white', border: 'none', whiteSpace: 'nowrap' }}
                                            onClick={() => handleIndividualEmailClick(detailLead, selectedPanelTemplate)}
                                    >
                                        {selectedPanelTemplate ? '✉️ Enviar' : '✏️ Abrir'}
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                                    {detailLead.email}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Email History (Timeline) ── */}
                    <EmailTimeline detailEmails={detailEmails} />
                </div>

                {/* ── Footer — Editar + Ventar + Bounce Toggle ── */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openForm(detailLead)}>✏️ Editar</button>
                        <Link to="/ventas" state={{ convertLead: detailLead }} className="btn btn-success" style={{ flex: 1, textAlign: 'center' }}>🎫 Ventar</Link>
                    </div>
                    {/* Manual bounce toggle — visible only when email exists and NOT already bounced */}
                    {detailLead.email && !detailLead.email_rebotado && (
                        <button
                            onClick={handleToggleBounce}
                            disabled={bounceLoading}
                            style={{
                                width: '100%', padding: '7px 0', background: 'transparent',
                                border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8,
                                color: '#ef4444', fontWeight: 600, fontSize: '0.82rem',
                                cursor: bounceLoading ? 'wait' : 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.07)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            title="Útil para Gmail: marca este email como inválido y cancela sus secuencias activas"
                        >
                            {bounceLoading ? '⏳ Actualizando...' : '⚠️ Marcar email como rebotado (Gmail / Manual)'}
                        </button>
                    )}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}} />
        </>
    )
}
