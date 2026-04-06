import React, { useEffect, useState } from 'react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LeadFormModal({
    show, onClose, editingLead, formData, setFormData, handleSave, leads
}) {
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)

    // Reset errors when modal opens/closes
    useEffect(() => {
        if (!show) { 
            setTimeout(() => {
                setErrors({})
                setSaving(false)
            }, 0)
        }
    }, [show])

    // Escape key
    useEffect(() => {
        if (!show) return
        const handle = (e) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handle, true)
        return () => document.removeEventListener('keydown', handle, true)
    }, [show, onClose])

    if (!show) return null

    function validate() {
        const errs = {}
        const nombre = (formData.nombre || '').trim()
        const email  = (formData.email  || '').trim()
        const tel    = (formData.telefono || '').trim()

        if (!nombre) errs.nombre = 'El nombre es requerido.'
        else if (nombre.length < 2) errs.nombre = 'Mínimo 2 caracteres.'
        else if (nombre.length > 120) errs.nombre = 'Máximo 120 caracteres.'

        if (email && !EMAIL_REGEX.test(email)) errs.email = 'Email inválido.'
        if (email && email.length > 200) errs.email = 'Email muy largo.'

        if (!email && !tel) errs.contact = 'Debe ingresar al menos un email o teléfono.'

        if (tel && tel.length > 30) errs.telefono = 'Teléfono muy largo.'

        return errs
    }

    async function handleSubmit() {
        const errs = validate()
        if (Object.keys(errs).length > 0) { setErrors(errs); return }
        setSaving(true)

        // Normalización de datos antes de guardar
        let nom = (formData.nombre || '').trim()
        if (nom) {
            nom = nom.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        }
        let tel = (formData.telefono || '').replace(/\s+/g, '').replace(/[^+\d]/g, '')
        let mail = (formData.email || '').toLowerCase().trim()

        const normalizedData = { ...formData, nombre: nom, telefono: tel, email: mail }
        setFormData(normalizedData)

        setTimeout(async () => {
             await handleSave(normalizedData)
             setSaving(false)
        }, 100)
    }

    const field = (label, key, type = 'text', placeholder = '') => (
        <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                {label}
            </label>
            <input
                type={type}
                className={`form-input${errors[key] ? ' form-input-error' : ''}`}
                placeholder={placeholder}
                value={formData[key] || ''}
                onChange={e => {
                    setFormData({ ...formData, [key]: e.target.value })
                    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
                }}
                style={errors[key] ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {}}
            />
            {errors[key] && (
                <span style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: 4, display: 'block' }}>
                    ⚠ {errors[key]}
                </span>
            )}
        </div>
    )

    const getFormsFromLeads = () => {
        const stripDate = (name) => name
            .replace(/\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, '')
            .replace(/\s*[-–]\s*\d{4}[-/]\d{1,2}([-/]\d{1,2})?\s*$/i, '')
            .replace(/\s*[-–]\s*[A-Za-z]+\s+\d{4}\s*$/i, '')
            .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/i, '')
            .trim()
        const raw = (leads || []).map(l => l.form_name || l.tour_nombre).filter(Boolean)
        return [...new Set(raw.map(stripDate))].sort()
    }
    const formOptions = getFormsFromLeads()

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--color-primary) 0%, #3b82f6 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {editingLead ? '✏️ Editar Lead' : '✨ Nuevo Lead'}
                        </h2>
                        <button onClick={onClose}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'rgba(255,255,255,0.8)' }}>
                            ✕
                        </button>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.8 }}>Esc para cerrar</p>
                </div>

                {/* Form body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Nombre */}
                    {field('Nombre / Cliente *', 'nombre', 'text', 'Ej: Juan Pérez')}

                    {/* Email + Teléfono */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                Email
                            </label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="ejemplo@correo.com"
                                value={formData.email || ''}
                                onChange={e => {
                                    setFormData({ ...formData, email: e.target.value })
                                    setErrors(prev => { const n = { ...prev }; delete n.email; delete n.contact; return n })
                                }}
                                style={errors.email ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {}}
                            />
                            {errors.email && <span style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: 4, display: 'block' }}>⚠ {errors.email}</span>}
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                Teléfono (WhatsApp)
                            </label>
                            <input
                                type="tel"
                                className="form-input"
                                placeholder="+51 999 888 777"
                                value={formData.telefono || ''}
                                onChange={e => {
                                    setFormData({ ...formData, telefono: e.target.value })
                                    setErrors(prev => { const n = { ...prev }; delete n.telefono; delete n.contact; return n })
                                }}
                                style={errors.telefono ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {}}
                            />
                            {errors.telefono && <span style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: 4, display: 'block' }}>⚠ {errors.telefono}</span>}
                        </div>
                    </div>

                    {/* Contact error (at least one required) */}
                    {errors.contact && (
                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                            ⚠ {errors.contact}
                        </div>
                    )}

                    {/* Estado + Tour */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Estado *</label>
                            <select className="form-input" value={formData.estado || 'nuevo'}
                                onChange={e => setFormData({ ...formData, estado: e.target.value })}>
                                {['nuevo', 'contactado', 'cotizado', 'reservado'].map(st => (
                                    <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Formulario (Origen)</label>
                            <select className="form-input" value={formData.tour_nombre || ''}
                                onChange={e => setFormData({ ...formData, tour_nombre: e.target.value, form_name: e.target.value })}>
                                <option value="">No especificado</option>
                                {formOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Origen y Temporada */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Origen</label>
                            <select className="form-input" value={formData.origen || 'Orgánico / Manual'}
                                onChange={e => setFormData({ ...formData, origen: e.target.value })}>
                                {['Orgánico / Manual', 'Web', 'Facebook Ads', 'Instagram Ads', 'Meta Ads', 'TikTok', 'Referido'].map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Temporada de Viaje</label>
                            <select className="form-input" value={formData.temporada || ''}
                                onChange={e => setFormData({ ...formData, temporada: e.target.value })}>
                                <option value="">No especificado</option>
                                <option value="buena_temporada">Buena Temporada / Seca</option>
                                <option value="temporada_lluvia">Temporada de Lluvias</option>
                            </select>
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Notas</label>
                        <textarea
                            className="form-input"
                            placeholder="Notas adicionales sobre el lead..."
                            rows={3}
                            value={formData.notas || ''}
                            onChange={e => setFormData({ ...formData, notas: e.target.value })}
                            style={{ resize: 'vertical', minHeight: 64 }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 24px', background: 'var(--color-bg-hover)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex', justifyContent: 'flex-end', gap: 12
                }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}
                        style={{ minWidth: 130 }}>
                        {saving ? '⏳ Guardando...' : (editingLead ? '💾 Guardar Cambios' : '✨ Crear Lead')}
                    </button>
                </div>
            </div>
        </div>
    )
}
