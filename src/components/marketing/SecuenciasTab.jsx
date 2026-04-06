import { useState, useCallback, memo } from 'react'
import ConfirmModal from '../leads/modals/ConfirmModal'

const TIPOS_LABELS = {
    lead_primer_contacto: '1. Primer Contacto',
    lead_seguimiento:     '2. Seguimiento',
    lead_reenganche:      '3. Re-enganche',
    cotizacion:   '1. Cotización',
    confirmacion: '2. Confirmación',
    recordatorio: '3. Recordatorio',
    resena:       '4. Reseña'
}

// ── WA icon (inline SVG) ──────────────────────────────────────────────────────
const WAIcon = () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
)

// ── Step editor row ───────────────────────────────────────────────────────────
function PasoRow({ paso, index, prevDia, filteredEmail, filteredWA, onUpdate, onRemove }) {
    return (
        <div style={{ position: 'relative', marginBottom: 20 }}>
            <div style={{
                position: 'absolute', left: -22, top: -2,
                width: 9, height: 9, borderRadius: '50%',
                background: 'var(--color-primary)', border: '2px solid var(--color-bg)',
                boxShadow: '0 0 0 3px var(--color-bg)', zIndex: 2
            }} />

            <div className="elite-wait-node" style={{ padding: '0px 10px', fontSize: '0.75rem', top: -14, left: -2, border: 'none', background: 'transparent' }}>
                <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>Día:</span>
                <input
                    type="number" min={prevDia} max="365"
                    value={paso.dia_envio}
                    onChange={e => onUpdate(index, 'dia_envio', parseInt(e.target.value))}
                    required
                    style={{ width: 30, padding: 0, textAlign: 'center', fontWeight: 800, border: 'none', background: 'transparent', color: 'var(--color-primary)', outline: 'none', fontSize: '0.85rem', marginLeft: 4 }}
                />
            </div>

            <div className="elite-node-card" style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem' }}
                    title="Eliminar paso"
                >✕</button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingRight: 20 }}>
                    {/* Email */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.9rem' }}>📧</span> Enviar Email
                        </label>
                        {filteredEmail.length === 0 ? (
                            <div style={{ padding: '8px', background: 'rgba(239,68,68,0.05)', color: '#ef4444', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>Sin Plantillas</div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <select
                                    className="form-control"
                                    value={paso.plantilla_email_id || ''}
                                    onChange={e => onUpdate(index, 'plantilla_email_id', e.target.value)}
                                    style={{ padding: '8px 10px', fontWeight: 600, appearance: 'none', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, width: '100%', fontSize: '0.75rem', color: paso.plantilla_email_id ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                                >
                                    <option value="">-- Correo --</option>
                                    {filteredEmail.map(tpl => (
                                        <option key={tpl.id} value={tpl.id}>[{TIPOS_LABELS[tpl.tipo] || tpl.tipo}] {tpl.nombre}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)', fontSize: '0.6rem' }}>▼</div>
                            </div>
                        )}
                    </div>

                    {/* WhatsApp */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)', marginBottom: 6 }}>
                            <span style={{ display: 'flex', alignItems: 'center' }}><WAIcon /></span> WhatsApp
                        </label>
                        {filteredWA.length === 0 ? (
                            <div style={{ padding: '8px', background: 'rgba(239,68,68,0.05)', color: '#ef4444', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>Sin Mensajes</div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <select
                                    className="form-control"
                                    value={paso.plantilla_whatsapp_id || ''}
                                    onChange={e => onUpdate(index, 'plantilla_whatsapp_id', e.target.value)}
                                    style={{ padding: '8px 10px', fontWeight: 600, appearance: 'none', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, width: '100%', fontSize: '0.75rem', color: paso.plantilla_whatsapp_id ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                                >
                                    <option value="">-- Mensaje --</option>
                                    {filteredWA.map(tpl => (
                                        <option key={tpl.id} value={tpl.id}>[{TIPOS_LABELS[tpl.tipo] || tpl.tipo}] {tpl.nombre}</option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)', fontSize: '0.6rem' }}>▼</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Sequence editor form ──────────────────────────────────────────────────────
function SecuenciaForm({ editingSecuencia, plantillasEmail, plantillasWA, metaForms, onSave, onCancel }) {
    const [form, setForm] = useState(
        editingSecuencia
            ? { nombre: editingSecuencia.nombre, descripcion: editingSecuencia.descripcion || '', activa: editingSecuencia.activa, tour_match: editingSecuencia.tour_match || editingSecuencia.nombre || '' }
            : { nombre: '', descripcion: '', activa: true, tour_match: '' }
    )
    const [pasos, setPasos] = useState(
        editingSecuencia
            ? (editingSecuencia.pasos?.sort((a, b) => a.dia_envio - b.dia_envio) || [])
            : []
    )
    const [saving, setSaving] = useState(false)

    const filteredEmail = plantillasEmail.filter(t => t.origen === form.tour_match)
    const filteredWA    = plantillasWA.filter(t => t.origen === form.tour_match)

    const addPaso = () => {
        const last = pasos.at(-1)
        const dia  = last ? last.dia_envio + 2 : 1
        setPasos([...pasos, { dia_envio: dia, plantilla_email_id: '', plantilla_whatsapp_id: '' }])
    }

    const updatePaso = useCallback((idx, field, val) => {
        setPasos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
    }, [])

    const removePaso = useCallback((idx) => {
        setPasos(prev => prev.filter((_, i) => i !== idx))
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await onSave({ editingSecuencia, secuenciaForm: form, pasos })
            onCancel()
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="card" style={{ padding: '24px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                        {editingSecuencia ? 'Editar Secuencia' : 'Nueva Secuencia'}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                        Configura el embudo automático para tus leads.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 10, fontWeight: 600 }}>
                        Cancelar
                    </button>
                    <button type="submit" form="secForm" className="btn btn-primary" disabled={saving} style={{ padding: '8px 24px', borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px rgba(250,114,55,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>💾</span> {saving ? 'Guardando...' : 'Guardar Secuencia'}
                    </button>
                </div>
            </div>

            <form id="secForm" onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 32, alignItems: 'start' }}>
                    {/* LEFT: Params */}
                    <div style={{ background: 'var(--color-bg-hover)', padding: 20, borderRadius: 16, border: '1px solid var(--color-border)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <span style={{ fontSize: '1.1rem' }}>⚙️</span> Parámetros
                        </h3>

                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                Formulario Origen
                                <span style={{ fontSize: '0.65rem', background: 'rgba(250,114,55,0.15)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 4 }}>Meta Ads</span>
                            </label>
                            {metaForms.length === 0 ? (
                                <div style={{ padding: '10px', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-secondary)', background: 'var(--color-bg)' }}>
                                    Sin formularios sincronizados.
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="form-control"
                                        value={form.tour_match}
                                        onChange={e => {
                                            const val = e.target.value
                                            setForm(f => ({ ...f, tour_match: val, nombre: val }))
                                            if (val && pasos.length === 0) {
                                                setPasos([{ dia_envio: 1, plantilla_email_id: '', plantilla_whatsapp_id: '' }])
                                            }
                                        }}
                                        required
                                        style={{ fontSize: '0.85rem', padding: '10px 12px', width: '100%', appearance: 'none', background: 'var(--color-bg)', border: '2px solid var(--color-border)', borderRadius: 10, outline: 'none', color: 'var(--color-text)' }}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {metaForms.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.7rem' }}>▼</div>
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Descripción (Opcional)</label>
                            <textarea
                                className="form-control"
                                value={form.descripcion}
                                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                                placeholder="Detalla el objetivo..."
                                style={{ fontSize: '0.85rem', padding: '10px', minHeight: 70, resize: 'none', borderRadius: 10, width: '100%', border: '2px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                            />
                        </div>

                        <div
                            onClick={() => setForm(f => ({ ...f, activa: !f.activa }))}
                            style={{ background: form.activa ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)', padding: '12px 16px', borderRadius: 12, border: `1px solid ${form.activa ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                            <div>
                                <div style={{ fontWeight: 800, color: form.activa ? '#059669' : 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{form.activa ? '🟢 Operando' : '⏸️ Pausada'}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{form.activa ? 'Envío Activo' : 'Borrador'}</div>
                            </div>
                            <div style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, background: form.activa ? '#10b981' : 'var(--color-border)', transition: '0.3s' }}>
                                <div style={{ position: 'absolute', top: 2, left: form.activa ? 20 : 2, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Steps */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Arquitectura de Pasos</h3>
                            <button type="button" className="btn btn-ghost" onClick={addPaso} style={{ color: 'var(--color-primary)', fontWeight: 700, padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', background: 'rgba(250,114,55,0.05)' }}>
                                + Añadir Paso
                            </button>
                        </div>

                        <div style={{ background: 'var(--color-bg)', padding: '20px 0 0 0', borderRadius: 16 }}>
                            {pasos.length === 0 ? (
                                <div className="elite-empty-state" style={{ padding: '30px 20px', border: '1px dashed var(--color-border)', borderRadius: 16 }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🛤️</div>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px 0' }}>Flujo Vacío</h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>Añade el primer punto de contacto.</p>
                                    <button type="button" className="btn btn-primary" onClick={addPaso} style={{ borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: '0.85rem' }}>+ Añadir Mensaje</button>
                                </div>
                            ) : (
                                <div style={{ position: 'relative', paddingLeft: 30 }}>
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 12, width: 2, background: 'var(--color-border)', borderRadius: 10 }} />

                                    {/* Start node */}
                                    <div style={{ position: 'relative', marginBottom: 20 }}>
                                        <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '2px solid var(--color-bg)', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)' }} />
                                        <div style={{ background: 'rgba(16,185,129,0.08)', padding: '6px 14px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                            <span>⚡</span> Entrada del Lead (Día 1)
                                        </div>
                                    </div>

                                    {pasos.map((p, idx) => (
                                        <PasoRow
                                            key={idx}
                                            paso={p}
                                            index={idx}
                                            prevDia={idx === 0 ? 0 : pasos[idx - 1].dia_envio}
                                            filteredEmail={filteredEmail}
                                            filteredWA={filteredWA}
                                            onUpdate={updatePaso}
                                            onRemove={removePaso}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}

// ── Main Secuencias tab ───────────────────────────────────────────────────────
function SecuenciasTab({
    secuencias, loadingSecs,
    plantillasEmail, plantillasWA, metaForms,
    masterSwitch, loadingMasterSwitch,
    cronStatus, autoEnrollCount, procesandoDrips,
    onSaveSecuencia, onDeleteSecuencia,
    onToggleMasterSwitch, onRunDripsCycle,
}) {
    const [showForm, setShowForm]       = useState(false)
    const [editing, setEditing]         = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)

    // Escape key closes form
    import('react').then(({ useEffect: ue }) => ue)   // eslint-disable no-eval
    // (direct hook usage is fine since this is a component function)

    function openNew()  { setEditing(null); setShowForm(true) }
    function openEdit(s){ setEditing(s);    setShowForm(true) }
    function closeForm(){ setShowForm(false); setEditing(null) }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Secuencia',
            message: '¿Eliminar esta secuencia? Todos los leads activos en ella serán detenidos.',
            danger: true,
            confirmLabel: '🗑️ Eliminar Secuencia',
            onConfirm: async () => {
                setConfirmDialog(null)
                await onDeleteSecuencia(id)
            }
        })
    }

    async function handleDrips() {
        const ok = await onRunDripsCycle()
        if (!ok) return
        setConfirmDialog({
            title: '🚀 Ejecutar Ciclo Manual',
            message: 'Esto procesará AHORA MISMO todos los correos pendientes en las secuencias activas.',
            danger: false,
            confirmLabel: '🚀 Ejecutar Ciclo',
            onConfirm: async () => {
                setConfirmDialog(null)
                // executeDripsCycle is called by parent
                onRunDripsCycle._execute?.()
            }
        })
    }

    return (
        <>
        {showForm ? (
            <SecuenciaForm
                editingSecuencia={editing}
                plantillasEmail={plantillasEmail}
                plantillasWA={plantillasWA}
                metaForms={metaForms}
                onSave={onSaveSecuencia}
                onCancel={closeForm}
            />
        ) : (
            <div>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            Autopilot Sequence Hub
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: masterSwitch ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '6px 14px', borderRadius: 20, border: `1px solid ${masterSwitch ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: masterSwitch ? '#10b981' : '#ef4444', boxShadow: `0 0 8px ${masterSwitch ? '#10b981' : '#ef4444'}` }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: masterSwitch ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                                    {masterSwitch ? 'Motor Encendido' : 'Motor Apagado'}
                                </span>
                            </div>
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem', marginTop: 8 }}>
                            Gestiona tus campañas de goteo (Drip) para mantener a tus leads comprometidos de forma 100% orgánica.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <button
                            className="btn"
                            style={{ background: masterSwitch ? 'var(--color-bg-elevated)' : '#ef4444', border: '1px solid var(--color-border)', color: masterSwitch ? 'var(--color-text)' : 'white', boxShadow: 'var(--shadow-sm)' }}
                            onClick={() => onToggleMasterSwitch(!masterSwitch)}
                            disabled={loadingMasterSwitch}
                        >
                            {loadingMasterSwitch ? '⏳ Guardando...' : masterSwitch ? '⏸️ Pausar Todo el Motor' : '▶️ Encender Motor'}
                        </button>
                        <button
                            className="btn"
                            style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            onClick={handleDrips}
                            disabled={procesandoDrips}
                        >
                            {procesandoDrips ? '⏳ Procesando...' : '🚀 Ejecutar Ciclo Manual'}
                        </button>
                        <button className="btn btn-primary" onClick={openNew} style={{ boxShadow: 'var(--shadow-primary-soft)' }}>
                            + Crear Nueva Secuencia
                        </button>
                    </div>
                </div>

                {/* System status cards */}
                {masterSwitch ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                        <div style={{ background: cronStatus === 'active' ? 'rgba(16,185,129,0.06)' : 'rgba(251,191,36,0.08)', border: `1px solid ${cronStatus === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(251,191,36,0.3)'}`, borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '1.8rem', marginTop: 2 }}>{cronStatus === 'active' ? '⏰' : '⚙️'}</div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: cronStatus === 'active' ? '#10b981' : '#f59e0b', marginBottom: 4 }}>
                                    {cronStatus === 'active' ? 'Cron Diario Activo' : 'Cron No Configurado'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                    {cronStatus === 'active'
                                        ? `Próxima ejecución: hoy a las ${new Date().getUTCHours() < 8 ? '08:00 UTC' : 'mañana 08:00 UTC'}`
                                        : 'Ejecuta el SQL de configuración para activar el horario automático'}
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '1.8rem', marginTop: 2 }}>⚡</div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#3b82f6', marginBottom: 4 }}>Auto-enrolados hoy</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-text)' }}>
                                    {autoEnrollCount ?? '...'}
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginLeft: 6 }}>leads</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '1.8rem', marginTop: 2 }}>🤖</div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#10b981', marginBottom: 4 }}>Autopilot Activo</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                    Leads nuevos se enrolan solos · Correos se envían según calendario
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px dashed #ef4444', padding: '16px 20px', borderRadius: 12, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ fontSize: '2rem' }}>⚠️</div>
                        <div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ef4444', fontWeight: 800 }}>Motor de Automatización Global Apagado</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Ningún correo automático será enviado. Enciende el motor con el botón de arriba para reanudar las secuencias activas.</p>
                        </div>
                    </div>
                )}

                {/* Sequence list */}
                {loadingSecs ? (
                    <div style={{ padding: '80px 0', textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px auto', borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
                        <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Sincronizando Autopilot...</p>
                    </div>
                ) : secuencias.length === 0 ? (
                    <div className="elite-empty-state">
                        <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>🛩️</div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>Tu Autopilot está inactivo</h3>
                        <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', maxWidth: 450, margin: '0 auto 30px auto', lineHeight: 1.6 }}>
                            Las secuencias te permiten vender mientras duermes.
                        </p>
                    </div>
                ) : (
                    <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                        <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: '0 12px' }}>
                            <thead>
                                <tr>
                                    {['Identidad de Secuencia', 'Arquitectura', 'Estado', 'Gestión'].map((h, i) => (
                                        <th key={h} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '0 20px', letterSpacing: '0.5px', textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {secuencias.map(s => (
                                    <tr key={s.id} className="elite-table-row">
                                        <td style={{ padding: '24px 20px', border: 'none', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)', marginBottom: 6 }}>{s.nombre}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                {s.tour_match ? s.tour_match.split(',').map((tag, i) => (
                                                    <span key={i} style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--color-primary-soft)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>📋 {tag.trim()}</span>
                                                )) : (
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>General (aplica a todos los formularios)</span>
                                                )}
                                            </div>
                                            {s.descripcion && <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.4, maxWidth: 350 }}>{s.descripcion}</div>}
                                        </td>
                                        <td style={{ padding: '24px 20px', border: 'none' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--color-bg)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                                <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{s.pasos?.length || 0} Pasos programados</div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '24px 20px', border: 'none' }}>
                                            <span className={`elite-badge ${s.activa ? 'elite-badge-success' : 'elite-badge-neutral'}`}>
                                                {s.activa ? '🟢 Activa / Operando' : '⏸️ Pausada'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '24px 20px', textAlign: 'right', border: 'none', borderTopRightRadius: 16, borderBottomRightRadius: 16 }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => openEdit(s)}>✏️ Ver / Editar</button>
                                                <button className="btn btn-ghost" style={{ padding: '8px 12px', color: 'var(--color-danger)' }} onClick={() => handleDelete(s.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        <ConfirmModal
            show={!!confirmDialog}
            title={confirmDialog?.title || ''}
            message={confirmDialog?.message || ''}
            danger={confirmDialog?.danger || false}
            confirmLabel={confirmDialog?.confirmLabel}
            onConfirm={confirmDialog?.onConfirm}
            onCancel={() => setConfirmDialog(null)}
        />
        </>
    )
}

export default memo(SecuenciasTab)
