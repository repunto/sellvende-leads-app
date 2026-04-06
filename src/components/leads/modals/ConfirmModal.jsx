import React, { useEffect } from 'react'

/**
 * ConfirmModal — Reemplaza window.confirm() nativo
 * Props:
 *   show       – boolean
 *   title      – string (título del diálogo)
 *   message    – string | ReactNode (mensaje descriptivo)
 *   confirmLabel – string (default: 'Confirmar')
 *   cancelLabel  – string (default: 'Cancelar')
 *   danger     – boolean (botón confirmar en rojo)
 *   onConfirm  – function()
 *   onCancel   – function()
 */
export default function ConfirmModal({
    show, title, message, confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar', danger = false, onConfirm, onCancel
}) {
    useEffect(() => {
        if (!show) return
        const handle = (e) => { if (e.key === 'Escape') onCancel?.() }
        document.addEventListener('keydown', handle, true)
        return () => document.removeEventListener('keydown', handle, true)
    }, [show, onCancel])

    if (!show) return null

    return (
        <div className="modal-overlay" onClick={onCancel}
            style={{ zIndex: 99999, backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.65)' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}
                style={{ maxWidth: 420, padding: 0, overflow: 'hidden', borderRadius: 14 }}>

                {/* Stripe top */}
                <div style={{
                    height: 5,
                    background: danger
                        ? 'linear-gradient(90deg, #ef4444, #f97316)'
                        : 'linear-gradient(90deg, var(--color-primary), #3b82f6)'
                }} />

                <div style={{ padding: '24px 28px' }}>
                    {/* Icon + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                            background: danger ? '#fee2e2' : 'rgba(99,102,241,0.1)',
                            flexShrink: 0
                        }}>
                            {danger ? '⚠️' : 'ℹ️'}
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {title}
                        </h3>
                    </div>

                    {/* Message */}
                    <p style={{
                        margin: '0 0 24px 0', fontSize: '0.9rem',
                        color: 'var(--color-text-secondary)', lineHeight: 1.6
                    }}>
                        {message}
                    </p>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={onCancel}
                            style={{ minWidth: 90 }}>
                            {cancelLabel}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={onConfirm}
                            style={{
                                minWidth: 110,
                                background: danger ? '#ef4444' : undefined,
                                borderColor: danger ? '#ef4444' : undefined
                            }}>
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
