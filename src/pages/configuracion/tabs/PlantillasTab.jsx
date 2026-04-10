import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import ConfirmModal from '../../../components/leads/modals/ConfirmModal';
import EliteEmailEditor from '../../../components/leads/EliteEmailEditor';
import { CONFIG_KEYS, EMAIL_CONFIG_KEYS, TIPOS_PLANTILLA, TIPOS_MARKETING, TIPOS_OPERATIVAS, TIPOS_LABELS, SHORTCODES_HELP } from '../constants';

export default function PlantillasTab({ showToast, agencia }) {
    const [plantillas, setPlantillas] = useState([])
    const [productos, setProductos] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPlantilla, setEditingPlantilla] = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)
    const [metaForms, setMetaForms] = useState([])

    const [formData, setFormData] = useState({
        nombre: '',
        tipo: TIPOS_PLANTILLA[0],
        producto_id: '',
        origen: '',
        asunto: '',
        contenido_html: '',
        idioma: 'ES',
    })

    const insertShortcodeEmail = (shortcode) => {
        setFormData(prev => ({ ...prev, contenido_html: (prev.contenido_html || '') + shortcode }));
    };

    useEffect(() => { 
        if(agencia?.id) loadData() 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia?.id])

    async function loadData() {
        setLoading(true)
        const [plantillasRes, productosRes, leadsRes] = await Promise.all([
            supabase.from('plantillas_email').select('*').eq('agencia_id', agencia.id).order('tipo'),
            supabase.from('productos').select('id, nombre').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('leads').select('form_name').not('form_name', 'is', null)
        ])

        if (!plantillasRes.error) {
            const arr = plantillasRes.data || [];
            arr.sort((a,b) => TIPOS_PLANTILLA.indexOf(a.tipo) - TIPOS_PLANTILLA.indexOf(b.tipo))
            setPlantillas(arr)
        }
        if (!productosRes.error) setProductos(productosRes.data || [])
        if (leadsRes.data && leadsRes.data.length > 0) {
            const unique = [...new Set(leadsRes.data.filter(d => !!d.form_name).map(d => d.form_name))].sort();
            setMetaForms(unique);
        }
        setLoading(false)
    }

    function openForm(plantilla = null) {
        if (plantilla) {
            setEditingPlantilla(plantilla)
            setFormData({
                nombre: plantilla.nombre || '',
                tipo: plantilla.tipo || TIPOS_PLANTILLA[0],
                producto_id: plantilla.producto_id || '',
                origen: plantilla.origen || '',
                asunto: plantilla.asunto || '',
                contenido_html: plantilla.contenido_html || '',
                idioma: plantilla.idioma || 'ES',
            })
        } else {
            setEditingPlantilla(null)
            setFormData({
                nombre: '', tipo: TIPOS_PLANTILLA[0], producto_id: '', origen: '', asunto: '',
                contenido_html: '', idioma: 'ES',
            })
        }
        setShowForm(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        try {
            const payload = { ...formData, agencia_id: agencia.id }
            
            // Clean up mutually exclusive fields based on phase to fix corrupt historical DB state
            if (TIPOS_MARKETING.includes(payload.tipo)) {
                payload.producto_id = null;
                if (payload.origen === '') payload.origen = null;
            } else {
                payload.origen = null;
                if (payload.producto_id === '') payload.producto_id = null;
            }

            if (editingPlantilla) {
                const { error } = await supabase.from('plantillas_email').update(payload).eq('id', editingPlantilla.id)
                if (error) throw error
                showToast('Plantilla actualizada correctamente')
            } else {
                const { error } = await supabase.from('plantillas_email').insert([payload])
                if (error) throw error
                showToast('Plantilla creada exitosamente')
            }
            setShowForm(false)
            loadData()
        } catch (err) {
            console.error(err)
            showToast('Error al guardar: ' + err.message, 'error')
        }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Plantilla',
            message: '¿Eliminar esta plantilla?',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('plantillas_email').delete().eq('id', id)
                    if (error) throw error
                    showToast('Plantilla eliminada')
                    loadData()
                } catch (err) {
                    console.error(err)
                    showToast('Error al eliminar: ' + err.message, 'error')
                }
            }
        })
    }

    if (loading) {
        return <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Cargando plantillas…</div>
    }

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Plantillas de Email</h2>
                <button className="btn btn-primary" onClick={() => openForm(null)}>+ Nueva Plantilla</button>
            </div>

            {plantillas.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">✉️</div>
                    <div className="empty-state-text">No hay plantillas de email</div>
                    <div className="empty-state-sub">Crea plantillas para enviar cotizaciones, confirmaciones y primeros contactos automáticamente.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                    {/* Marketing Section */}
                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 12 }}>🔥 Módulo: Marketing & Leads</h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fase de Embudo</th>
                                        <th>Nombre & Asunto</th>
                                        <th>Formulario Asoc.</th>
                                        <th>Idioma</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantillas.filter(p => TIPOS_MARKETING.includes(p.tipo)).map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <span className="badge badge-nuevo" style={{ fontWeight: 800 }}>{TIPOS_LABELS[p.tipo] || p.tipo}</span>
                                            </td>
                                            <td style={{ fontWeight: 500, color: 'var(--color-text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <div style={{ color: 'var(--color-accent)', fontWeight: 700, marginBottom: 2, fontSize: '0.85rem' }}>{p.nombre || 'Sin Nombre'}</div>
                                                <div style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>{p.asunto || '—'}</div>
                                            </td>
                                            <td>{productos.find(t => t.id === p.producto_id)?.nombre || p.origen || 'General'}</td>
                                            <td>{p.idioma}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openForm(p)}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-danger)' }}>🗑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {plantillas.filter(p => TIPOS_MARKETING.includes(p.tipo)).length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Sin plantillas de Marketing creadas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 12 }}>💼 Módulo: Operaciones & Ventas</h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Tipo de Documento</th>
                                        <th>Nombre & Asunto</th>
                                        <th>Formulario Asoc.</th>
                                        <th>Idioma</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantillas.filter(p => TIPOS_OPERATIVAS.includes(p.tipo)).map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <span className={`badge badge-${p.tipo === 'cotizacion' ? 'cotizado' : p.tipo === 'confirmacion' ? 'confirmada' : p.tipo === 'recordatorio' ? 'pendiente' : 'completada'}`} style={{ fontWeight: 700 }}>
                                                    {TIPOS_LABELS[p.tipo] || p.tipo}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 500, color: 'var(--color-text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <div style={{ color: 'var(--color-accent)', fontWeight: 700, marginBottom: 2, fontSize: '0.85rem' }}>{p.nombre || 'Sin Nombre'}</div>
                                                <div style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>{p.asunto || '—'}</div>
                                            </td>
                                            <td>{productos.find(t => t.id === p.producto_id)?.nombre || p.origen || 'General'}</td>
                                            <td>{p.idioma}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openForm(p)}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-danger)' }}>🗑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {plantillas.filter(p => TIPOS_OPERATIVAS.includes(p.tipo)).length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Sin plantillas de Ventas creadas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Form */}
            {showForm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20
                }} onClick={() => setShowForm(false)}>
                    <div className="card" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                                {editingPlantilla ? 'Editar Plantilla' : 'Nueva Plantilla'}
                            </h2>
                            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                                <div className="form-group">
                                <label className="form-label">Nombre de Plantilla Interno *</label>
                                <input className="form-input" required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Salkantay Inglés 2026" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Sector / Tipo de Email *</label>
                                    <select className="form-select" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value, producto_id: '', origen: '' })}>
                                        <optgroup label="🔥 Fase de Marketing (Leads)">
                                            {TIPOS_MARKETING.map(t => <option key={t} value={t}>{TIPOS_LABELS[t]}</option>)}
                                        </optgroup>
                                        <optgroup label="💼 Fase de Operaciones (Ventas)">
                                            {TIPOS_OPERATIVAS.map(t => <option key={t} value={t}>{TIPOS_LABELS[t]}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="form-group">
                                    {TIPOS_MARKETING.includes(formData.tipo || '') ? (
                                        <>
                                            <label className="form-label">📣 Campaña / Formulario Meta</label>
                                            <select className="form-select" value={formData.origen || ''} onChange={(e) => setFormData({ ...formData, origen: e.target.value })}>
                                                <option value="">General (Cualquier campaña)</option>
                                                {metaForms.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <label className="form-label">📋 Formulario de Origen</label>
                                            <select className="form-select" value={formData.producto_id || ''} onChange={(e) => setFormData({ ...formData, producto_id: e.target.value })}>
                                                <option value="">General (Todos los formularios)</option>
                                                {productos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                            </select>
                                        </>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Idioma</label>
                                    <select className="form-select" value={formData.idioma} onChange={(e) => setFormData({ ...formData, idioma: e.target.value })}>
                                        <option value="ES">Español</option>
                                        <option value="EN">Inglés</option>
                                        <option value="PT">Portugués</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Asunto del Email *</label>
                                <input className="form-input" required value={formData.asunto} onChange={(e) => setFormData({ ...formData, asunto: e.target.value })} placeholder="Ej. Tu cotización para {producto} — {agencia}" />
                            </div>
                            
                            <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span className="form-label" style={{ marginBottom: 0 }}>Editor de Diseño de Plantilla</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: '0.7rem', background: '#3b82f620', padding: '4px 8px', borderRadius: 4, color: '#3b82f6', fontWeight: 800 }}>TipTap Editor Premium ✍️</span>
                                    </div>
                                </label>
                                
                                <EliteEmailEditor 
                                    value={formData.contenido_html || ''}
                                    onChange={(html) => setFormData({...formData, contenido_html: html})}
                                />
                            </div>
                                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--color-bg-elevated)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 10, color: 'var(--color-primary)' }}>✨ Variables Dinámicas (Haz clic para insertar)</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {SHORTCODES_HELP.filter(s => TIPOS_MARKETING.includes((formData.tipo||'').split('::')[0]) ? !['{fecha}', '{pax}', '{precio}', '{adelanto}', '{saldo}', '{extras}'].includes(s.code) : true).map(s => (
                                            <button 
                                                type="button" 
                                                key={s.code} 
                                                onClick={(e) => { e.preventDefault(); insertShortcodeEmail(s.code); }} 
                                                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'transform 0.1s, opacity 0.2s', outline: 'none' }}
                                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.opacity = '0.9'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1'; }}
                                            >
                                                {s.code}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--color-bg-hover)', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.95rem' }}>
                                    {editingPlantilla ? 'Guardar Cambios' : 'Crear Plantilla'}
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

/* ==========================================
   TAB 3: Plantillas de WhatsApp
   ========================================== */
