import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import SkeletonTable from '../components/SkeletonTable'

export default function OperadoresPage() {
    const [operadores, setOperadores] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingOperador, setEditingOperador] = useState(null)
    const [toast, setToast] = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)

    const [formData, setFormData] = useState({
        nombre: '',
        telefono: '',
        email: '',
        activo: true
    })

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => { loadOperadores() }, [])

    async function loadOperadores() {
        setLoading(true)
        const { data, error } = await supabase
            .from('operadores')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) setOperadores(data)
        setLoading(false)
    }

    function openForm(operador = null) {
        if (operador) {
            setEditingOperador(operador)
            setFormData({
                nombre: operador.nombre || '',
                telefono: operador.telefono || '',
                email: operador.email || '',
                activo: operador.activo
            })
        } else {
            setEditingOperador(null)
            setFormData({
                nombre: '',
                telefono: '',
                email: '',
                activo: true
            })
        }
        setShowForm(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        try {
            if (editingOperador) {
                const { error } = await supabase.from('operadores').update(formData).eq('id', editingOperador.id)
                if (error) throw error
                showToast('Operador actualizado correctamente')
            } else {
                const { error } = await supabase.from('operadores').insert([formData])
                if (error) throw error
                showToast('Operador creado exitosamente')
            }
            setShowForm(false)
            loadOperadores()
        } catch (error) {
            console.error(error)
            alert('Error al guardar: ' + error.message)
        }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Operador',
            message: '¿Eliminar este operador? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('operadores').delete().eq('id', id)
                    if (error) throw error
                    showToast('Operador eliminado')
                    loadOperadores()
                } catch (error) {
                    console.error(error)
                    alert('Error al eliminar: ' + error.message)
                }
            }
        })
    }

    return (
        <>
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.msg}
                </div>
            )}

            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Operadores</h1>
                    <p className="page-subtitle">Gestiona tus proveedores terrestres y mayoristas</p>
                </div>
                <button className="btn btn-primary" onClick={() => openForm(null)}>
                    + Nuevo Operador
                </button>
            </div>

            <div className="page-body">
                {loading ? (
                    <SkeletonTable rows={5} columns={5} />
                ) : operadores.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🚌</div>
                        <div className="empty-state-text">No tienes operadores registrados</div>
                        <div className="empty-state-sub">Agrega a tus proveedores para asignarles reservas.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nombre / Empresa</th>
                                    <th>WhatsApp</th>
                                    <th>Email</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operadores.map(op => (
                                    <tr key={op.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>{op.nombre}</td>
                                        <td>{op.telefono || '—'}</td>
                                        <td>{op.email || '—'}</td>
                                        <td>
                                            {op.activo
                                                ? <span className="badge badge-confirmada">Activo</span>
                                                : <span className="badge badge-cancelada">Inactivo</span>}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openForm(op)}>✏️</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(op.id)} style={{ color: 'var(--color-danger)' }}>🗑</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Modal Formulario Operador */}
                {showForm && (
                    <div className="modal-overlay" onClick={() => setShowForm(false)}>
                        <div className="modal-content modal-content-sm" onClick={(e) => e.stopPropagation()}>
                            <h2>
                                {editingOperador ? 'Editar Operador' : 'Nuevo Operador'}
                            </h2>
                            <form onSubmit={handleSave}>
                                <div className="form-group">
                                    <label className="form-label">Nombre del Proveedor *</label>
                                    <input className="form-input" required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Transporte Andino SAC" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">WhatsApp de Contacto</label>
                                    <input className="form-input" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="Ej. +51987654321" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email de Reservas</label>
                                    <input className="form-input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="reservas@empresa.com" />
                                </div>

                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                                    <input
                                        type="checkbox"
                                        id="op-activo"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                        style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
                                    />
                                    <label htmlFor="op-activo" style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>Operador activo</label>
                                </div>

                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary">
                                        {editingOperador ? 'Guardar Cambios' : 'Crear Operador'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

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
