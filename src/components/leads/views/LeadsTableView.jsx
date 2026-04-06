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
    totalPages,
    currentPage,
    setCurrentPage
}) {
    return (
        <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    📊 <strong>{filtered.length}</strong> leads en total
                    {filtered.length !== leads.length && <span> (de {leads.length})</span>}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    Mostrando {startIdx + 1}–{Math.min(startIdx + LEADS_PER_PAGE, filtered.length)}
                </span>
            </div>

            {selectedLeads.size > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--color-text)', border: '1px solid #f59e0b', borderBottom: 'none', borderTopLeftRadius: 8, borderTopRightRadius: 8, transition: 'all 0.3s' }}>
                    <div>
                        ✨ Has seleccionado <strong>{selectedLeads.size}</strong> leads.
                        {selectedLeads.size >= filtered.filter(l => l.email).length && ' Listos para la Secuencia Masiva.'}
                    </div>
                    <span style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }} onClick={() => setSelectedLeads(new Set())}>Borrar selección</span>
                </div>
            )}

            <table className="data-table" style={{ borderTopLeftRadius: selectedLeads.size > 0 ? 0 : '' }}>
                <thead>
                    <tr>
                        <th style={{ width: 45, textAlign: 'center' }}>
                            <input type="checkbox" onChange={toggleSelectAll}
                                title="Seleccionar TODOS los leads"
                                checked={filtered.filter(l => l.email).length > 0 && filtered.filter(l => l.email).every(l => selectedLeads.has(l.id))} />
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
                                <input type="checkbox" disabled={!lead.email || lead.email_rebotado}
                                    checked={selectedLeads.has(lead.id)}
                                    onChange={() => toggleSelectLead(lead.id)} />
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
                            <td>{lead.tour_nombre || '—'}</td>
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
                                    {sequenceEnrollments[lead.id] && sequenceEnrollments[lead.id].estado === 'en_progreso' && (
                                        <div 
                                            onClick={(e) => { e.stopPropagation(); handleStopSequence(lead.id) }}
                                            title={`🚀 Playbook: ${sequenceEnrollments[lead.id].secuencias_marketing?.nombre || 'Activo'}\nPasos Completados: ${sequenceEnrollments[lead.id].ultimo_paso_ejecutado || 0} de ${secuencias.find(s => s.id === sequenceEnrollments[lead.id].secuencia_id)?.pasos?.length || '?'}\n\n🛑 Clic para DETENER esta secuencia permanentemente.`}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6',
                                                padding: '0 8px', borderRadius: 12, height: 28, fontSize: '0.9rem',
                                                border: '1px solid rgba(139, 92, 246, 0.3)', cursor: 'pointer',
                                                boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)',
                                                transition: 'all 0.2s ease', minWidth: 32
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; e.currentTarget.innerHTML = '🛑' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'; e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'; e.currentTarget.innerHTML = '🚀' }}
                                        >
                                            🚀
                                        </div>
                                    )}
                                    <Link
                                        to="/reservas"
                                        state={{ convertLead: lead }}
                                        title="Convertir a Reserva"
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
                                        <button onClick={() => handleWhatsAppClick(lead)} className="btn btn-whatsapp btn-sm" title="WhatsApp">
                                            <svg viewBox="0 0 24 24" width="15" height="15" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                        </button>
                                    )}
                                    <button className="btn btn-secondary btn-sm" title="Editar" onClick={() => openForm(lead)}>✏️</button>
                                    <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => handleDelete(lead.id)} style={{ color: 'var(--color-danger)' }}>🗑</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {totalPages > 1 && (
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
                    padding: '16px 0', borderTop: '1px solid var(--color-border)', marginTop: 8
                }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                    >← Anterior</button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                    >Siguiente →</button>
                </div>
            )}
        </div>
    )
}
