import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import ConfirmModal from '../../../components/leads/modals/ConfirmModal';
import { TIPOS_PLANTILLA, TIPOS_MARKETING, TIPOS_OPERATIVAS, TIPOS_LABELS, SHORTCODES_HELP } from '../constants';

// WhatsApp API config keys stored in the configuracion table
const WA_CONFIG_KEYS = ['whatsapp_api_enabled', 'whatsapp_phone_id', 'whatsapp_access_token'];

export default function PlantillasWhatsAppTab({ showToast, agencia }) {
    const [plantillas, setPlantillas] = useState([])
    const [tours, setTours] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPlantilla, setEditingPlantilla] = useState(null)
    const [origenes, setOrigenes] = useState([])
    const [confirmDialog, setConfirmDialog] = useState(null)

    // WhatsApp API credentials state
    const [waConfig, setWaConfig] = useState({
        whatsapp_api_enabled: 'false',
        whatsapp_phone_id: '',
        whatsapp_access_token: '',
    })
    const [waTestLoading, setWaTestLoading] = useState(false)
    const [waSaving, setWaSaving] = useState(false)

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
        const [plantillasRes, toursRes, leadsRes, configRes] = await Promise.all([
            supabase.from('plantillas_whatsapp').select('*').eq('agencia_id', agencia.id).order('tipo'),
            supabase.from('tours').select('id, nombre').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('leads').select('form_name, tour_nombre').eq('agencia_id', agencia.id),
            supabase.from('configuracion').select('clave, valor').eq('agencia_id', agencia.id).in('clave', WA_CONFIG_KEYS)
        ])
        if (!plantillasRes.error) {
            const arr = plantillasRes.data || [];
            arr.sort((a,b) => TIPOS_PLANTILLA.indexOf(a.tipo) - TIPOS_PLANTILLA.indexOf(b.tipo))
            setPlantillas(arr)
        }
        if (!toursRes.error) setTours(toursRes.data || [])
        if (!leadsRes.error && leadsRes.data) {
            const stripDate = (name) => name
                .replace(/\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, '')
                .replace(/\s*[-–]\s*\d{4}[-/]\d{1,2}([-/]\d{1,2})?\s*$/i, '')
                .replace(/\s*[-–]\s*[A-Za-z]+\s+\d{4}\s*$/i, '')
                .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/i, '')
                .trim()
            const rawForms = leadsRes.data.map(l => l.form_name).filter(Boolean)
            const formNames = [...new Set(rawForms.map(stripDate))].sort()
            setOrigenes(formNames)
        }
        if (!configRes.error && configRes.data) {
            const map = { whatsapp_api_enabled: 'false', whatsapp_phone_id: '', whatsapp_access_token: '' }
            configRes.data.forEach(row => { map[row.clave] = row.valor })
            setWaConfig(map)
        }
        setLoading(false)
    }

    async function handleSaveWaConfig() {
        if (!agencia?.id) return
        setWaSaving(true)
        try {
            const upserts = WA_CONFIG_KEYS.map(clave => ({
                agencia_id: agencia.id,
                clave,
                valor: String(waConfig[clave] || ''),
            }))
            for (const row of upserts) {
                const { error } = await supabase.from('configuracion').upsert(row, { onConflict: 'agencia_id,clave' })
                if (error) throw error
            }
            showToast('✅ Credenciales de WhatsApp guardadas correctamente')
        } catch (err) {
            showToast('Error al guardar: ' + err.message, 'error')
        } finally {
            setWaSaving(false)
        }
    }

    async function handleTestWa() {
        if (!waConfig.whatsapp_phone_id || !waConfig.whatsapp_access_token) {
            showToast('Completa el Phone Number ID y el Access Token antes de probar.', 'error')
            return
        }
        setWaTestLoading(true)
        try {
            const res = await fetch(`https://graph.facebook.com/v18.0/${waConfig.whatsapp_phone_id}?fields=display_phone_number,verified_name&access_token=${waConfig.whatsapp_access_token}`)
            const data = await res.json()
            if (data.error) throw new Error(data.error.message)
            showToast(`✅ Conexión exitosa: ${data.verified_name} (${data.display_phone_number})`)
        } catch (err) {
            showToast('❌ Error de conexión: ' + err.message, 'error')
        } finally {
            setWaTestLoading(false)
        }
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

    function getCampaignLabel(p) {
        if (TIPOS_MARKETING.includes(p.tipo)) {
            return p.origen ? p.origen : 'General (Cualquier formulario)'
        }
        const tour = tours.find(t => t.id === p.tour_id)
        return tour ? tour.nombre : 'General (Todos los formularios)'
    }

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
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#25d36615', border: '1px solid #25d36630', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{p.nombre || 'Sin Nombre'}</span>
                        {getTipoBadge(p.tipo)}
                        <span style={{ fontSize: '0.72rem', color: '#25d366', background: '#25d36615', border: '1px solid #25d36630', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{p.idioma}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{isMarketing ? '📣 Formulario:' : '📋 Formulario:'}</span>
                        <span style={{ fontSize: '0.75rem', color: isMarketing ? '#f59e0b' : 'var(--color-accent)', fontWeight: 600, background: isMarketing ? '#f59e0b10' : 'var(--color-accent-soft)', padding: '2px 8px', borderRadius: 20, border: `1px solid ${isMarketing ? '#f59e0b30' : 'var(--color-accent-border, #8b5cf640)'}` }}>
                            {campaign}
                        </span>
                    </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* === WHATSAPP API CONFIGURATION === */}
            <div className="card" style={{ borderColor: waConfig.whatsapp_api_enabled === 'true' ? '#25d36640' : 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            WhatsApp Cloud API (Oficial)
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Conecta tu cuenta comercial para enviar mensajes automáticos.</p>
                    </div>
                    <div className="form-toggle">
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={waConfig.whatsapp_api_enabled === 'true'}
                                onChange={e => setWaConfig(prev => ({ ...prev, whatsapp_api_enabled: e.target.checked ? 'true' : 'false' }))}
                            />
                            <span className="slider round"></span>
                        </label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: waConfig.whatsapp_api_enabled === 'true' ? '#25d366' : 'var(--color-text-muted)' }}>
                            {waConfig.whatsapp_api_enabled === 'true' ? 'ACTIVADO' : 'DESACTIVADO'}
                        </span>
                    </div>
                </div>

                {waConfig.whatsapp_api_enabled === 'true' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0', borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Phone Number ID</label>
                                <input
                                    className="form-input"
                                    placeholder="Ej. 1048827361..."
                                    value={waConfig.whatsapp_phone_id}
                                    onChange={e => setWaConfig(prev => ({ ...prev, whatsapp_phone_id: e.target.value }))}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Access Token (Permanent)</label>
                                <input
                                    className="form-input"
                                    type="password"
                                    placeholder="EAAB..."
                                    value={waConfig.whatsapp_access_token}
                                    onChange={e => setWaConfig(prev => ({ ...prev, whatsapp_access_token: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={handleTestWa}
                                disabled={waTestLoading}
                                style={{ color: 'var(--color-text)' }}
                            >
                                {waTestLoading ? '🔄 Probando...' : '🧪 Probar Conexión'}
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSaveWaConfig}
                                disabled={waSaving}
                                style={{ background: '#25d366', borderColor: '#25d366' }}
                            >
                                {waSaving ? '🔄 Guardando...' : '💾 Guardar Credenciales'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Header & Templates */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>🛠️ Plantillas de WhatsApp</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>Gestiona los mensajes que se envían por cada canal.</p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm(null)} style={{ background: '#25d366', borderColor: '#25d366' }}>
                    📲 Nueva Plantilla
                </button>
            </div>

            {/* Shortcodes strip */}
            <div style={{ padding: '12px 16px', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, color: '#25d366' }}>✨ Variables Inteligentes</div>
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
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: '1.1rem' }}>🔥</span>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Módulo Marketing</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {marketingPlantillas.map(p => <WaCard key={p.id} p={p} />)}
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: '1.1rem' }}>💼</span>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Módulo Operaciones</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {operativasPlantillas.map(p => <WaCard key={p.id} p={p} />)}
                        </div>
                    </div>
                </div>
            )}

            {/* === MODAL FORM === */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="card modal-content" style={{ maxWidth: 680, padding: 0 }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{editingPlantilla ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
                            <button className="btn-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Nombre interno *</label>
                                <input className="form-input" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Bienvenida Marketing" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr', gap: 12 }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Tipo *</label>
                                    <select className="form-select" value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value, origen: '', tour_id: '' })}>
                                        <optgroup label="Marketing">
                                            {TIPOS_MARKETING.map(t => <option key={t} value={t}>{TIPOS_LABELS[t]}</option>)}
                                        </optgroup>
                                        <optgroup label="Operaciones">
                                            {TIPOS_OPERATIVAS.map(t => <option key={t} value={t}>{TIPOS_LABELS[t]}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    {TIPOS_MARKETING.includes(formData.tipo) ? (
                                        <>
                                            <label className="form-label">Campaña / Formulario</label>
                                            <select className="form-select" value={formData.origen || ''} onChange={e => setFormData({ ...formData, origen: e.target.value })}>
                                                <option value="">General</option>
                                                {origenes.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <label className="form-label">Tour / Formulario</label>
                                            <select className="form-select" value={formData.tour_id} onChange={e => setFormData({ ...formData, tour_id: e.target.value })}>
                                                <option value="">General</option>
                                                {tours.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                            </select>
                                        </>
                                    )}
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Idioma</label>
                                    <select className="form-select" value={formData.idioma} onChange={e => setFormData({ ...formData, idioma: e.target.value })}>
                                        <option value="ES">ES</option>
                                        <option value="EN">EN</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Mensaje *</label>
                                <textarea id="wa-textarea" className="form-textarea" rows={6} required value={formData.contenido} onChange={e => setFormData({ ...formData, contenido: e.target.value })} style={{ fontSize: '0.85rem' }} />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {SHORTCODES_HELP.map(s => (
                                        <button key={s.code} type="button" onClick={() => insertAtCursor(s.code)} style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: 4, background: '#25d36615', border: '1px solid #25d36620', color: '#25d366', fontWeight: 700 }}>{s.code}</button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ background: '#25d366', borderColor: '#25d366' }}>Guardar</button>
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
        </div>
    )
}