import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CellInput from '../components/CellInput'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import SkeletonTable from '../components/SkeletonTable'

export default function ProductosPage() {
    const [productos, setProductos] = useState([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmDialog, setConfirmDialog] = useState(null)
    
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => { loadProductos() }, [])

    async function loadProductos() {
        setLoading(true)
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) setProductos(data)
        setLoading(false)
    }

    async function handleInlineUpdate(id, field, value) {
        const updatedList = productos.map(item => {
            if (item.id === id) return { ...item, [field]: value }
            return item
        })
        setProductos(updatedList)

        const updatedItem = updatedList.find(item => item.id === id)

        try {
            const { error } = await supabase.from('productos')
                .update({
                    nombre: updatedItem.nombre,
                    duracion_dias: updatedItem.duracion_dias,
                    precio_usd: updatedItem.precio_usd,
                    costo_asesor: updatedItem.costo_asesor,
                    activo: updatedItem.activo
                })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error(error)
            showToast('Error al guardar cambio: ' + error.message, 'error')
            loadProductos()
        }
    }

    async function handleAddEmptyRow() {
        try {
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) throw new Error('No autenticado')

            const { data: profile } = await supabase
                .from('usuarios_agencia')
                .select('agencia_id')
                .eq('usuario_id', userData.user.id)
                .single()

            const newRow = {
                agencia_id: profile.agencia_id,
                nombre: 'Nuevo Producto/Servicio',
                duracion_dias: 1,
                precio_usd: 0,
                costo_asesor: 0,
                activo: true
            }

            const { data, error } = await supabase.from('productos').insert([newRow]).select()
            if (error) throw error

            setProductos([...productos, data[0]])
            showToast('Producto añadido')
        } catch (error) {
            console.error(error)
            showToast('Error al crear producto: ' + error.message, 'error')
        }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Producto',
            message: '¿Eliminar este producto/servicio? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('productos').delete().eq('id', id)
                    if (error) throw error
                    showToast('Producto eliminado')
                    loadProductos()
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
                    <h1 className="page-title">Productos / Servicios</h1>
                    <p className="page-subtitle">Catálogo de lo que ofreces y vendes. Asocia productos a tus ventas para calcular márgenes y rentabilidad.</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar producto..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ width: 220, marginBottom: 0, paddingLeft: 12 }}
                    />
                    <button className="btn btn-primary" onClick={handleAddEmptyRow}>
                        + Nuevo Producto
                    </button>
                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <SkeletonTable rows={8} columns={6} />
                ) : productos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <div className="empty-state-text">No tienes productos registrados</div>
                        <div className="empty-state-sub">Añade los productos o servicios que vendes para asociarlos a tus Ventas y calcular tu rentabilidad.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col />
                                <col style={{ width: '80px' }} />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '50px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Nombre del Producto / Servicio</th>
                                    <th style={{ textAlign: 'center' }}>Días</th>
                                    <th>Precio Venta (USD)</th>
                                    <th>Costo Interno (USD)</th>
                                    <th>Estado</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {productos
                                    .filter(p => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(prod => (
                                    <tr key={prod.id} className="sheet-row">
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                value={prod.nombre}
                                                onChange={(val) => handleInlineUpdate(prod.id, 'nombre', val)}
                                                minWidth={200}
                                            />
                                        </td>
                                        <td style={{ padding: 0, textAlign: 'center' }}>
                                            <CellInput
                                                type="number"
                                                value={prod.duracion_dias}
                                                onChange={(val) => handleInlineUpdate(prod.id, 'duracion_dias', val)}
                                                minWidth={30}
                                            />
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-success)', paddingLeft: '8px', fontSize: '0.85rem' }}>$</span>
                                                <CellInput
                                                    type="number"
                                                    value={parseFloat(prod.precio_usd || 0)}
                                                    onChange={(val) => handleInlineUpdate(prod.id, 'precio_usd', val)}
                                                    minWidth={50}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-text-muted)', paddingLeft: '8px', fontSize: '0.85rem' }}>$</span>
                                                <CellInput
                                                    type="number"
                                                    value={parseFloat(prod.costo_asesor || 0)}
                                                    onChange={(val) => handleInlineUpdate(prod.id, 'costo_asesor', val)}
                                                    minWidth={50}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                isSelect={true}
                                                value={prod.activo ? 'true' : 'false'}
                                                options={[
                                                    { value: 'true', label: '✅ Activo' },
                                                    { value: 'false', label: '❌ Inactivo' }
                                                ]}
                                                onChange={(val) => handleInlineUpdate(prod.id, 'activo', val === 'true')}
                                                minWidth={80}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleDelete(prod.id)}
                                                style={{ color: 'var(--color-danger)' }}
                                                title="Eliminar"
                                            >🗑</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
