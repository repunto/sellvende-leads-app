import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CellInput from '../components/CellInput'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import SkeletonTable from '../components/SkeletonTable'

export default function DescuentosPage() {
    const { agencia } = useAuth()
    const [descuentos, setDescuentos] = useState([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (agencia?.id) loadDescuentos() }, [agencia?.id])

    async function loadDescuentos() {
        if (!agencia?.id) return
        setLoading(true)
        const { data, error } = await supabase
            .from('descuentos')
            .select('*')
            .eq('agencia_id', agencia.id)
            .order('created_at', { ascending: true })

        if (!error && data) setDescuentos(data)
        setLoading(false)
    }

    async function handleInlineUpdate(id, field, value) {
        const updatedList = descuentos.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value }
            }
            return item
        })
        setDescuentos(updatedList)

        const updatedItem = updatedList.find(item => item.id === id)

        try {
            const { error } = await supabase.from('descuentos')
                .update({
                    nombre: updatedItem.nombre,
                    descuento_web: updatedItem.descuento_web,
                    descuento_asesor: updatedItem.descuento_asesor,
                    tipo: updatedItem.tipo,
                    aplicabilidad: updatedItem.aplicabilidad,
                    activo: updatedItem.activo
                })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error(error)
            showToast('Error al guardar cambio: ' + error.message, 'error')
            loadDescuentos()
        }
    }

    async function handleAddEmptyRow() {
        try {
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) throw new Error('No autenticado')

            const { data: profile } = await supabase.from('usuarios_agencia').select('agencia_id').eq('usuario_id', userData.user.id).single()

            const newRow = {
                agencia_id: profile.agencia_id,
                nombre: 'Nuevo Descuento',
                descuento_web: 0,
                descuento_asesor: 0,
                tipo: 'fijo',
                aplicabilidad: 'Por Unidad',
                activo: true
            }

            const { data, error } = await supabase.from('descuentos').insert([newRow]).select()
            if (error) throw error

            setDescuentos([...descuentos, data[0]])
            showToast('Fila añadida')
        } catch (error) {
            console.error(error)
            showToast('Error al crear descuento', 'error')
        }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Descuento',
            message: '¿Eliminar este descuento? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('descuentos').delete().eq('id', id)
                    if (error) throw error
                    showToast('Descuento eliminado')
                    loadDescuentos()
                } catch (error) {
                    console.error(error)
                    alert('Error al eliminar: ' + error.message)
                }
            }
        })
    }

    async function handleSyncDescuentos() {
        setConfirmDialog({
            title: 'Sincronizar Descuentos G-Sheet',
            message: '¿Seguro que deseas sobrescribir TODOS los descuentos con la lista del Google Sheet?',
            danger: true,
            confirmLabel: '🔄 Sincronizar',
            onConfirm: async () => {
                setConfirmDialog(null)
                setLoading(true)
        try {
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) throw new Error('No estás autenticado')

            const { data: profile } = await supabase.from('usuarios_agencia').select('agencia_id').eq('usuario_id', userData.user.id).single()
            if (!profile) throw new Error('No se encontró tu agencia')

            const agenciaId = profile.agencia_id

            await supabase.from('descuentos').delete().eq('agencia_id', agenciaId)

            const descuentosList = [
                { agencia_id: agenciaId, nombre: 'Estudiante Universitario', descuento_web: 20, descuento_asesor: 20, tipo: 'fijo', aplicabilidad: 'Por Unidad' },
                { agencia_id: agenciaId, nombre: 'Peruano / DNI', descuento_web: 30, descuento_asesor: 30, tipo: 'fijo', aplicabilidad: 'Por Unidad' },
                { agencia_id: agenciaId, nombre: 'Comunidad Andina', descuento_web: 20, descuento_asesor: 20, tipo: 'fijo', aplicabilidad: 'Por Unidad' },
                { agencia_id: agenciaId, nombre: 'Menor de Edad (3-10 años)', descuento_web: 10, descuento_asesor: 10, tipo: 'fijo', aplicabilidad: 'Por Unidad' },
                { agencia_id: agenciaId, nombre: 'Grupo Mayor de 5 pax', descuento_web: 5, descuento_asesor: 5, tipo: 'porcentaje', aplicabilidad: 'Manual' },
                { agencia_id: agenciaId, nombre: 'Grupo Mayor de 10 pax', descuento_web: 10, descuento_asesor: 10, tipo: 'porcentaje', aplicabilidad: 'Manual' },
                { agencia_id: agenciaId, nombre: 'Machupicchu Discount', descuento_web: 40, descuento_asesor: 40, tipo: 'fijo', aplicabilidad: 'Por Unidad' },
            ]

            const { error: insertErr } = await supabase.from('descuentos').insert(descuentosList)
            if (insertErr) throw insertErr

            showToast('¡Los 7 Descuentos han sido sincronizados exitosamente!')
            loadDescuentos()
        } catch (error) {
            console.error(error)
            alert('Error al sincronizar: ' + error.message)
            setLoading(false)
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
                    <h1 className="page-title">Descuentos</h1>
                    <p className="page-subtitle">Administra descuentos aplicables a productos y ventas</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={handleSyncDescuentos}>
                        🔄 Sincronizar Descuentos (G-Sheet)
                    </button>
                    <button className="btn btn-primary" onClick={handleAddEmptyRow}>
                        + Nueva Fila
                    </button>
                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <SkeletonTable rows={5} columns={7} />
                ) : descuentos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏷️</div>
                        <div className="empty-state-text">No tienes descuentos registrados</div>
                        <div className="empty-state-sub">Agrega tus descuentos aquí para aplicarlos automáticamente en Ventas.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '110px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '50px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Nombre Descuento</th>
                                    <th>Descuento Web</th>
                                    <th>Descuento Op.</th>
                                    <th>Tipo</th>
                                    <th>Aplicabilidad</th>
                                    <th>Estado</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {descuentos.map(item => (
                                    <tr key={item.id} className="sheet-row">
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                value={item.nombre}
                                                onChange={(val) => handleInlineUpdate(item.id, 'nombre', val)}
                                                minWidth={150}
                                            />
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-danger)', paddingLeft: '8px', fontSize: '0.85rem' }}>
                                                    {item.tipo === 'porcentaje' ? '' : '-$'}
                                                </span>
                                                <CellInput
                                                    type="number"
                                                    value={parseFloat(item.descuento_web || 0)}
                                                    onChange={(val) => handleInlineUpdate(item.id, 'descuento_web', val)}
                                                    minWidth={50}
                                                />
                                                {item.tipo === 'porcentaje' && (
                                                    <span style={{ color: 'var(--color-danger)', paddingRight: '8px', fontSize: '0.85rem' }}>%</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-danger)', paddingLeft: '8px', fontSize: '0.85rem' }}>
                                                    {item.tipo === 'porcentaje' ? '' : '-$'}
                                                </span>
                                                <CellInput
                                                    type="number"
                                                    value={parseFloat(item.descuento_asesor || 0)}
                                                    onChange={(val) => handleInlineUpdate(item.id, 'descuento_asesor', val)}
                                                    minWidth={50}
                                                />
                                                {item.tipo === 'porcentaje' && (
                                                    <span style={{ color: 'var(--color-danger)', paddingRight: '8px', fontSize: '0.85rem' }}>%</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                isSelect={true}
                                                value={item.tipo}
                                                options={[
                                                    { value: 'fijo', label: '💲 Fijo' },
                                                    { value: 'porcentaje', label: '📊 %' }
                                                ]}
                                                onChange={(val) => handleInlineUpdate(item.id, 'tipo', val)}
                                                minWidth={70}
                                            />
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                isSelect={true}
                                                value={item.aplicabilidad}
                                                options={[
                                                    { value: 'Por Unidad', label: '👤 Por Unidad' },
                                                    { value: 'Manual', label: '✋ Manual' }
                                                ]}
                                                onChange={(val) => handleInlineUpdate(item.id, 'aplicabilidad', val)}
                                                minWidth={90}
                                            />
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                isSelect={true}
                                                value={item.activo ? 'true' : 'false'}
                                                options={[
                                                    { value: 'true', label: '✅ Activo' },
                                                    { value: 'false', label: '❌ Inactivo' }
                                                ]}
                                                onChange={(val) => handleInlineUpdate(item.id, 'activo', val === 'true')}
                                                minWidth={80}
                                            />
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} style={{ color: 'var(--color-danger)' }} title="Eliminar fila">🗑</button>
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
