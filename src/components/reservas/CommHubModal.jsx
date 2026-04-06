/**
 * CommHubModal — Communication Hub for Reservas.
 * Allows sending WhatsApp or Email to client/operator with personalized templates.
 */
import React from 'react'

const WA_ICON = (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
)

const TIPOS = [
    { id: 'confirmacion', label: '✅ Confirmación', color: 'var(--color-success)' },
    { id: 'cotizacion',   label: '📊 Cotización',   color: 'var(--color-warning)' },
    { id: 'recordatorio', label: '⏰ Recordatorio', color: 'var(--color-accent)'  },
    { id: 'resena',       label: '⭐ Reseña',        color: 'var(--color-info, #60a5fa)' },
]

function CommHubModal({
    commModal,
    setCommModal,
    operadores,
    tours,
    commSelectedTipo,
    handleCommTipoChange,
    commLoading,
    commPreview,
    setCommPreview,
    commPlantillas,
    handleSendWhatsApp,
    handleSendEmail,
}) {
    if (!commModal) return null
    const { reserva, destinatario } = commModal

    const destinatarioLabel = destinatario === 'cliente' ? 'Cliente' : 'Operador'
    const destinatarioNombre = destinatario === 'cliente'
        ? reserva.cliente_nombre
        : (operadores.find(o => o.id === reserva.operador_id)?.nombre || 'Sin asignar')

    const toursNombre = reserva.reserva_tours
        ?.map(rt => tours.find(t => t.id === rt.tour_id)?.nombre)
        .filter(Boolean).join(' + ') || 'Sin tours'

    const fechaDisplay = reserva.reserva_tours?.length > 0 && reserva.reserva_tours[0].fecha_tour
        ? new Date(reserva.reserva_tours[0].fecha_tour).toLocaleDateString('es-PE')
        : '—'

    const saldo = (parseFloat(reserva.precio_venta || 0) - parseFloat(reserva.adelanto || 0)).toFixed(2)

    return (
        <div className="modal-overlay" onClick={() => setCommModal(null)}>
            <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="modal-header">
                    <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {WA_ICON} Communication Hub
                    </h2>
                    <button className="btn-close" onClick={() => setCommModal(null)}>✕</button>
                </div>

                {/* ── Reservation Summary Bar ── */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                    padding: 12, background: 'rgba(99,102,241,0.08)', borderRadius: 8,
                    border: '1px solid rgba(99,102,241,0.2)', marginBottom: 16, fontSize: '0.82rem'
                }}>
                    <div><strong>👤 {destinatarioLabel}:</strong> {destinatarioNombre}</div>
                    <div><strong>🏔️ Tour:</strong> {toursNombre}</div>
                    <div><strong>📅 Fecha:</strong> {fechaDisplay}</div>
                    <div><strong>💰 Saldo:</strong> ${saldo}</div>
                </div>

                {/* ── Template Type Selector ── */}
                <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        Tipo de Mensaje
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {TIPOS.map(tipo => (
                            <button
                                key={tipo.id}
                                className={`btn btn-sm ${commSelectedTipo === tipo.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleCommTipoChange(tipo.id)}
                                style={{ fontSize: '0.75rem', padding: '5px 10px', borderColor: commSelectedTipo === tipo.id ? tipo.color : undefined }}
                            >
                                {tipo.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Message Preview ── */}
                {commLoading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Cargando plantillas...
                    </div>
                ) : (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                            Vista Previa del Mensaje <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(editable)</span>
                        </label>
                        <textarea
                            className="form-textarea"
                            rows={10}
                            value={commPreview}
                            onChange={e => setCommPreview(e.target.value)}
                            style={{ fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.65, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                        />
                        {commPlantillas.length === 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-warning)', marginTop: 6 }}>
                                ⚠️ No tienes plantillas guardadas. <strong>Ve a Configuración → Plantillas WhatsApp</strong> para crear mensajes profesionales reutilizables.
                            </div>
                        )}
                    </div>
                )}

                {/* ── Action Buttons ── */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={() => setCommModal(null)}>Cancelar</button>
                    <button
                        className="btn"
                        onClick={handleSendEmail}
                        style={{ background: 'var(--color-info, #3b82f6)', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        📧 Enviar Email
                    </button>
                    <button
                        className="btn"
                        onClick={handleSendWhatsApp}
                        style={{ background: '#25D366', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        📲 Enviar WhatsApp
                    </button>
                </div>
            </div>
        </div>
    )
}

export default React.memo(CommHubModal)
