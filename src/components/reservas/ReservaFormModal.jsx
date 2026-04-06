/**
 * ReservaFormModal — Full CRUD modal for reservations.
 * Multi-tour itinerary builder + opcionales + global fields.
 * Used via React.lazy() from ReservasPage to defer heavy imports.
 */
import React, { useCallback } from 'react'

const ESTADOS_RESERVA = ['pendiente', 'confirmada', 'completada', 'cancelada']

function ReservaFormModal({
    show,
    editingReserva,
    formData,
    setFormData,
    handleSave,
    tours,
    operadores,
    opcionalesList,
    descuentosList,
    setToursList,
    setOpcionalesLista,
    handlePaxChange,
    onClose,
}) {
    if (!show) return null

    // ── Tour row handlers ──
    const addTour = () =>
        setToursList([...formData.tours_list, { tour_id: '', fecha_tour: '', precio_venta: 0, costo_operador: 0, operador_id: '' }])

    const removeTour = (idx) =>
        setToursList(formData.tours_list.filter((_, i) => i !== idx))

    const updateTourField = (idx, key, value) => {
        const newList = formData.tours_list.map((item, i) => i === idx ? { ...item, [key]: value } : item)
        setToursList(newList)
    }

    const handleTourSelect = (idx, tourId) => {
        const selectedTour = tours.find(x => x.id === tourId)
        updateTourField(idx, 'tour_id', tourId)
        const newList = formData.tours_list.map((item, i) =>
            i === idx ? {
                ...item,
                tour_id: tourId,
                precio_venta: selectedTour ? selectedTour.precio_usd : item.precio_venta,
                costo_operador: selectedTour ? selectedTour.costo_operador : item.costo_operador
            } : item
        )
        setToursList(newList)
    }

    // ── Opcional row handlers ──
    const addOpcional = () =>
        setOpcionalesLista([...formData.opcionales_list, { opcional_id: '', fecha_opcional: '', precio_venta: 0, costo_operador: 0 }])

    const removeOpcional = (idx) =>
        setOpcionalesLista(formData.opcionales_list.filter((_, i) => i !== idx))

    const handleOpcionalSelect = (idx, opcionalId) => {
        const selectedOpc = opcionalesList.find(x => x.id === opcionalId)
        const newList = formData.opcionales_list.map((item, i) =>
            i === idx ? {
                ...item,
                opcional_id: opcionalId,
                precio_venta: selectedOpc ? selectedOpc.precio_usd : item.precio_venta,
                costo_operador: selectedOpc ? selectedOpc.costo_operador : item.costo_operador
            } : item
        )
        setOpcionalesLista(newList)
    }

    const updateOpcionalField = (idx, key, value) => {
        const newList = formData.opcionales_list.map((item, i) => i === idx ? { ...item, [key]: value } : item)
        setOpcionalesLista(newList)
    }

    const rowStyle = {
        display: 'grid', gap: 8, marginBottom: 12,
        background: 'var(--color-bg-hover)', padding: 12, borderRadius: 6, alignItems: 'end'
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 20 }}>
                    {editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}
                </h2>

                <form onSubmit={handleSave}>
                    {/* ── Datos de cliente ── */}
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        Datos del Cliente
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                        <div className="form-group">
                            <label className="form-label">Nombre *</label>
                            <input className="form-input" required value={formData.cliente_nombre} onChange={e => setFormData({ ...formData, cliente_nombre: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">WhatsApp</label>
                            <input className="form-input" value={formData.cliente_telefono} onChange={e => setFormData({ ...formData, cliente_telefono: e.target.value })} placeholder="+51..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={formData.cliente_email} onChange={e => setFormData({ ...formData, cliente_email: e.target.value })} />
                        </div>
                    </div>

                    {/* ── Constructor de Tours ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', margin: 0 }}>Constructor de Itinerario (Tours)</h3>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={addTour}>+ Agregar Tour</button>
                    </div>

                    {formData.tours_list.map((t, idx) => (
                        <div key={idx} style={{ ...rowStyle, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr auto' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Tour</label>
                                <select className="form-select" value={t.tour_id || ''} onChange={e => handleTourSelect(idx, e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {tours.map(tour => <option key={tour.id} value={tour.id}>{tour.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Fecha</label>
                                <input type="date" className="form-input" value={t.fecha_tour || ''} onChange={e => updateTourField(idx, 'fecha_tour', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>P. Venta ($)</label>
                                <input type="number" step="0.01" className="form-input" value={t.precio_venta === undefined ? '' : t.precio_venta} onChange={e => updateTourField(idx, 'precio_venta', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>C. Operador ($)</label>
                                <input type="number" step="0.01" className="form-input" value={t.costo_operador === undefined ? '' : t.costo_operador} onChange={e => updateTourField(idx, 'costo_operador', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Operador</label>
                                <select className="form-select" value={t.operador_id || ''} onChange={e => updateTourField(idx, 'operador_id', e.target.value)}>
                                    <option value="">(Ninguno)</option>
                                    {operadores.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
                                </select>
                            </div>
                            <button type="button" className="btn btn-ghost" style={{ padding: '8px', color: 'var(--color-danger)' }} onClick={() => removeTour(idx)}>🗑</button>
                        </div>
                    ))}

                    {/* ── Servicios Opcionales ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', margin: 0 }}>Servicios Opcionales</h3>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={addOpcional}>+ Agregar Opcional</button>
                    </div>

                    {formData.opcionales_list.map((o, idx) => (
                        <div key={idx} style={{ ...rowStyle, gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Opcional</label>
                                <select className="form-select" value={o.opcional_id || ''} onChange={e => handleOpcionalSelect(idx, e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {opcionalesList.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Fecha (Aprox)</label>
                                <input type="date" className="form-input" value={o.fecha_opcional || ''} onChange={e => updateOpcionalField(idx, 'fecha_opcional', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>P. Venta ($)</label>
                                <input type="number" step="0.01" className="form-input" value={o.precio_venta === undefined ? '' : o.precio_venta} onChange={e => updateOpcionalField(idx, 'precio_venta', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>C. Operador ($)</label>
                                <input type="number" step="0.01" className="form-input" value={o.costo_operador === undefined ? '' : o.costo_operador} onChange={e => updateOpcionalField(idx, 'costo_operador', e.target.value)} required />
                            </div>
                            <button type="button" className="btn btn-ghost" style={{ padding: '8px', color: 'var(--color-danger)' }} onClick={() => removeOpcional(idx)}>🗑</button>
                        </div>
                    ))}

                    {/* ── Opciones Globales ── */}
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', marginBottom: 16, marginTop: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        Opciones Globales
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                        <div className="form-group">
                            <label className="form-label">Pasajeros (Pax) *</label>
                            <input className="form-input" type="number" min="1" required value={formData.pax} onChange={e => handlePaxChange(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Descuentos</label>
                            <input className="form-input" value={formData.descuentos} onChange={e => setFormData({ ...formData, descuentos: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Idioma</label>
                            <select className="form-select" value={formData.idioma} onChange={e => setFormData({ ...formData, idioma: e.target.value })}>
                                <option value="ES">Español</option>
                                <option value="EN">Inglés</option>
                                <option value="PT">Portugués</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Estado Global</label>
                            <select className="form-select" value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })}>
                                {ESTADOS_RESERVA.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Op. Global (WhatsApp)</label>
                            <select className="form-select" value={formData.operador_id || ''} onChange={e => setFormData({ ...formData, operador_id: e.target.value || null })}>
                                <option value="">-- Sin Operador Principal --</option>
                                {operadores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ── Footer buttons ── */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">
                            {editingReserva ? 'Guardar Cambios' : 'Confirmar Reserva'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default React.memo(ReservaFormModal)
