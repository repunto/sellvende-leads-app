import React, { useEffect } from 'react'
import EliteEmailEditor from '../EliteEmailEditor'

export default function IndividualEmailModal({
    show, onClose, lead, emailMode, setEmailMode, selectedSequenceId, setSelectedSequenceId, secuencias,
    emailTemplates, selectedEmailTemplate, onTemplateChange, emailSubject, setEmailSubject,
    emailBody, setEmailBody, emailPreviewMode, setEmailPreviewMode,
    configs, agencia, emailSending, emailSuccessAnim, sendIndividualEmail, startDripSequenceFromModal
}) {
    // ── Escape key closes the modal ──────────────────────────────────────────
    useEffect(() => {
        if (!show) return
        const handle = (e) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handle, true)
        return () => document.removeEventListener('keydown', handle, true)
    }, [show, onClose])

    if (!show || !lead) return null

    // Preview HTML — strip Quill delta if still json, clean for light render
    const previewHtml = (emailBody || '')
        .replace(/\{Nombre\}/gi, lead.nombre || 'Cliente')
        .replace(/\{nombre\}/gi, lead.nombre || 'Cliente')
        .replace(/\{Tour\}/gi, lead.tour_nombre || 'el tour')
        .replace(/\{tour\}/gi, lead.tour_nombre || 'el tour')
        .replace(/\{Agencia\}/gi, agencia?.nombre || 'Nuestra Agencia')
        .replace(/\{agencia\}/gi, agencia?.nombre || 'Nuestra Agencia')
        .replace(/\{FechaViaje\}/gi, lead.temporada || '')
        .replace(/\{telefono\}/gi, configs?.telefono_agencia || configs?.whatsapp || '')
        .replace(/\{social_proof\}/gi, '')

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}
                style={{ 
                    width: '100%', maxWidth: 800, padding: 0, 
                    display: 'flex', flexDirection: 'column', maxHeight: '90vh',
                    borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}>

                {/* ── Header ── */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--color-primary) 0%, #3b82f6 100%)', color: 'white', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                📧 Redactar a {lead.nombre}
                            </h2>
                            <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.85rem' }}>
                                Destino: {lead.email}
                                <span style={{ marginLeft: 12, opacity: 0.7, fontSize: '0.78rem' }}>· Esc para cerrar</span>
                            </p>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'rgba(255,255,255,0.8)', transition: '0.2s', padding: '0 8px' }}>&times;</button>
                    </div>
                </div>

                {/* ── Success state ── */}
                {emailSuccessAnim ? (
                    <div style={{ padding: 60, textAlign: 'center', flex: 1, background: 'var(--color-bg)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'bounce 1s infinite' }}>📨</div>
                        <h3 style={{ color: 'var(--color-primary)' }}>¡Correo enviado exitosamente!</h3>
                        <p style={{ color: 'var(--color-text-secondary)' }}>El mensaje está en camino a la bandeja de {lead.nombre}.</p>
                    </div>
                ) : (
                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>

                        {/* ── Editor Workspace ── */}
                        <>
                                {/* ── Template + Subject ── */}
                                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Plantilla Sugerida:</label>
                                        <select className="form-input" style={{ width: '100%' }} value={selectedEmailTemplate || ''} onChange={e => {
                                            if (onTemplateChange) {
                                                onTemplateChange(e.target.value, emailTemplates)
                                            }
                                        }}>
                                            <option value="">-- Elegir plantilla / Escribir libremente --</option>
                                            {(emailTemplates || []).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Asunto del Correo:</label>
                                        <input type="text" className="form-input" style={{ width: '100%' }} placeholder="Escribe un asunto impactante..."
                                            value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                                    </div>
                                </div>

                                {/* ── Editor / Preview toggle ── */}
                                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, marginBottom: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                                    <button className={`btn btn-sm ${!emailPreviewMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEmailPreviewMode(false)}>✍️ Editor Visual</button>
                                    <button className={`btn btn-sm ${emailPreviewMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEmailPreviewMode(true)}>📱 Vista Previa Real</button>
                                </div>

                                {/* ── Email preview (Elite UI) ── */}
                                {emailPreviewMode ? (
                                    <div style={{
                                        background: '#f1f5f9', borderRadius: 12, padding: '24px',
                                        border: '1px solid #cbd5e1', colorScheme: 'light',
                                        boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)'
                                    }}>
                                        {/* Mac-Style Window Container */}
                                        <div style={{
                                            background: '#ffffff', maxWidth: 680, margin: '0 auto',
                                            borderRadius: 10, overflow: 'hidden', 
                                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                            colorScheme: 'light', color: '#1e293b', border: '1px solid #e2e8f0'
                                        }}>
                                            {/* Window Header */}
                                            <div style={{ background: '#f8fafc', padding: '12px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }}></div>
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }}></div>
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }}></div>
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                                    {emailSubject || 'Sin Asunto'}
                                                </div>
                                            </div>

                                            {/* Agency Logo */}
                                            {configs?.logo_url && (
                                                <div style={{ padding: '24px 20px 10px', textAlign: 'center', background: '#ffffff' }}>
                                                    <img src={configs.logo_url} alt="Logo" style={{ maxHeight: 55, maxWidth: '80%', objectFit: 'contain' }} />
                                                </div>
                                            )}
                                            
                                            {/* Email HTML Body */}
                                            <div style={{
                                                padding: configs?.logo_url ? '10px 40px 30px' : '30px 40px', color: '#1e293b', fontSize: '15px',
                                                lineHeight: 1.7, background: '#ffffff',
                                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                                            }}
                                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                                            />
                                            
                                            {/* Email Footer */}
                                            <div style={{
                                                background: '#f8fafc', padding: '16px 24px',
                                                textAlign: 'center', fontSize: '13px', color: '#64748b',
                                                borderTop: '1px solid #f1f5f9'
                                            }}>
                                                Enviado por <strong>{agencia?.nombre || 'Nuestra Agencia'}</strong>
                                                {configs?.url_web && <span> · <a href={configs.url_web} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>{configs.url_web}</a></span>}
                                            </div>
                                        </div>
                                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem' }}>📱</span> Vista previa aproximada de cómo lo verá tu cliente
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <EliteEmailEditor value={emailBody} onChange={setEmailBody} />
                                    </div>
                                )}
                            </>
                    </div>
                )}

                {/* ── Footer actions ── */}
                {!emailSuccessAnim && (
                    <div style={{ flexShrink: 0, padding: '16px 24px', background: 'var(--color-bg-hover)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-secondary" disabled={emailSending} onClick={onClose} style={{ padding: '10px 24px' }}>Cancelar</button>
                        <button className="btn btn-primary" disabled={emailSending || !emailSubject || !emailBody}
                            onClick={sendIndividualEmail}
                            style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 600 }}>
                            {emailSending ? '⏳ Enviando correo rápido...' : '✉️ Enviar Correo Único'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
