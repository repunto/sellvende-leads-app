import React from 'react'
import { Link } from 'react-router-dom'
import OrigenBadge from '../OrigenBadge'
import ScoreBadge from '../ScoreBadge'

export default function LeadsTableView({
    filtered,
    leads,
    startIdx,
    LEADS_PER_PAGE,
    selectedLeads,
    setSelectedLeads,
    paginated,
    toggleSelectAll,
    cargandoSeleccionMassiva,
    toggleSelectLead,
    openDetailPanel,
    getColdLevel,
    getLeadScore,
    badgeClass,
    emailCounts,
    sequenceEnrollments,
    handleStopSequence,
    secuencias,
    handleWhatsAppClick,
    openForm,
    handleDelete,
    totalLeads,
    totalPages,
    currentPage,
    setCurrentPage
}) {
    return (
        <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px', minHeight: 24 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedLeads.size > 0 && (() => {
                        const excluded = (totalLeads ?? leads.length) - selectedLeads.size
                        return (
                            <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>✨ {selectedLeads.size} de {totalLeads ?? leads.length} leads seleccionados — Listos para la Secuencia Masiva.</span>
                                {excluded > 0 && (
                                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                                        ({excluded} excluidos)
                                    </span>
                                )}
                                <span style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', marginLeft: 4 }} onClick={() => setSelectedLeads(new Set())}>Borrar selección</span>
                            </span>
                        )
                    })()}
                    
                    {cargandoSeleccionMassiva && <span style={{ color: 'var(--color-primary)' }}>⏳ Seleccionando todos...</span>}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>📊 <strong>{totalLeads ?? leads.length}</strong> leads en total</span>
                    <span style={{ opacity: 0.5 }}>|</span>
                    <span>Mostrando {startIdx + 1}–{Math.min(startIdx + LEADS_PER_PAGE, startIdx + leads.length)}</span>
                </span>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ width: 45, textAlign: 'center' }}>
                            <input type="checkbox" onChange={toggleSelectAll}
                                title="Seleccionar TODOS los leads de todas las páginas"
                                disabled={cargandoSeleccionMassiva}
                                checked={selectedLeads.size > 0 && selectedLeads.size >= (totalLeads ?? leads.length)}
                                ref={el => { if (el) el.indeterminate = selectedLeads.size > 0 && selectedLeads.size < (totalLeads ?? leads.length) }}
                                />
                        </th>
                        <th style={{ width: 45, textAlign: 'center' }}>#</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Formulario</th>
                        <th>Origen</th>
                        <th>Score</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((lead, idx) => (
                        <tr key={lead.id} className={lead._isNew ? 'lead-new-flash' : ''} style={{ opacity: lead.email ? (lead.email_rebotado ? 0.55 : 1) : 0.7, background: lead.email_rebotado ? 'rgba(239,68,68,0.03)' : '' }}>
                            <td style={{ textAlign: 'center' }}>
                                <input type="checkbox" disabled={!lead.email || lead.email_rebotado || lead.unsubscribed}
                                    checked={selectedLeads.has(lead.id)}
                                    readOnly
                                    onClick={(e) => toggleSelectLead(lead.id, e.shiftKey, idx)} />
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>{startIdx + idx + 1}</td>
                            <td style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                                <span onClick={() => openDetailPanel(lead)} style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                                    {lead.nombre}
                                </span>
                                {getColdLevel(lead) && (
                                    <span title={`Sin contactar ${getColdLevel(lead).label}`} style={{
                                        marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px',
                                        borderRadius: 8, background: getColdLevel(lead).color + '20',
                                        color: getColdLevel(lead).color, fontWeight: 700
                                    }}>{getColdLevel(lead).icon} {getColdLevel(lead).label}</span>
                                )}
                            </td>
                            <td>
                                {lead.email || '—'}
                                {lead.email_rebotado && (
                                    <span
                                        title={`Email inválido — excluido de todos los envíos${lead.motivo_rebote ? '\nMotivo: ' + lead.motivo_rebote : ''}${lead.fecha_rebote ? '\nFecha: ' + new Date(lead.fecha_rebote).toLocaleDateString('es-PE') : ''}`}
                                        style={{
                                            marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px',
                                            borderRadius: 8, background: '#ef444420',
                                            color: '#ef4444', fontWeight: 700, border: '1px solid #ef444440',
                                            cursor: 'help', whiteSpace: 'nowrap'
                                        }}
                                    >❌ Rebotado</span>
                                )}
                                {!lead.email_rebotado && lead.unsubscribed && (
                                    <span title={`Dado de baja el ${lead.unsubscribed_at ? new Date(lead.unsubscribed_at).toLocaleDateString('es-PE') : '—'}`} style={{
                                        marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px',
                                        borderRadius: 8, background: '#ef444415',
                                        color: '#ef4444', fontWeight: 700, border: '1px solid #ef444430',
                                        cursor: 'help', whiteSpace: 'nowrap'
                                    }}>🚫 Baja</span>
                                )}
                            </td>
                            <td>{lead.producto_interes || '—'}</td>
                            <td><OrigenBadge origen={lead.origen} formName={lead.form_name} /></td>
                            <td><ScoreBadge score={getLeadScore(lead)} /></td>
                            <td><span className={badgeClass(lead.estado)}>{lead.estado}</span></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{new Date(lead.created_at).toLocaleDateString('es-PE')}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button 
                                        className="btn btn-ghost btn-sm btn-animated" 
                                        title="Ver Historial de Correos" 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            openDetailPanel(lead);
                                        }}
                                        style={{ padding: '4px', opacity: lead.email ? 1 : 0.3, cursor: lead.email ? 'pointer' : 'not-allowed', position: 'relative', transition: 'transform 0.1s ease', '&:active': { transform: 'scale(0.92)' } }}
                                        disabled={!lead.email}
                                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>📧</span>
                                        {emailCounts[lead.id] > 0 && (
                                            <span style={{
                                                position: 'absolute', top: -4, right: -4,
                                                background: 'var(--color-primary)', color: 'white',
                                                fontSize: '0.6rem', fontWeight: 'bold',
                                                borderRadius: '50%', minWidth: 14, height: 14,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>{emailCounts[lead.id]}</span>
                                        )}
                                    </button>
                                    {sequenceEnrollments[lead.id] && sequenceEnrollments[lead.id].estado === 'en_progreso' && (() => {
                                        const enr = sequenceEnrollments[lead.id]
                                        const paso = enr.ultimo_paso_ejecutado || 0
                                        const seqName = enr.secuencias_marketing?.nombre || 'Playbook'
                                        const totalPasos = secuencias.find(s => s.id === enr.secuencia_id)?.pasos?.length || '?'
                                        const hasSent = paso >= 1
                                        const tooltipText = hasSent
                                            ? `🚀 Secuencia: ${seqName}\n✅ Emails enviados: ${paso} de ${totalPasos}\n\n🛑 Clic para DETENER esta secuencia permanentemente.`
                                            : `🚀 Secuencia: ${seqName}\n⏳ Enrolado — esperando envío del primer email\nPasos ejecutados: 0 de ${totalPasos}\n\n🛑 Clic para DETENER esta secuencia permanentemente.`
                                        return (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); handleStopSequence(lead.id) }}
                                                title={tooltipText}
                                                style={{
                                                    position: 'relative',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: hasSent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                                    color: hasSent ? '#10b981' : '#8b5cf6',
                                                    padding: '0 8px', borderRadius: 12, height: 28, fontSize: '0.9rem',
                                                    border: `1px solid ${hasSent ? 'rgba(16, 185, 129, 0.35)' : 'rgba(139, 92, 246, 0.3)'}`,
                                                    cursor: 'pointer',
                                                    boxShadow: hasSent ? '0 0 8px rgba(16,185,129,0.25)' : '0 0 10px rgba(139, 92, 246, 0.3)',
                                                    transition: 'all 0.2s ease', minWidth: 32, gap: 3
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; e.currentTarget.querySelector('.rocket-label').textContent = '🛑' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = hasSent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)'; e.currentTarget.style.color = hasSent ? '#10b981' : '#8b5cf6'; e.currentTarget.style.borderColor = hasSent ? 'rgba(16,185,129,0.35)' : 'rgba(139, 92, 246, 0.3)'; e.currentTarget.querySelector('.rocket-label').textContent = '🚀' }}
                                            >
                                                <span className="rocket-label">🚀</span>
                                                {hasSent && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1 }}>{paso}</span>
                                                )}
                                            </div>
                                        )
                                    })()}
                                    <Link
                                        to="/ventas"
                                        state={{ convertLead: lead }}
                                        title="Convertir a Venta"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            width: 28, height: 28, borderRadius: 6,
                                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                            color: 'white', fontWeight: 900, fontSize: '0.78rem',
                                            textDecoration: 'none', letterSpacing: '-0.5px',
                                            boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        R
                                    </Link>
                                    {lead.telefono && (
                                        <button onClick={() => handleWhatsAppClick(lead)} className="btn btn-whatsapp" style={{ padding: '4px 8px' }} title="WhatsApp">
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                        </button>
                                    )}
                                    <button className="btn btn-ghost" title="Editar" onClick={() => openForm(lead)} style={{ padding: '4px 8px', color: 'var(--color-primary)', opacity: 0.8 }}>
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                    </button>
                                    <button className="btn btn-ghost" title="Eliminar" onClick={() => handleDelete(lead.id)} style={{ padding: '4px 8px', color: 'var(--color-danger)', opacity: 0.8 }}>
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {totalPages > 1 && (() => {
                // Build smart page range: always show [1] ... [cur-2 cur-1 cur cur+1 cur+2] ... [last]
                const delta = 2
                const range = []
                for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
                    range.push(i)
                }
                const pages = []
                pages.push(1)
                if (range[0] > 2) pages.push('...')
                pages.push(...range)
                if (range[range.length - 1] < totalPages - 1) pages.push('...')
                if (totalPages > 1) pages.push(totalPages)

                const btnBase = {
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 32, minWidth: 32, padding: '0 8px', borderRadius: 7,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-card)', color: 'var(--color-text)',
                    fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s ease', userSelect: 'none',
                }
                const btnDisabled = { opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none' }
                const btnActive = {
                    background: 'var(--color-primary)', color: '#fff',
                    border: '1px solid var(--color-primary)',
                    boxShadow: '0 0 12px var(--color-primary-glow, rgba(99,102,241,0.4))',
                    fontWeight: 700,
                }

                return (
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        gap: 4, padding: '14px 0 4px',
                        borderTop: '1px solid var(--color-border)', marginTop: 8, flexWrap: 'wrap'
                    }}>
                        {/* ← Inicio */}
                        <button
                            style={{ ...btnBase, ...(currentPage <= 1 ? btnDisabled : {}) }}
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(1)}
                            title="Primera página"
                        >⟨⟨</button>

                        {/* ← Anterior */}
                        <button
                            style={{ ...btnBase, padding: '0 12px', ...(currentPage <= 1 ? btnDisabled : {}) }}
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            title="Página anterior"
                        >← Ant.</button>

                        {/* Smart page numbers */}
                        {pages.map((p, i) =>
                            p === '...'
                                ? <span key={`ellipsis-${i}`} style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', padding: '0 2px', letterSpacing: 1 }}>…</span>
                                : <button
                                    key={p}
                                    style={{ ...btnBase, ...(p === currentPage ? btnActive : {}) }}
                                    onClick={() => setCurrentPage(p)}
                                    title={`Ir a página ${p}`}
                                >{p}</button>
                        )}

                        {/* Siguiente → */}
                        <button
                            style={{ ...btnBase, padding: '0 12px', ...(currentPage >= totalPages ? btnDisabled : {}) }}
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            title="Página siguiente"
                        >Sig. →</button>

                        {/* → Fin */}
                        <button
                            style={{ ...btnBase, ...(currentPage >= totalPages ? btnDisabled : {}) }}
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Última página"
                        >⟩⟩</button>

                        {/* Salto directo */}
                        {totalPages > 5 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                Ir a
                                <input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    defaultValue={currentPage}
                                    key={currentPage}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = parseInt(e.target.value)
                                            if (val >= 1 && val <= totalPages) setCurrentPage(val)
                                        }
                                    }}
                                    style={{
                                        width: 46, height: 30, textAlign: 'center',
                                        borderRadius: 7, border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-card)', color: 'var(--color-text)',
                                        fontSize: '0.82rem', outline: 'none', padding: '0 4px',
                                    }}
                                />
                            </span>
                        )}
                    </div>
                )
            })()}
        </div>
    )
}
