import React, { useEffect } from 'react'
import EliteEmailEditor from '../EliteEmailEditor'

export default function MassEmailModal({
    show, onClose, selectedLeadsCount, emailTemplates,
    selectedEmailTemplate, setSelectedEmailTemplate,
    emailSubject, setEmailSubject, emailBody, setEmailBody,
    emailPreviewMode, setEmailPreviewMode,
    configs, agencia, emailSending, emailSuccessAnim, emailProgress, sendBulkEmail
}) {
    // ── Escape key closes the modal ──────────────────────────────────────────
    useEffect(() => {
        if (!show) return
        const handle = (e) => { if (e.key === 'Escape' && !emailSending) onClose() }
        document.addEventListener('keydown', handle, true)
        return () => document.removeEventListener('keydown', handle, true)
    }, [show, onClose, emailSending])

    if (!show) return null

    const previewHtml = (emailBody || '')
        .replace(/\{Nombre\}/gi, '[Nombre del Cliente]')
        .replace(/\{nombre\}/gi, '[Nombre del Cliente]')
        .replace(/\{Producto\}/gi, '[Producto de Interés]')
        .replace(/\{producto\}/gi, '[Producto de Interés]')
        .replace(/\{Agencia\}/gi, agencia?.nombre || 'Nuestra Agencia')
        .replace(/\{agencia\}/gi, agencia?.nombre || 'Nuestra Agencia')
        .replace(/\{(FechaViaje|fecha_entrega)\}/gi, '[Fecha de Entrega/Servicio]')
        .replace(/\{social_proof\}/gi, '')

    return (
        <div className="modal-overlay" onClick={emailSending ? undefined : onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}
                style={{ maxWidth: 800, padding: 0, overflow: 'hidden' }}>

                {/* ── Header ── */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--color-primary) 0%, #3b82f6 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                📧 Redactar Correo Masivo
                            </h2>
                            <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.85rem' }}>
                                Enviar a {selectedLeadsCount} destinatarios
                                <span style={{ marginLeft: 12, opacity: 0.7, fontSize: '0.78rem' }}>· Esc para cerrar</span>
                            </p>
                        </div>
                        <button onClick={onClose} disabled={emailSending}
                            style={{ background: 'transparent', border: 'none', cursor: emailSending ? 'not-allowed' : 'pointer', fontSize: '1.2rem', color: 'rgba(255,255,255,0.8)' }}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── Success state ── */}
                {emailSuccessAnim ? (
                    <div style={{ padding: 60, textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'bounce 1s infinite' }}>📨</div>
                        <h3 style={{ color: 'var(--color-primary)' }}>¡Correos en camino!</h3>
                        <p style={{ color: 'var(--color-text-secondary)' }}>Los correos están siendo enviados a los {selectedLeadsCount} leads.</p>
                    </div>
                ) : (
                    <div style={{ padding: '24px' }}>

                        {/* ── Template + Subject ── */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600 }}>Plantilla Sugerida:</label>
                                <select className="form-input" value={selectedEmailTemplate || ''} onChange={e => {
                                    setSelectedEmailTemplate(e.target.value)
                                    const t = emailTemplates.find(x => x.id === e.target.value)
                                    if (t) { setEmailSubject(t.asunto || ''); setEmailBody(t.contenido_html || '') }
                                }}>
                                    <option value="">-- Elegir plantilla / Escribir libremente --</option>
                                    {(emailTemplates || []).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600 }}>Asunto:</label>
                                <input type="text" className="form-input" placeholder="Asunto del correo..."
                                    value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                            </div>
                        </div>

                        {/* ── Editor / Preview toggle ── */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                            <button className={`btn btn-sm ${!emailPreviewMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEmailPreviewMode(false)}>✍️ Editor</button>
                            <button className={`btn btn-sm ${emailPreviewMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEmailPreviewMode(true)}>👀 Vista Previa</button>
                        </div>

                        {/* ── Email preview (forced light mode) ── */}
                        {emailPreviewMode ? (
                            <div style={{
                                background: '#e8edf2', borderRadius: 8, padding: '16px 8px',
                                border: '1px solid #cbd5e1', maxHeight: 420, overflowY: 'auto',
                                colorScheme: 'light'
                            }}>
                                <div style={{
                                    background: '#ffffff', maxWidth: 580, margin: '0 auto',
                                    border: '1px solid #e2e8f0', borderRadius: 8,
                                    overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                    colorScheme: 'light', color: '#1e293b'
                                }}>
                                    {configs?.logo_url && (
                                        <div style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                                            <img src={configs.logo_url} alt="Logo" style={{ maxHeight: 48, maxWidth: '80%' }} />
                                        </div>
                                    )}
                                    <div style={{
                                        padding: '28px 32px', color: '#1e293b', fontSize: '14px',
                                        lineHeight: 1.7, background: '#ffffff',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                    }}
                                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    />
                                    <div style={{
                                        background: '#f8fafc', padding: '14px 20px',
                                        textAlign: 'center', fontSize: '12px', color: '#64748b',
                                        borderTop: '1px solid #f1f5f9'
                                    }}>
                                        Enviado por <strong>{agencia?.nombre || 'Agencia Productos'}</strong>
                                    </div>
                                </div>
                                <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: 8 }}>
                                    Vista previa con datos de muestra · El diseño final puede variar
                                </p>
                            </div>
                        ) : (
                                    <div style={{ marginBottom: 24 }}>
                                        <EliteEmailEditor value={emailBody} onChange={setEmailBody} />
                                    </div>
                                )}
                    </div>
                )}

                {/* ── Footer actions ── */}
                {!emailSuccessAnim && (
                    <div style={{ padding: '16px 24px', background: 'var(--color-bg-hover)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                        {emailProgress && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-primary)', animation: 'pulse 1s infinite' }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>{emailProgress}</span>
                            </div>
                        )}
                        <button className="btn btn-secondary" disabled={emailSending} onClick={onClose}>Cancelar</button>
                        <button className="btn btn-primary" disabled={emailSending || !emailSubject || !emailBody}
                            onClick={sendBulkEmail}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {emailSending ? '⏳ Enviando...' : `✉️ Enviar a ${selectedLeadsCount} Leads`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
