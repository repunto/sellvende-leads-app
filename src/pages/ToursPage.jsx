import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CellInput from '../components/CellInput'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import SkeletonTable from '../components/SkeletonTable'

export default function ToursPage() {
    const [tours, setTours] = useState([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmDialog, setConfirmDialog] = useState(null)
    
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => { loadTours() }, [])

    async function loadTours() {
        setLoading(true)
        const { data, error } = await supabase
            .from('tours')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) setTours(data)
        setLoading(false)
    }

    async function handleInlineUpdate(id, field, value) {
        // Optimistic UI update
        const updatedList = tours.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value }
            }
            return item
        })
        setTours(updatedList)

        // Find the full updated item to save
        const updatedItem = updatedList.find(item => item.id === id)

        try {
            const { error } = await supabase.from('tours')
                .update({
                    nombre: updatedItem.nombre,
                    duracion_dias: updatedItem.duracion_dias,
                    precio_usd: updatedItem.precio_usd,
                    costo_operador: updatedItem.costo_operador,
                    activo: updatedItem.activo
                })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error(error)
            showToast('Error al guardar cambio: ' + error.message, 'error')
            loadTours() // Revert changes on error
        }
    }

    async function handleAddEmptyRow() {
        try {
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) throw new Error('No autenticado')

            const { data: profile } = await supabase.from('usuarios_agencia').select('agencia_id').eq('usuario_id', userData.user.id).single()

            const newRow = {
                agencia_id: profile.agencia_id,
                nombre: 'Nuevo Tour',
                duracion_dias: 1,
                precio_usd: 0,
                costo_operador: 0,
                activo: true
            }

            const { data, error } = await supabase.from('tours').insert([newRow]).select()
            if (error) throw error

            setTours([...tours, data[0]])
            showToast('Fila añadida')
        } catch (error) {
            console.error(error)
            showToast('Error al crear tour', 'error')
        }
    }

    async function handleDelete(id) {
        setConfirmDialog({
            title: 'Eliminar Tour',
            message: '¿Eliminar este tour? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('tours').delete().eq('id', id)
                    if (error) throw error
                    showToast('Tour eliminado')
                    loadTours()
                } catch (error) {
                    console.error(error)
                    alert('Error al eliminar: ' + error.message)
                }
            }
        })
    }

    async function handleSyncTours() {
        setConfirmDialog({
            title: 'Sincronizar Tours G-Sheet',
            message: '¿Seguro que deseas sobrescribir TODOS los tours con los 34 tours del Google Sheet?',
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

                    // Delete current tours
                    await supabase.from('tours').delete().eq('agencia_id', agenciaId);

            // Insert new tours
            const toursList = [
                { agencia_id: agenciaId, nombre: 'Inka Jungle Backpacker', precio_usd: 430, costo_operador: 290, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Inka Jungle Premium', precio_usd: 450, costo_operador: 300, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Inka Jungle Privado', precio_usd: 600, costo_operador: 400, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Inka Trail', precio_usd: 680, costo_operador: 280, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Valle Sagrado', precio_usd: 50, costo_operador: 40, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Valle Sagrado Conexion', precio_usd: 500, costo_operador: 210, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Valle Sagrado Conexion Premium', precio_usd: 600, costo_operador: 257, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Lares Trek 3 dias', precio_usd: 650, costo_operador: 600, duracion_dias: 3 },
                { agencia_id: agenciaId, nombre: 'Lares Trek 4 dias', precio_usd: 350, costo_operador: 320, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Uchuycusco 1 dia', precio_usd: 350, costo_operador: 330, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Uchuycusco 2 dias', precio_usd: 480, costo_operador: 450, duracion_dias: 2 },
                { agencia_id: agenciaId, nombre: 'Uchuycusco 3 dias', precio_usd: 720, costo_operador: 650, duracion_dias: 3 },
                { agencia_id: agenciaId, nombre: 'Maras Moray (Grupal)', precio_usd: 20, costo_operador: 15, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'CHIMOMA', precio_usd: 140, costo_operador: 120, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'CHIMOMA Conexion', precio_usd: 450, costo_operador: 400, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Rainbow Mountain', precio_usd: 50, costo_operador: 40, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Machupicchu 1 dia', precio_usd: 290, costo_operador: 270, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Machupicchu 2 dias', precio_usd: 300, costo_operador: 275, duracion_dias: 2 },
                { agencia_id: agenciaId, nombre: 'City Tour Cusco (Grupal)', precio_usd: 15, costo_operador: 12, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'City Tour Cusco (Privado)', precio_usd: 150, costo_operador: 120, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Ausangate Trek 1 dia', precio_usd: 480, costo_operador: 450, duracion_dias: 1 },
                { agencia_id: agenciaId, nombre: 'Ausangate Trek 2 dias', precio_usd: 580, costo_operador: 550, duracion_dias: 2 },
                { agencia_id: agenciaId, nombre: 'Ausangate Trek 5 dias', precio_usd: 650, costo_operador: 600, duracion_dias: 5 },
                { agencia_id: agenciaId, nombre: 'Salkantay Trek 4 dias', precio_usd: 400, costo_operador: 250, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Salkantay Trek 5 dias', precio_usd: 450, costo_operador: 250, duracion_dias: 5 },
                { agencia_id: agenciaId, nombre: 'Choquequirao 4 dias', precio_usd: 550, costo_operador: 500, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Choquequirao 5 dias', precio_usd: 650, costo_operador: 600, duracion_dias: 5 },
                { agencia_id: agenciaId, nombre: 'Choquequirao 8 dias', precio_usd: 850, costo_operador: 800, duracion_dias: 8 },
                { agencia_id: agenciaId, nombre: 'Cusco 7x7', precio_usd: 820, costo_operador: 750, duracion_dias: 7 },
                { agencia_id: agenciaId, nombre: 'Cusco 5 dias', precio_usd: 720, costo_operador: 680, duracion_dias: 5 },
                { agencia_id: agenciaId, nombre: 'Cusco y Puno 7 dias', precio_usd: 950, costo_operador: 900, duracion_dias: 7 },
                { agencia_id: agenciaId, nombre: 'Huacachina y Cusco 7 dias', precio_usd: 1800, costo_operador: 1700, duracion_dias: 7 },
                { agencia_id: agenciaId, nombre: 'IJT Confidencial "sin MAPI y sin Tren"', precio_usd: 130, costo_operador: 120, duracion_dias: 4 },
                { agencia_id: agenciaId, nombre: 'Alquiler de bicicletas', precio_usd: 10, costo_operador: 10, duracion_dias: 1 }
            ];

            const { error: insertErr } = await supabase.from('tours').insert(toursList);
            if (insertErr) throw insertErr;

            showToast('¡Los 34 tours han sido sincronizados exitosamente!');
            loadTours();
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
                    <h1 className="page-title">Tours</h1>
                    <p className="page-subtitle">Administra tu catálogo de paquetes y actividades</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar tour..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ width: 220, marginBottom: 0, paddingLeft: 12 }}
                    />
                    <button className="btn btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleSyncTours}>
                        🔄 Sincronizar 34 Tours (G-Sheet)
                    </button>
                    <button className="btn btn-primary" onClick={handleAddEmptyRow}>
                        + Nueva Fila
                    </button>
                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <SkeletonTable rows={8} columns={6} />
                ) : tours.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⛰️</div>
                        <div className="empty-state-text">No tienes tours registrados</div>
                        <div className="empty-state-sub">Agrega tus tours aquí para poder elegirlos al crear Reservas.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col />
                                <col style={{ width: '50px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '50px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Nombre del Tour</th>
                                    <th style={{ textAlign: 'center' }}>Días</th>
                                    <th>Precio (USD)</th>
                                    <th>Costo Op. (USD)</th>
                                    <th>Estado</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {tours.filter(t => t.nombre.toLowerCase().includes(searchQuery.toLowerCase())).map(tour => (
                                    <tr key={tour.id} className="sheet-row">
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                value={tour.nombre}
                                                onChange={(val) => handleInlineUpdate(tour.id, 'nombre', val)}
                                                minWidth={200}
                                            />
                                        </td>
                                        <td style={{ padding: 0, textAlign: 'center' }}>
                                            <CellInput
                                                type="number"
                                                value={tour.duracion_dias}
                                                onChange={(val) => handleInlineUpdate(tour.id, 'duracion_dias', val)}
                                                minWidth={30}
                                            />
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-success)', paddingLeft: '8px', fontSize: '0.85rem' }}>$</span>
                                                <CellInput
                                                    type="number"
                                                    value={parseFloat(tour.precio_usd || 0)}
                                                    onChange={(val) => handleInlineUpdate(tour.id, 'precio_usd', val)}
                                                    minWidth={50}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-text-muted)', paddingLeft: '8px', fontSize: '0.85rem' }}>$</span>
                                                <CellInput
                                                    type="number"
                                                    value={parseFloat(tour.costo_operador || 0)}
                                                    onChange={(val) => handleInlineUpdate(tour.id, 'costo_operador', val)}
                                                    minWidth={50}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: 0 }}>
                                            <CellInput
                                                isSelect={true}
                                                value={tour.activo ? 'true' : 'false'}
                                                options={[
                                                    { value: 'true', label: '✅ Activo' },
                                                    { value: 'false', label: '❌ Inactivo' }
                                                ]}
                                                onChange={(val) => handleInlineUpdate(tour.id, 'activo', val === 'true')}
                                                minWidth={80}
                                            />
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(tour.id)} style={{ color: 'var(--color-danger)' }} title="Eliminar fila">🗑</button>
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
