/**
 * VentaFormModal — Full CRUD modal for ventations.
 * Multi-producto itinerary builder + extras + global fields.
 * Used via React.lazy() from VentasPage to defer heavy imports.
 */
import React, { useCallback } from 'react'

const ESTADOS_VENTA = ['pendiente', 'confirmada', 'completada', 'cancelada']

function VentaFormModal({
    show,
    editingVenta,
    formData,
    setFormData,
    handleSave,
    productos,
    asesores,
    extrasList,
    descuentosList,
    setProductosList,
    setextrasLista,
    handlePaxChange,
    onClose,
}) {
    if (!show) return null

    // ── Producto row handlers ──
    const addProducto = () =>
        setProductosList([...formData.productos_list, { producto_id: '', fecha_servicio: '', precio_venta: 0, costo_asesor: 0, asesor_id: '' }])

    const removeProducto = (idx) =>
        setProductosList(formData.productos_list.filter((_, i) => i !== idx))

    const updateProductoField = (idx, key, value) => {
        const newList = formData.productos_list.map((item, i) => i === idx ? { ...item, [key]: value } : item)
        setProductosList(newList)
    }

    const handleProductoSelect = (idx, productoId) => {
        const selectedProducto = productos.find(x => x.id === productoId)
        updateProductoField(idx, 'producto_id', productoId)
        const newList = formData.productos_list.map((item, i) =>
            i === idx ? {
                ...item,
                producto_id: productoId,
                precio_venta: selectedProducto ? selectedProducto.precio_usd : item.precio_venta,
                costo_asesor: selectedProducto ? selectedProducto.costo_asesor : item.costo_asesor
            } : item
        )
        setProductosList(newList)
    }

    // ── Extra row handlers ──
    const addExtra = () =>
        setextrasLista([...formData.extras_list, { extra_id: '', fecha_extra: '', precio_venta: 0, costo_asesor: 0 }])

    const removeExtra = (idx) =>
        setextrasLista(formData.extras_list.filter((_, i) => i !== idx))

    const handleExtraSelect = (idx, extraId) => {
        const selectedOpc = extrasList.find(x => x.id === extraId)
        const newList = formData.extras_list.map((item, i) =>
            i === idx ? {
                ...item,
                extra_id: extraId,
                precio_venta: selectedOpc ? selectedOpc.precio_usd : item.precio_venta,
                costo_asesor: selectedOpc ? selectedOpc.costo_asesor : item.costo_asesor
            } : item
        )
        setextrasLista(newList)
    }

    const updateExtraField = (idx, key, value) => {
        const newList = formData.extras_list.map((item, i) => i === idx ? { ...item, [key]: value } : item)
        setextrasLista(newList)
    }

    const rowStyle = {
        display: 'grid', gap: 8, marginBottom: 12,
        background: 'var(--color-bg-hover)', padding: 12, borderRadius: 6, alignItems: 'end'
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 20 }}>
                    {editingVenta ? 'Editar Venta' : 'Nueva Venta'}
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

                    {/* ── Constructor de Productos ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', margin: 0 }}>Constructor de Itinerario (Productos)</h3>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={addProducto}>+ Agregar Producto</button>
                    </div>

                    {formData.productos_list.map((t, idx) => (
                        <div key={idx} style={{ ...rowStyle, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr auto' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Producto</label>
                                <select className="form-select" value={t.producto_id || ''} onChange={e => handleProductoSelect(idx, e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {productos.map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Fecha</label>
                                <input type="date" className="form-input" value={t.fecha_servicio || ''} onChange={e => updateProductoField(idx, 'fecha_servicio', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>P. Venta ($)</label>
                                <input type="number" step="0.01" className="form-input" value={t.precio_venta === undefined ? '' : t.precio_venta} onChange={e => updateProductoField(idx, 'precio_venta', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>C. Asesor ($)</label>
                                <input type="number" step="0.01" className="form-input" value={t.costo_asesor === undefined ? '' : t.costo_asesor} onChange={e => updateProductoField(idx, 'costo_asesor', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Asesor</label>
                                <select className="form-select" value={t.asesor_id || ''} onChange={e => updateProductoField(idx, 'asesor_id', e.target.value)}>
                                    <option value="">(Ninguno)</option>
                                    {asesores.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
                                </select>
                            </div>
                            <button type="button" className="btn btn-ghost" style={{ padding: '8px', color: 'var(--color-danger)' }} onClick={() => removeProducto(idx)}>🗑</button>
                        </div>
                    ))}

                    {/* ── Servicios extras ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', margin: 0 }}>Servicios extras</h3>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={addExtra}>+ Agregar Extra</button>
                    </div>

                    {formData.extras_list.map((o, idx) => (
                        <div key={idx} style={{ ...rowStyle, gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Extra</label>
                                <select className="form-select" value={o.extra_id || ''} onChange={e => handleExtraSelect(idx, e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {extrasList.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Fecha (Aprox)</label>
                                <input type="date" className="form-input" value={o.fecha_extra || ''} onChange={e => updateExtraField(idx, 'fecha_extra', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>P. Venta ($)</label>
                                <input type="number" step="0.01" className="form-input" value={o.precio_venta === undefined ? '' : o.precio_venta} onChange={e => updateExtraField(idx, 'precio_venta', e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>C. Asesor ($)</label>
                                <input type="number" step="0.01" className="form-input" value={o.costo_asesor === undefined ? '' : o.costo_asesor} onChange={e => updateExtraField(idx, 'costo_asesor', e.target.value)} required />
                            </div>
                            <button type="button" className="btn btn-ghost" style={{ padding: '8px', color: 'var(--color-danger)' }} onClick={() => removeExtra(idx)}>🗑</button>
                        </div>
                    ))}

                    {/* ── Opciones Globales ── */}
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', marginBottom: 16, marginTop: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                        Opciones Globales
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                        <div className="form-group">
                            <label className="form-label">Cantidad / Unidades *</label>
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
                                {ESTADOS_VENTA.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Op. Global (WhatsApp)</label>
                            <select className="form-select" value={formData.asesor_id || ''} onChange={e => setFormData({ ...formData, asesor_id: e.target.value || null })}>
                                <option value="">-- Sin Asesor Principal --</option>
                                {asesores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ── Footer buttons ── */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">
                            {editingVenta ? 'Guardar Cambios' : 'Confirmar Venta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default React.memo(VentaFormModal)
