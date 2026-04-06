import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CellInput from '../components/CellInput'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import SkeletonTable from '../components/SkeletonTable'

export default function OpcionalesPage() {
    const { agencia } = useAuth()
    const [opcionales, setOpcionales] = useState([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (agencia?.id) loadOpcionales() }, [agencia?.id])

    async function loadOpcionales() {
        if (!agencia?.id) return
        setLoading(true)
        const { data, error } = await supabase
            .from('opcionales')
            .select('*')
            .eq('agencia_id', agencia.id)
            .order('created_at', { ascending: true })

        if (!error && data) setOpcionales(data)
        setLoading(false)
    }


    async function handleInlineUpdate(id, field, value) {
        // Optimistic UI update
        const updatedList = opcionales.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value }
            }
            return item
        })
        setOpcionales(updatedList)

        // Find the full updated item to save
        const updatedItem = updatedList.find(item => item.id === id)

        try {
            const { error } = await supabase.from('opcionales')
                .update({
                    nombre: updatedItem.nombre,
                    precio_usd: updatedItem.precio_usd,
                    costo_operador: updatedItem.costo_operador,
                    activo: updatedItem.activo
                })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error(error)
            showToast('Error al guardar cambio: ' + error.message, 'error')
            loadOpcionales() // Revert changes on error
        }
    }

    async function handleAddEmptyRow() {
        try {
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) throw new Error('No autenticado')

            const { data: profile } = await supabase.from('usuarios_agencia').select('agencia_id').eq('usuario_id', userData.user.id).single()

            const newRow = {
                agencia_id: profile.agencia_id,
                nombre: 'Nuevo Opcional',
                precio_usd: 0,
                costo_operador: 0,
                activo: true
            }

            const { data, error } = await supabase.from('opcionales').insert([newRow]).select()
            if (error) throw error

            setOpcionales([...opcionales, data[0]])
            showToast('Fila añadida')
        } catch (error) {
            console.error(error)
            showToast('Error al crear opcional', 'error')
        }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Opcional',
            message: '¿Eliminar este opcional? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('opcionales').delete().eq('id', id)
                    if (error) throw error
                    showToast('Opcional eliminado')
                    loadOpcionales()
                } catch (error) {
                    console.error(error)
                    alert('Error al eliminar: ' + error.message)
                }
            }
        })
    }

    async function handleSyncOpcionales() {
        setConfirmDialog({
            title: 'Sincronizar Opcionales G-Sheet',
            message: '¿Seguro que deseas sobrescribir TODOS los opcionales con la lista del Google Sheet?',
            danger: true,
            confirmLabel: '🔄 Sincronizar',
            onConfirm: async () => {
                setConfirmDialog(null)
                setLoading(true);
                try {
                    // Get current agency id
                    const { data: userData } = await supabase.auth.getUser();
                    if (!userData.user) throw new Error('No estás autenticado');

                    const { data: profile } = await supabase.from('usuarios_agencia').select('agencia_id').eq('usuario_id', userData.user.id).single();
                    if (!profile) throw new Error('No se encontró tu agencia');

                    const agenciaId = profile.agencia_id;

                    // Delete current opcionales
                    await supabase.from('opcionales').delete().eq('agencia_id', agenciaId);

            // Insert new opcionales from Google Sheet
            const opcionalesList = [
                { agencia_id: agenciaId, nombre: 'Rafting', precio_usd: 30, costo_operador: 25 },
                { agencia_id: agenciaId, nombre: 'Zip Line', precio_usd: 30, costo_operador: 25 },
                { agencia_id: agenciaId, nombre: 'Rafting + Zipline', precio_usd: 60, costo_operador: 50 },
                { agencia_id: agenciaId, nombre: 'Huaynapicchu', precio_usd: 70, costo_operador: 70 },
                { agencia_id: agenciaId, nombre: 'Montaña Mapi', precio_usd: 15, costo_operador: 15 },
                { agencia_id: agenciaId, nombre: 'Machupicchu', precio_usd: 47, costo_operador: 47 },
                { agencia_id: agenciaId, nombre: 'Machupicchu Discount', precio_usd: 47, costo_operador: 47 }, // Note: assuming parentheses () mean negative discount, will treat as absolute cost for now or mapped as needed. Using positive values as they represent items.
                { agencia_id: agenciaId, nombre: 'Tren 21:50', precio_usd: 5, costo_operador: 5 },
                { agencia_id: agenciaId, nombre: 'Tren 18:20', precio_usd: 10, costo_operador: 10 },
                { agencia_id: agenciaId, nombre: 'Tren Adicional', precio_usd: 70, costo_operador: 70 },
                { agencia_id: agenciaId, nombre: 'Tren Descuento', precio_usd: 70, costo_operador: 70 },
                { agencia_id: agenciaId, nombre: 'Porter', precio_usd: 120, costo_operador: 120 },
                { agencia_id: agenciaId, nombre: 'Horse', precio_usd: 40, costo_operador: 40 },
                { agencia_id: agenciaId, nombre: 'Bus Round Trip', precio_usd: 24, costo_operador: 24 },
                { agencia_id: agenciaId, nombre: 'Bus Up', precio_usd: 12, costo_operador: 12 },
                { agencia_id: agenciaId, nombre: 'Bus Down', precio_usd: 12, costo_operador: 12 },
                { agencia_id: agenciaId, nombre: 'Cocalmayo', precio_usd: 5, costo_operador: 5 },
                { agencia_id: agenciaId, nombre: 'BTP', precio_usd: 23, costo_operador: 23 },
                { agencia_id: agenciaId, nombre: 'BTG', precio_usd: 42, costo_operador: 42 },
                { agencia_id: agenciaId, nombre: 'Almuerzo Buffet Urubamba', precio_usd: 10, costo_operador: 10 },
                { agencia_id: agenciaId, nombre: 'Almuerzo MAPI', precio_usd: 30, costo_operador: 30 },
                { agencia_id: agenciaId, nombre: 'Transporte privado', precio_usd: 200, costo_operador: 100 }
            ];

            const { error: insertErr } = await supabase.from('opcionales').insert(opcionalesList);
            if (insertErr) throw insertErr;

            showToast('¡Los 22 Opcionales han sido sincronizados exitosamente!');
            loadOpcionales();
        } catch (error) {
            console.error(error);
            alert('Error al sincronizar: ' + error.message);
            setLoading(false);
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
                    <h1 className="page-title">Opcionales</h1>
                    <p className="page-subtitle">Administra servicios extras, upgrades y complementos</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={handleSyncOpcionales}>
                        🔄 Sincronizar Opcionales (G-Sheet)
                    </button>
                    <button className="btn btn-primary" onClick={handleAddEmptyRow}>
                        + Nueva Fila
                    </button>
                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <SkeletonTable rows={8} columns={6} />
                ) : opcionales.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">➕</div>
                        <div className="empty-state-text">No tienes opcionales registrados</div>
                        <div className="empty-state-sub">Agrega tus servicios extra, trenes, y buses aquí para usarlos en Reservas.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col />
                                <col style={{ width: '110px' }} />
                                <col style={{ width: '110px' }} />
                                <col style={{ width: '90px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '50px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Nombre del Opcional</th>
                                    <th>Precio (USD)</th>
                                    <th>Costo Op. (USD)</th>
                                    <th>Beneficio</th>
                                    <th>Estado</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {opcionales.map(item => {
                                    const venta = parseFloat(item.precio_usd || 0);
                                    const costo = parseFloat(item.costo_operador || 0);
                                    const beneficio = venta - costo;

                                    // Consider formatting negative numbers with parentheses like G-Sheets
                                    return (
                                        <tr key={item.id} className="sheet-row">
                                            <td style={{ padding: 0 }}>
                                                <CellInput
                                                    value={item.nombre}
                                                    onChange={(val) => handleInlineUpdate(item.id, 'nombre', val)}
                                                    minWidth={200}
                                                />
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--color-success)', paddingLeft: '8px', fontSize: '0.85rem' }}>$</span>
                                                    <CellInput
                                                        type="number"
                                                        value={venta}
                                                        onChange={(val) => handleInlineUpdate(item.id, 'precio_usd', val)}
                                                        minWidth={50}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--color-text-muted)', paddingLeft: '8px', fontSize: '0.85rem' }}>$</span>
                                                    <CellInput
                                                        type="number"
                                                        value={costo}
                                                        onChange={(val) => handleInlineUpdate(item.id, 'costo_operador', val)}
                                                        minWidth={50}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600, textAlign: 'right', paddingRight: '12px', color: beneficio >= 0 ? 'var(--color-text)' : 'var(--color-danger)' }}>
                                                ${beneficio.toFixed(2)}
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
                                    )
                                })}
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
