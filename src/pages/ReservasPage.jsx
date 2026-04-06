/**
 * ReservasPage — Orchestrator (Phase 3 refactored)
 *
 * Logic fully delegated to useReservasData hook.
 * This file owns only: filter/pagination UI, table render, and modal composition.
 */
import { useEffect, useCallback } from 'react'
import { useAuth }       from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { useState }      from 'react'

import { useReservasData } from '../hooks/useReservasData'

import CellInput   from '../components/CellInput'
import PdfVoucher  from '../components/PdfVoucher'
import SkeletonTable from '../components/SkeletonTable'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import CommHubModal from '../components/reservas/CommHubModal'
import ReservaFormModal from '../components/reservas/ReservaFormModal'

// ── Constants ──────────────────────────────────────────
const ITEMS_PER_PAGE = 50

// ─────────────────────────────────────────────────────────────────────────────
export default function ReservasPage() {
    const { agencia } = useAuth()
    const navigate    = useNavigate()
    const location    = useLocation()

    // ── Local UI state ──────────────────────────────────
    const [search, setSearch]           = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [toast, setToast]             = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    // ─────────────────────────────────────────────────────
    // HOOK
    // ─────────────────────────────────────────────────────
    const {
        reservas,
        operadores, tours, opcionalesList, descuentosList,
        loading,
        loadData,
        // Form
        showForm, setShowForm,
        editingReserva,
        formData, setFormData,
        openForm,
        handleSave,
        handleDelete,
        handleInlineUpdate,
        setToursList,
        setOpcionalesLista,
        handlePaxChange,
        // Comm Hub
        commModal, setCommModal,
        commPlantillas,
        commSelectedTipo,
        commPreview, setCommPreview,
        commLoading,
        openCommHub,
        handleCommTipoChange,
        handleSendWhatsApp,
        handleSendEmail,
        // PDF
        voucherRef,
        pdfReserva,
        pdfGeneratingId,
        handleDescargarPdf,
    } = useReservasData({ agencia, showToast, setConfirmDialog })

    // ─────────────────────────────────────────────────────
    // EFFECTS
    // ─────────────────────────────────────────────────────
    useEffect(() => {
        loadData()
        if (location.state?.nuevaReserva) {
            openForm(null)
            navigate(location.pathname, { replace: true, state: {} })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, location.pathname, navigate])

    // ─────────────────────────────────────────────────────
    // FILTER + PAGINATION
    // ─────────────────────────────────────────────────────
    const filtered = reservas.filter(r => {
        if (!search) return true
        const s        = search.toLowerCase()
        const toursStr = r.reserva_tours?.map(rt => tours.find(t => t.id === rt.tour_id)?.nombre).filter(Boolean).join(' ') || ''
        return r.cliente_nombre?.toLowerCase().includes(s) ||
               toursStr.toLowerCase().includes(s) ||
               r.cliente_telefono?.includes(s)
    })

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    // ─────────────────────────────────────────────────────
    // TABLE ROW OPTIONS (computed outside render loop for perf)
    // ─────────────────────────────────────────────────────
    const opOptions   = [{ value: '', label: 'Ninguno' }, ...operadores.map(o => ({ value: o.id, label: o.nombre }))]
    const idiOptions  = [{ value: 'ES', label: 'ES' }, { value: 'EN', label: 'EN' }, { value: 'PT', label: 'PT' }]
    const descOptions = [{ value: '', label: 'Ninguno' }, ...descuentosList.map(d => ({ value: d.nombre, label: `${d.nombre} (${d.tipo === 'porcentaje' ? d.descuento_web + '%' : '-$' + d.descuento_web})` }))]
    const toursOptions = tours.map(t => ({ value: t.id, label: t.nombre }))
    const opcOptions   = opcionalesList.map(o => ({ value: o.id, label: o.nombre }))


    // ─────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────
    return (
        <>
            {/* ── Toast ── */}
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <ConfirmModal
                show={!!confirmDialog}
                title={confirmDialog?.title || ''}
                message={confirmDialog?.message || ''}
                danger={confirmDialog?.danger || false}
                confirmLabel={confirmDialog?.confirmLabel}
                onConfirm={confirmDialog?.onConfirm}
                onClose={() => setConfirmDialog(null)}
            />

            {/* ── Page header ── */}
            <div className="page-header">
                <h1 className="page-title">Reservas</h1>
                <p className="page-subtitle">Pizarra de operaciones y finanzas (Estilo G-Sheet)</p>
            </div>

            <div className="page-body">
                {/* ── Toolbar ── */}
                <div className="toolbar">
                    <div className="toolbar-left">
                        <input
                            type="text"
                            className="toolbar-search"
                            placeholder="Buscar cliente o tour..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={() => openForm(null)}>
                        + Nueva Reserva
                    </button>
                </div>

                {/* ── Main Content ── */}
                {loading ? (
                    <SkeletonTable rows={10} columns={18} />
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🎫</div>
                        <div className="empty-state-text">No hay reservas registradas.</div>
                        <div className="empty-state-sub">Registra tu primera venta haciendo clic en "+ Nueva Reserva".</div>
                    </div>
                ) : (
                    <div className="table-container" style={{ overflowX: 'auto', paddingBottom: 20 }}>
                        <table className="data-table" style={{ minWidth: 1600, fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th>Fecha Tour</th>
                                    <th>Cliente</th>
                                    <th style={{ textAlign: 'center' }}>Pax</th>
                                    <th>Tour Contratado</th>
                                    <th>Opcionales</th>
                                    <th>Descuentos</th>
                                    <th>Precio Venta</th>
                                    <th>Costo Operador</th>
                                    <th>Adelanto Cliente</th>
                                    <th>Saldo Cliente</th>
                                    <th>Pago a Operador</th>
                                    <th>Operador Devuelve</th>
                                    <th>Beneficio</th>
                                    <th>Operador</th>
                                    <th>Idioma</th>
                                    <th>Confirmación Cliente</th>
                                    <th>Reserva Operador</th>
                                    <th>Edición</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(r => {
                                    // G-Sheet financial formulas
                                    const precio   = parseFloat(r.precio_venta || 0)
                                    const costo    = parseFloat(r.costo_operador || 0)
                                    const adelanto = parseFloat(r.adelanto || 0)
                                    const saldoX   = precio - adelanto
                                    const diff     = costo - saldoX
                                    const vPagoOp     = diff > 0 ? diff : 0
                                    const vOpDevuelve = diff < 0 ? Math.abs(diff) : 0
                                    const vBenef      = precio - costo

                                    return (
                                        <tr key={r.id}>
                                            <td style={{ padding: 4 }}>
                                                <CellInput type="date" value={r.reserva_tours?.length > 0 ? (r.reserva_tours[0].fecha_tour || '') : (r.fecha_tour || '')} onChange={v => handleInlineUpdate(r.id, 'fecha_tour', v, r)} minWidth={110} />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput value={r.cliente_nombre} onChange={v => handleInlineUpdate(r.id, 'cliente_nombre', v, r)} minWidth={120} />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput type="number" value={r.pax} onChange={v => handleInlineUpdate(r.id, 'pax', v, r)} minWidth={50} />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput 
                                                    isSelect 
                                                    isMulti 
                                                    options={toursOptions} 
                                                    value={r.reserva_tours?.map(rt => rt.tour_id).join(', ')} 
                                                    onChange={v => handleInlineUpdate(r.id, 'inline_tours', v, r)} 
                                                    minWidth={240} 
                                                />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput 
                                                    isSelect 
                                                    isMulti 
                                                    options={opcOptions} 
                                                    value={r.reserva_opcionales?.map(ro => ro.opcional_id).join(', ')} 
                                                    onChange={v => handleInlineUpdate(r.id, 'inline_opcionales', v, r)} 
                                                    minWidth={180} 
                                                />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput isSelect options={descOptions} value={r.descuentos || ''} onChange={v => handleInlineUpdate(r.id, 'descuentos', v, r)} minWidth={140} />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80, fontWeight: 600 }}>$
                                                    <CellInput type="number" value={r.precio_venta} onChange={v => handleInlineUpdate(r.id, 'precio_venta', v, r)} minWidth={60} />
                                                </div>
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80, color: 'var(--color-text-muted)' }}>$
                                                    <CellInput type="number" value={r.costo_operador} onChange={v => handleInlineUpdate(r.id, 'costo_operador', v, r)} minWidth={60} />
                                                </div>
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}>$
                                                    <CellInput type="number" value={r.adelanto} onChange={v => handleInlineUpdate(r.id, 'adelanto', v, r)} minWidth={60} />
                                                </div>
                                            </td>
                                            <td style={{ color: saldoX > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600, background: 'rgba(234,179,8,0.1)', verticalAlign: 'middle' }}>
                                                ${saldoX.toFixed(2)}
                                            </td>
                                            <td style={{ color: vPagoOp > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', verticalAlign: 'middle' }}>
                                                ${vPagoOp.toFixed(2)}
                                            </td>
                                            <td style={{ color: vOpDevuelve > 0 ? 'var(--color-success)' : 'var(--color-text-muted)', verticalAlign: 'middle' }}>
                                                ${vOpDevuelve.toFixed(2)}
                                            </td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-text)', verticalAlign: 'middle' }}>${vBenef.toFixed(2)}</td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput isSelect options={opOptions} value={r.operador_id} onChange={v => handleInlineUpdate(r.id, 'operador_id', v, r)} minWidth={120} />
                                            </td>
                                            <td style={{ padding: 4 }}>
                                                <CellInput isSelect options={idiOptions} value={r.idioma} onChange={v => handleInlineUpdate(r.id, 'idioma', v, r)} minWidth={60} />
                                            </td>

                                            {/* Comm Hub — Cliente */}
                                            <td style={{ textAlign: 'center', fontSize: '0.8rem', verticalAlign: 'middle' }}>
                                                {r.confirmacion_enviada ? (
                                                    <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                                                        ✅ {new Date(r.confirmacion_enviada).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openCommHub(r, 'cliente')} style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                        Enviar
                                                    </button>
                                                )}
                                            </td>

                                            {/* Comm Hub — Operador */}
                                            <td style={{ textAlign: 'center', fontSize: '0.8rem', verticalAlign: 'middle' }}>
                                                {r.reserva_operador_enviada ? (
                                                    <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                                                        ✅ {new Date(r.reserva_operador_enviada).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openCommHub(r, 'operador')} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                                        🚚 Enviar
                                                    </button>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td style={{ whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDescargarPdf(r)} title="Descargar Voucher PDF">
                                                    {pdfGeneratingId === r.id ? '⏳' : '📄'}
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openForm(r)} title="Extras / Configuración Avanzada">⚙️</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id)} style={{ color: 'var(--color-danger)' }} title="Eliminar Permanente">🗑</button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {/* ── Pagination ── */}
                        {filtered.length > ITEMS_PER_PAGE && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    Anterior
                                </button>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                    Siguiente
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Modals ── */}
                <ReservaFormModal
                    show={showForm}
                    editingReserva={editingReserva}
                    formData={formData}
                    setFormData={setFormData}
                    handleSave={handleSave}
                    tours={tours}
                    operadores={operadores}
                    opcionalesList={opcionalesList}
                    descuentosList={descuentosList}
                    setToursList={setToursList}
                    setOpcionalesLista={setOpcionalesLista}
                    handlePaxChange={handlePaxChange}
                    onClose={() => setShowForm(false)}
                />

                <CommHubModal
                    commModal={commModal}
                    setCommModal={setCommModal}
                    operadores={operadores}
                    tours={tours}
                    commSelectedTipo={commSelectedTipo}
                    handleCommTipoChange={handleCommTipoChange}
                    commLoading={commLoading}
                    commPreview={commPreview}
                    setCommPreview={setCommPreview}
                    commPlantillas={commPlantillas}
                    handleSendWhatsApp={handleSendWhatsApp}
                    handleSendEmail={handleSendEmail}
                />

                {/* ── Hidden PDF Renderer ── */}
                {pdfGeneratingId && pdfReserva && (
                    <PdfVoucher ref={voucherRef} reserva={pdfReserva} agencia={agencia} />
                )}
            </div>
        </>
    )
}
