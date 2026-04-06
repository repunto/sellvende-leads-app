import React, { useEffect } from 'react'

export default function MassSequenceModal({
    show, onClose, selectedLeadsCount, secuencias,
    selectedMassSequenceId, setSelectedMassSequenceId, enrollingSequence, enrollMassSequence
}) {
    useEffect(() => {
        if (!show) return
        const handle = (e) => { if (e.key === 'Escape' && !enrollingSequence) onClose() }
        document.addEventListener('keydown', handle, true)
        return () => document.removeEventListener('keydown', handle, true)
    }, [show, onClose, enrollingSequence])

    if (!show) return null

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--color-primary) 0%, #a855f7 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🚀 Enrolamiento Masivo (Playbooks)
                            </h2>
                            <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.85rem' }}>Automatización Marketing Élite</p>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'rgba(255,255,255,0.8)' }}>✕</button>
                    </div>
                </div>
                
                <div style={{ padding: '24px' }}>
                    <div style={{ marginBottom: 16, background: 'var(--color-bg-hover)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Leads a enrolar:</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>{selectedLeadsCount} leads seleccionados</strong>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600 }}>Selecciona un Playbook / Secuencia:</label>
                        <select className="form-input" style={{ width: '100%', padding: 12 }} value={selectedMassSequenceId || ''} onChange={(e) => setSelectedMassSequenceId(e.target.value)}>
                            <option value="">-- Elige una secuencia --</option>
                            {(secuencias || []).map(sec => (
                                <option key={sec.id} value={sec.id}>⚡ {sec.nombre} ({sec.pasos?.length || 0} pasos)</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: 12, borderRadius: 8 }}>
                        💡 <strong>Nota:</strong> Los leads seleccionados serán asignados a este playbook. Si el componente <strong>Motor Global</strong> está encendido, empezarán a recibir el primer correo casi de inmediato.
                    </div>
                </div>

                <div style={{ padding: '16px 24px', background: 'var(--color-bg-hover)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn btn-secondary" disabled={enrollingSequence} onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" disabled={enrollingSequence || !selectedMassSequenceId} onClick={enrollMassSequence} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {enrollingSequence ? '⏳ Enrolando y Ejecutando...' : `🚀 Enrolar y Ejecutar (${selectedLeadsCount})`}
                    </button>
                </div>
            </div>
        </div>
    )
}
