import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import ConfirmModal from '../../../components/leads/modals/ConfirmModal';
import { CONFIG_KEYS, EMAIL_CONFIG_KEYS, TIPOS_PLANTILLA, TIPOS_MARKETING, TIPOS_OPERATIVAS, TIPOS_LABELS, SHORTCODES_HELP } from '../constants';

export default function PlantillasWhatsAppTab({ showToast, agencia }) {
    const [plantillas, setPlantillas] = useState([])
    const [tours, setTours] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPlantilla, setEditingPlantilla] = useState(null)
    const [origenes, setOrigenes] = useState([])
    const [confirmDialog, setConfirmDialog] = useState(null)

    const [formData, setFormData] = useState({
        nombre: '', tipo: TIPOS_PLANTILLA[0], tour_id: '', origen: '',
        contenido: '', idioma: 'ES',
    })

    const insertAtCursor = (shortcode) => {
        const textarea = document.getElementById('wa-textarea')
        if (!textarea) { setFormData(prev => ({ ...prev, contenido: prev.contenido + shortcode })); return }
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = formData.contenido
        setFormData({ ...formData, contenido: text.substring(0, start) + shortcode + text.substring(end) })
        setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + shortcode.length; textarea.focus() }, 0)
    }

    useEffect(() => { 
        if(agencia?.id) loadData() 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia?.id])

    async function loadData() {
        setLoading(true)
        const [plantillasRes, toursRes, leadsRes] = await Promise.all([
            supabase.from('plantillas_whatsapp').select('*').eq('agencia_id', agencia.id).order('tipo'),
            supabase.from('tours').select('id, nombre').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('leads').select('form_name, tour_nombre').eq('agencia_id', agencia.id)
        ])
        if (!plantillasRes.error) {
            const arr = plantillasRes.data || [];
            arr.sort((a,b) => TIPOS_PLANTILLA.indexOf(a.tipo) - TIPOS_PLANTILLA.indexOf(b.tipo))
            setPlantillas(arr)
        }
        if (!toursRes.error) setTours(toursRes.data || [])
        if (!leadsRes.error && leadsRes.data) {
            // Normalize Meta form names: strip date suffixes like " - 21/02/26", " - Feb 2026", " - 2026-02", etc.
            const stripDate = (name) => name
                .replace(/\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, '')   // " - 21/02/26"
                .replace(/\s*[-–]\s*\d{4}[-/]\d{1,2}([-/]\d{1,2})?\s*$/i, '') // " - 2026-02-21"
                .replace(/\s*[-–]\s*[A-Za-z]+\s+\d{4}\s*$/i, '')             // " - Feb 2026"
                .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/i, '')       // " (21/02/26)"
                .trim()

            const rawForms = leadsRes.data.map(l => l.form_name).filter(Boolean)
            const formNames = [...new Set(rawForms.map(stripDate))].sort()
            setOrigenes(formNames)

        }
        setLoading(false)
    }

    function openForm(plantilla = null) {
        if (plantilla) {
            setEditingPlantilla(plantilla)
            setFormData({
                nombre: plantilla.nombre || '',
                tipo: plantilla.tipo || TIPOS_PLANTILLA[0],
                tour_id: plantilla.tour_id || '',
                origen: plantilla.origen || '',
                contenido: plantilla.contenido || '',
                idioma: plantilla.idioma || 'ES',
            })
        } else {
            setEditingPlantilla(null)
            setFormData({ nombre: '', tipo: TIPOS_PLANTILLA[0], tour_id: '', origen: '', contenido: '', idioma: 'ES' })
        }
        setShowForm(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        try {
            const payload = { ...formData, agencia_id: agencia.id }
            
            // Clean up mutually exclusive fields based on phase
            if (TIPOS_MARKETING.includes(payload.tipo)) {
                payload.tour_id = null;
                if (payload.origen === '') payload.origen = null;
            } else {
                payload.origen = null;
                if (payload.tour_id === '') payload.tour_id = null;
            }
            
            if (editingPlantilla) {
                const { error } = await supabase.from('plantillas_whatsapp').update(payload).eq('id', editingPlantilla.id)
                if (error) throw error
                showToast('✅ Plantilla WhatsApp actualizada')
            } else {
                const { error } = await supabase.from('plantillas_whatsapp').insert([payload])
                if (error) throw error
                showToast('✅ Plantilla WhatsApp creada')
            }
            setShowForm(false)
            loadData()
        } catch (err) { showToast('Error al guardar: ' + err.message, 'error') }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Plantilla de WhatsApp',
            message: '¿Eliminar esta plantilla de WhatsApp?',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('plantillas_whatsapp').delete().eq('id', id)
                    if (error) throw error
                    showToast('Plantilla eliminada')
                    loadData()
                } catch (err) { showToast('Error al eliminar: ' + err.message, 'error') }
            }
        })
    }

    // Get display name for formulario/origen column
    function getCampaignLabel(p) {
        if (TIPOS_MARKETING.includes(p.tipo)) {
            return p.origen ? p.origen : 'General (Cualquier formulario)'
        }
        const tour = tours.find(t => t.id === p.tour_id)
        return tour ? tour.nombre : 'General (Todos los formularios)'
    }

    // Colored badge per tipo
    function getTipoBadge(tipo) {
        const colors = {
            lead_primer_contacto: { bg: '#22c55e20', color: '#22c55e', border: '#22c55e40' },
            lead_seguimiento:     { bg: '#f59e0b20', color: '#f59e0b', border: '#f59e0b40' },
            lead_reenganche:      { bg: '#8b5cf620', color: '#8b5cf6', border: '#8b5cf640' },
            cotizacion:           { bg: '#3b82f620', color: '#3b82f6', border: '#3b82f640' },
            confirmacion:         { bg: '#10b98120', color: '#10b981', border: '#10b98140' },
            recordatorio:         { bg: '#f97316',   color: '#f97316', border: '#f9731640' },
            resena:               { bg: '#ec489920', color: '#ec4899', border: '#ec489940' },
        }
        const s = colors[tipo] || { bg: '#64748b20', color: '#64748b', border: '#64748b40' }
        return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{TIPOS_LABELS[tipo] || tipo}</span>
    }

    // Card component for each WhatsApp template
    function WaCard({ p }) {
        const isMarketing = TIPOS_MARKETING.includes(p.tipo)
        const campaign = getCampaignLabel(p)
        const preview = (p.contenido || '').replace(/\n/g, ' ').substring(0, 100)
        return (
            <div style={{
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 16,
                alignItems: 'flex-start', transition: 'border-color 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#25d36640'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
                {/* WA bubble icon */}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#25d36615', border: '1px solid #25d36630', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{p.nombre || 'Sin Nombre'}</span>
                        {getTipoBadge(p.tipo)}
                        <span style={{ fontSize: '0.72rem', color: '#25d366', background: '#25d36615', border: '1px solid #25d36630', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{p.idioma}</span>
                    </div>
                    {/* Formulario / Campaign tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{isMarketing ? '📣 Formulario:' : '📋 Formulario:'}</span>
                        <span style={{ fontSize: '0.75rem', color: isMarketing ? '#f59e0b' : 'var(--color-accent)', fontWeight: 600, background: isMarketing ? '#f59e0b10' : 'var(--color-accent-soft)', padding: '2px 8px', borderRadius: 20, border: `1px solid ${isMarketing ? '#f59e0b30' : 'var(--color-accent-border, #8b5cf640)'}` }}>
                            {campaign}
                        </span>
                    </div>
                    {/* Message preview bubble */}
                    <div style={{ background: '#25d36610', border: '1px solid #25d36620', borderRadius: '4px 12px 12px 12px', padding: '8px 12px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                        {preview ? `"${preview}${p.contenido?.length > 100 ? '…' : ''}"` : '— Sin mensaje —'}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openForm(p)} title="Editar">✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-danger)' }} title="Eliminar">🗑</button>
                </div>
            </div>
        )
    }

    if (loading) return <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Cargando plantillas WhatsApp…</div>

    const marketingPlantillas = plantillas.filter(p => TIPOS_MARKETING.includes(p.tipo))
    const operativasPlantillas = plantillas.filter(p => TIPOS_OPERATIVAS.includes(p.tipo))

    return (
        <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 2 }}>📲 Plantillas de WhatsApp</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''} · Mensajes listos para enviar con 1 clic desde Leads
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm(null)} style={{ background: '#25d366', borderColor: '#25d366' }}>
                    📲 Nueva Plantilla
                </button>
            </div>

            {/* Shortcodes strip */}
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8, color: '#25d366' }}>✨ Variables disponibles en los mensajes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                    {SHORTCODES_HELP.map(s => (
                        <span key={s.code} style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)' }}>
                            <code style={{ background: 'rgba(37,211,102,0.12)', padding: '2px 5px', borderRadius: 4, color: '#25d366', fontWeight: 700 }}>{s.code}</code>
                            {' '}{s.desc}
                        </span>
                    ))}
                </div>
            </div>

            {plantillas.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📲</div>
                    <div className="empty-state-text">No hay plantillas de WhatsApp</div>
                    <div className="empty-state-sub">Crea plantillas para primeros contactos, confirmaciones y recordatorios por WhatsApp.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                    {/* === MARKETING MODULE === */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: '1.1rem' }}>🔥</span>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Módulo Marketing & Leads</h3>
                            <span style={{ background: '#f59e0b20', color: '#f59e0b', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{marketingPlantillas.length}</span>
                        </div>
                        {marketingPlantillas.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', border: '1px dashed var(--color-border)', borderRadius: 10 }}>
                                Sin plantillas de Marketing. Crea tu primer contacto automático.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {marketingPlantillas.map(p => <WaCard key={p.id} p={p} />)}
                            </div>
                        )}
                    </div>

                    {/* === OPERATIONS MODULE === */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: '1.1rem' }}>💼</span>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Módulo Operaciones & Reservas</h3>
                            <span style={{ background: 'var(--color-accent-soft, rgba(139,92,246,0.1))', color: 'var(--color-accent)', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{operativasPlantillas.length}</span>
                        </div>
                        {operativasPlantillas.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', border: '1px dashed var(--color-border)', borderRadius: 10 }}>
                                Sin plantillas de Reservas creadas.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {operativasPlantillas.map(p => <WaCard key={p.id} p={p} />)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* === MODAL FORM === */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }} onClick={() => setShowForm(false)}>
                    <div className="card" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }} onClick={e => e.stopPropagation()}>
                        {/* Modal header with WhatsApp green */}
                        <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b0d 100%)', borderBottom: '2px solid #25d36640', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#25d36620', border: '1px solid #25d36640', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                                    {editingPlantilla ? 'Editar Plantilla WhatsApp' : 'Nueva Plantilla WhatsApp'}
                                </h2>
                            </div>
                            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ padding: 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                                {/* Nombre */}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Nombre interno *</label>
                                    <input className="form-input" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Inka Jungle - Primer Contacto ES" />
                                </div>

                                {/* Tipo + Campaña/Tour + Idioma */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.6fr', gap: 12 }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Tipo de Mensaje *</label>
                                        <select className="form-select" value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value, origen: '', tour_id: '' })}>
                                            <optgroup label="🔥 Marketing (Leads)">
                                                {TIPOS_MARKETING.map(t => <option key={t} value={t}>{TIPOS_LABELS[t]}</option>)}
                                            </optgroup>
                                            <optgroup label="💼 Operaciones (Reservas)">
                                                {TIPOS_OPERATIVAS.map(t => <option key={t} value={t}>{TIPOS_LABELS[t]}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>

                                    <div className="form-group" style={{ margin: 0 }}>
                                        {TIPOS_MARKETING.includes(formData.tipo) ? (
                                            <>
                                                <label className="form-label">📣 Campaña / Formulario Meta</label>
                                                <select className="form-select" value={formData.origen || ''} onChange={e => setFormData({ ...formData, origen: e.target.value })}>
                                                    <option value="">General (Cualquier campaña)</option>
                                                    {origenes.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label className="form-label">📋 Formulario de Origen</label>
                                                <select className="form-select" value={formData.tour_id} onChange={e => setFormData({ ...formData, tour_id: e.target.value })}>
                                                    <option value="">General (Todos los formularios)</option>
                                                    {tours.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                                </select>
                                            </>
                                        )}
                                    </div>

                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Idioma</label>
                                        <select className="form-select" value={formData.idioma} onChange={e => setFormData({ ...formData, idioma: e.target.value })}>
                                            <option value="ES">Español</option>
                                            <option value="EN">English</option>
                                            <option value="PT">Português</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Textarea */}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Mensaje de WhatsApp *</label>
                                    <textarea
                                        id="wa-textarea"
                                        className="form-textarea"
                                        rows={9}
                                        required
                                        value={formData.contenido}
                                        onChange={e => setFormData({ ...formData, contenido: e.target.value })}
                                        placeholder={
                                            TIPOS_MARKETING.includes(formData.tipo)
                                                ? '¡Hola {nombre}! 👋\n\nVi que pediste info sobre nuestros tours en Meta.\n¿Te gustaría recibir los precios y fechas disponibles?\n\n- {remitente}\n{agencia}'
                                                : 'Hola {nombre} 👋\n\n🏔️ Tour: {tour}\n📅 Fecha: {FechaViaje}\n👥 Pasajeros: {pax}\n💰 Total: ${precio}\n📌 Saldo: ${saldo}\n\n¡Nos vemos pronto! 🌟\n{remitente}'
                                        }
                                        style={{ fontFamily: 'inherit', fontSize: '0.85rem', lineHeight: 1.6, background: '#0f1117' }}
                                    />
                                </div>

                                {/* Shortcode buttons */}
                                <div style={{ padding: '12px 16px', background: '#25d36608', borderRadius: 10, border: '1px solid #25d36620' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 10, color: '#25d366' }}>✨ Insertar variable (clic para añadir al mensaje)</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {SHORTCODES_HELP
                                            .filter(s => TIPOS_MARKETING.includes(formData.tipo) ? !['{fecha}', '{pax}', '{precio}', '{adelanto}', '{saldo}', '{opcionales}'].includes(s.code) : true)
                                            .map(s => (
                                            <button
                                                type="button" key={s.code}
                                                onClick={e => { e.preventDefault(); insertAtCursor(s.code) }}
                                                style={{ background: '#25d36618', color: '#25d366', border: '1px solid #25d36630', padding: '5px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#25d36630'}
                                                onMouseOut={e => e.currentTarget.style.background = '#25d36618'}
                                            >{s.code}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--color-bg-hover)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ background: '#25d366', borderColor: '#25d366', padding: '10px 28px' }}>
                                    {editingPlantilla ? '💾 Guardar Cambios' : '📲 Crear Plantilla'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ConfirmModal
                show={!!confirmDialog}
                title={confirmDialog?.title || ''}
                message={confirmDialog?.message || ''}
                danger={confirmDialog?.danger || false}
                confirmLabel={confirmDialog?.confirmLabel}
                onConfirm={confirmDialog?.onConfirm}
                onClose={() => setConfirmDialog(null)}
            />
        </>
    )
}



