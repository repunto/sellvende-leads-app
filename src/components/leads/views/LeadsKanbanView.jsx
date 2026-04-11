import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import OrigenBadge from '../OrigenBadge'
import ScoreBadge from '../ScoreBadge'

export default function LeadsKanbanView({
    filtered,
    KANBAN_COLS,
    handleKanbanDrop,
    setDraggedLeadId,
    openDetailPanel,
    getColdLevel,
    getLeadScore,
    handleWhatsAppClick,
    openForm
}) {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, minHeight: 400 }}>
            {KANBAN_COLS.map(col => {
                const colLeads = filtered.filter(l => l.estado === col.estado)
                return (
                    <div key={col.estado}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleKanbanDrop(col.estado)}
                        style={{
                            background: 'var(--color-bg-card)', borderRadius: 10,
                            border: `2px solid ${col.color}25`, padding: 12,
                            display: 'flex', flexDirection: 'column', gap: 8
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: col.color }}>
                                {col.icon} {col.label}
                            </span>
                            <span style={{
                                background: col.color + '20', color: col.color,
                                padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700
                            }}>{colLeads.length}</span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500 }}>
                            {colLeads.map(lead => {
                                let isUrgent = false
                                let waitMins = 0
                                if (col.estado === 'nuevo' && lead.created_at) {
                                    waitMins = Math.max(0, Math.floor((now - new Date(lead.created_at)) / 60000))
                                    if (waitMins >= 5) {
                                        isUrgent = true
                                    }
                                }

                                return (
                                <div key={lead.id}
                                    draggable
                                    onDragStart={() => setDraggedLeadId(lead.id)}
                                    className={lead._isNew ? 'lead-new-flash' : isUrgent ? 'lead-urgent-flash' : ''}
                                    style={{
                                        background: isUrgent ? 'var(--color-bg-card)' : 'var(--color-bg)', 
                                        border: isUrgent ? '1px solid #ef444480' : '1px solid var(--color-border)',
                                        borderRadius: 8, padding: '8px 10px', cursor: 'grab',
                                        borderLeft: isUrgent ? `4px solid #ef4444` : `3px solid ${col.color}`, 
                                        boxShadow: isUrgent ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none',
                                        fontSize: '0.82rem'
                                    }}>
                                    <div style={{ fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                        <span onClick={() => openDetailPanel(lead)} style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                                            {lead.nombre}
                                        </span>
                                        {col.estado === 'nuevo' && waitMins > 0 && (
                                            <span title="Tiempo esperando respuesta" style={{ 
                                                fontSize: '0.65rem', 
                                                padding: '1px 5px', 
                                                borderRadius: 10, 
                                                background: isUrgent ? '#ef444420' : 'var(--color-bg-hover)',
                                                color: isUrgent ? '#ef4444' : 'var(--color-text-secondary)',
                                                fontWeight: 800
                                            }}>
                                                ⏱️ {waitMins}m
                                            </span>
                                        )}
                                        {lead.email_rebotado && (
                                            <span
                                                title={`Email rebotado — excluido de envíos${lead.motivo_rebote ? '\nMotivo: ' + lead.motivo_rebote : ''}`}
                                                style={{ fontSize: '0.7rem', color: '#ef4444', background: '#ef444415', border: '1px solid #ef444430', borderRadius: 6, padding: '0px 5px', fontWeight: 700, cursor: 'help' }}
                                            >❌ Rebotado</span>
                                        )}
                                        {getColdLevel(lead) && <span style={{ marginLeft: 2 }}>{getColdLevel(lead).icon}</span>}
                                        <ScoreBadge score={getLeadScore(lead)} />
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                                        {lead.producto_interes || '—'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                                        <OrigenBadge origen={lead.origen} formName={lead.form_name} />
                                        <div style={{ display: 'flex', gap: 3 }}>
                                            {lead.telefono && (
                                                <button onClick={() => handleWhatsAppClick(lead)} className="btn btn-whatsapp btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }} title="WhatsApp">
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                </button>
                                            )}
                                            <Link
                                                to="/ventas"
                                                state={{ convertLead: lead }}
                                                title="Convertir a Venta"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 24, height: 24, borderRadius: 5,
                                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                                    color: 'white', fontWeight: 900, fontSize: '0.72rem',
                                                    textDecoration: 'none',
                                                    boxShadow: '0 2px 6px rgba(99,102,241,0.4)'
                                                }}
                                            >R</Link>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openForm(lead)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>✏️</button>
                                        </div>
                                    </div>
                                </div>
                            )})}
                            {colLeads.length === 0 && (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.78rem', opacity: 0.6 }}>
                                    Arrastra leads aquí
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
