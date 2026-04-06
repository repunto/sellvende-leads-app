/**
 * useReservasData — Custom hook for ReservasPage logic.
 * Encapsulates: loadData, CRUD, inline update, PDF, Communication Hub.
 * Extracted from ReservasPage.jsx (Phase 3 refactor)
 */
import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
    lead_id: '', cliente_nombre: '', cliente_email: '', cliente_telefono: '',
    pax: 1, idioma: 'ES', descuentos: '',
    precio_venta: 0, costo_operador: 0, adelanto: 0, pago_operador: 0,
    estado: 'pendiente',
    tours_list: [],
    opcionales_list: []
}

export function useReservasData({ agencia, showToast, setConfirmDialog }) {

    // ── Core data ───────────────────────────────────────
    const [reservas, setReservas]           = useState([])
    const [operadores, setOperadores]       = useState([])
    const [tours, setTours]                 = useState([])
    const [opcionalesList, setOpcionalesList] = useState([])
    const [descuentosList, setDescuentosList] = useState([])
    const [loading, setLoading]             = useState(true)

    // ── Form modal ──────────────────────────────────────
    const [showForm, setShowForm]           = useState(false)
    const [editingReserva, setEditingReserva] = useState(null)
    const [formData, setFormData]           = useState(EMPTY_FORM)

    // ── Communication Hub ───────────────────────────────
    const [commModal, setCommModal]         = useState(null)
    const [commPlantillas, setCommPlantillas] = useState([])
    const [commSelectedTipo, setCommSelectedTipo] = useState('confirmacion')
    const [commPreview, setCommPreview]     = useState('')
    const [commLoading, setCommLoading]     = useState(false)

    // ── PDF Generation ──────────────────────────────────
    const voucherRef                        = useRef(null)
    const [pdfReserva, setPdfReserva]       = useState(null)
    const [pdfGeneratingId, setPdfGeneratingId] = useState(null)

    // ─────────────────────────────────────────────────────
    // DATA LOADING
    // ─────────────────────────────────────────────────────
    const loadData = useCallback(async (silent = false) => {
        if (!agencia?.id) return
        if (!silent) setLoading(true)

        const [reservasRes, operadoresRes, toursRes, opcionalesRes, descuentosRes] = await Promise.all([
            supabase.from('reservas').select('*, reserva_tours(*), reserva_opcionales(*)').eq('agencia_id', agencia.id).order('created_at', { ascending: false }),
            supabase.from('operadores').select('id, nombre, email, telefono').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('tours').select('id, nombre, precio_usd, costo_operador').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('opcionales').select('id, nombre, precio_usd, costo_operador').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('descuentos').select('id, nombre, descuento_web, tipo').eq('agencia_id', agencia.id).eq('activo', true).order('nombre')
        ])

        if (!reservasRes.error) setReservas(reservasRes.data || [])
        if (!operadoresRes.error) setOperadores(operadoresRes.data || [])
        if (!toursRes.error) setTours(toursRes.data || [])
        if (!opcionalesRes.error) setOpcionalesList(opcionalesRes.data || [])
        if (!descuentosRes.error) setDescuentosList(descuentosRes.data || [])
        if (!silent) setLoading(false)
    }, [agencia?.id])

    // ─────────────────────────────────────────────────────
    // FINANCIAL CALCULATOR (pure helper, no state)
    // ─────────────────────────────────────────────────────
    const recalculateTotals = useCallback((tList, oList, paxVal, descName) => {
        const paxNum  = parseInt(paxVal) || 1
        const toursPV = tList.reduce((sum, t) => sum + (parseFloat(t.precio_venta) || 0), 0)
        const toursCO = tList.reduce((sum, t) => sum + (parseFloat(t.costo_operador) || 0), 0)
        const opcPV   = oList.reduce((sum, o) => sum + (parseFloat(o.precio_venta) || 0), 0)
        const opcCO   = oList.reduce((sum, o) => sum + (parseFloat(o.costo_operador) || 0), 0)
        let totalPV = ((toursPV + opcPV) * paxNum)
        const totalCO = ((toursCO + opcCO) * paxNum).toFixed(2)

        if (descName) {
            const dObj = descuentosList.find(x => x.nombre === descName)
            if (dObj) {
                if (dObj.tipo === 'porcentaje') {
                    totalPV -= totalPV * (parseFloat(dObj.descuento_web) / 100)
                } else {
                    totalPV -= parseFloat(dObj.descuento_web)
                }
            }
        }
        totalPV = Math.max(0, totalPV).toFixed(2)

        return {
            precio_venta: totalPV,
            costo_operador: totalCO,
            adelanto: (parseFloat(totalPV) * 0.5).toFixed(2)
        }
    }, [descuentosList])

    // ─────────────────────────────────────────────────────
    // FORM HELPERS (setters that auto-recalculate totals)
    // ─────────────────────────────────────────────────────
    const setToursList = useCallback((newList) => {
        setFormData(prev => ({
            ...prev,
            tours_list: newList,
            ...recalculateTotals(newList, prev.opcionales_list, prev.pax)
        }))
    }, [recalculateTotals])

    const setOpcionalesLista = useCallback((newList) => {
        setFormData(prev => ({
            ...prev,
            opcionales_list: newList,
            ...recalculateTotals(prev.tours_list, newList, prev.pax)
        }))
    }, [recalculateTotals])

    const handlePaxChange = useCallback((value) => {
        setFormData(prev => ({
            ...prev,
            pax: value,
            ...recalculateTotals(prev.tours_list, prev.opcionales_list, value)
        }))
    }, [recalculateTotals])

    // ─────────────────────────────────────────────────────
    // FORM OPEN / CLOSE
    // ─────────────────────────────────────────────────────
    const openForm = useCallback((reserva = null) => {
        if (reserva) {
            setEditingReserva(reserva)
            setFormData({
                lead_id: reserva.lead_id || '',
                cliente_nombre: reserva.cliente_nombre || '',
                cliente_email: reserva.cliente_email || '',
                cliente_telefono: reserva.cliente_telefono || '',
                pax: reserva.pax || 1,
                idioma: reserva.idioma || 'ES',
                descuentos: reserva.descuentos || '',
                precio_venta: reserva.precio_venta || 0,
                costo_operador: reserva.costo_operador || 0,
                adelanto: reserva.adelanto || 0,
                pago_operador: reserva.pago_operador || 0,
                operador_id: reserva.operador_id || null,
                estado: reserva.estado || 'pendiente',
                tours_list: reserva.reserva_tours || [],
                opcionales_list: reserva.reserva_opcionales || []
            })
        } else {
            setEditingReserva(null)
            setFormData({ ...EMPTY_FORM, agencia_id: agencia?.id })
        }
        setShowForm(true)
    }, [agencia?.id])

    // ─────────────────────────────────────────────────────
    // SAVE
    // ─────────────────────────────────────────────────────
    const handleSave = useCallback(async (e) => {
        e.preventDefault()
        try {
            setLoading(true)
            const { tours_list, opcionales_list, ...masterPayload } = formData
            if (!masterPayload.lead_id) masterPayload.lead_id = null

            let reservaId = null
            if (editingReserva) {
                reservaId = editingReserva.id
                const { error: err1 } = await supabase.from('reservas').update(masterPayload).eq('id', reservaId)
                if (err1) throw err1
                await supabase.from('reserva_tours').delete().eq('reserva_id', reservaId)
                await supabase.from('reserva_opcionales').delete().eq('reserva_id', reservaId)
            } else {
                const { data: newRes, error: err2 } = await supabase.from('reservas').insert([masterPayload]).select('id').single()
                if (err2) throw err2
                reservaId = newRes.id
            }

            const validTours = tours_list.filter(t => t.tour_id)
            if (validTours.length > 0) {
                const { error: errT } = await supabase.from('reserva_tours').insert(
                    validTours.map(t => ({
                        reserva_id: reservaId,
                        tour_id: t.tour_id,
                        fecha_tour: t.fecha_tour || null,
                        precio_venta: t.precio_venta || 0,
                        costo_operador: t.costo_operador || 0,
                        operador_id: t.operador_id || null
                    }))
                )
                if (errT) throw errT
            }

            const validOpc = opcionales_list.filter(o => o.opcional_id)
            if (validOpc.length > 0) {
                const { error: errO } = await supabase.from('reserva_opcionales').insert(
                    validOpc.map(o => ({
                        reserva_id: reservaId,
                        opcional_id: o.opcional_id,
                        fecha_opcional: o.fecha_opcional || null,
                        precio_venta: o.precio_venta || 0,
                        costo_operador: o.costo_operador || 0
                    }))
                )
                if (errO) throw errO
            }

            showToast(editingReserva ? 'Itinerario actualizado' : 'Reserva multi-tour creada')
            setShowForm(false)
            loadData()
        } catch (error) {
            console.error(error)
            alert('Error al guardar el itinerario: ' + error.message)
            setLoading(false)
        }
    }, [formData, editingReserva, showToast, loadData])

    // ─────────────────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────────────────
    const handleDelete = useCallback((id) => {
        setConfirmDialog({
            title: 'Eliminar Reserva',
            message: '¿Eliminar esta reserva y todos sus tours de forma permanente? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar permanentemente',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('reservas').delete().eq('id', id)
                    if (error) throw error
                    showToast('Reserva eliminada exitosamente')
                    loadData()
                } catch (error) {
                    showToast('Error al eliminar la reserva', 'error')
                }
            }
        })
    }, [showToast, loadData, setConfirmDialog])

    // ─────────────────────────────────────────────────────
    // INLINE UPDATE (Google Sheets UX)
    // ─────────────────────────────────────────────────────
    const handleInlineUpdate = useCallback(async (id, field, value, originalRow) => {
        let actualValue = value
        if ((field === 'operador_id' || field === 'tour_id' || field === 'lead_id') && actualValue === '') {
            actualValue = null
        }

        let payload = { [field]: actualValue }
        let newRow  = { ...originalRow, ...payload }

        if (field === 'fecha_tour' && originalRow.reserva_tours?.length > 0) {
            const firstTourId = originalRow.reserva_tours[0].id
            try {
                await supabase.from('reserva_tours').update({ fecha_tour: actualValue }).eq('id', firstTourId)
                newRow.reserva_tours = [...originalRow.reserva_tours]
                newRow.reserva_tours[0] = { ...newRow.reserva_tours[0], fecha_tour: actualValue }
                delete payload.fecha_tour
            } catch (err) {
                showToast('Error actualizando fecha_tour', 'error')
                return
            }
        }

        if (field === 'inline_tours') {
            const selectedTourIds = actualValue ? actualValue.split(', ').filter(Boolean) : []
            const existingRT = originalRow.reserva_tours || []
            const existingIds = existingRT.map(rt => rt.tour_id)
            const addedIds = selectedTourIds.filter(id => !existingIds.includes(id))
            const removedIds = existingIds.filter(id => !selectedTourIds.includes(id))

            let finalRT = [...existingRT]
            if (removedIds.length > 0) {
                finalRT = finalRT.filter(rt => !removedIds.includes(rt.tour_id))
                await supabase.from('reserva_tours').delete().eq('reserva_id', id).in('tour_id', removedIds)
            }
            if (addedIds.length > 0) {
                const newRows = addedIds.map(tid => {
                    const t = tours.find(x => x.id === tid) || {}
                    return {
                        reserva_id: id,
                        tour_id: tid,
                        fecha_tour: originalRow.fecha_tour || null,
                        precio_venta: parseFloat(t.precio_usd || 0),
                        costo_operador: parseFloat(t.costo_operador || 0)
                    }
                })
                finalRT = [...finalRT, ...newRows]
                const { error } = await supabase.from('reserva_tours').insert(newRows)
                if (error) console.error("Error inline insert tours:", error)
            }

            const calcs = recalculateTotals(finalRT, originalRow.reserva_opcionales || [], originalRow.pax, originalRow.descuentos)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
            newRow.reserva_tours = finalRT
            delete payload.inline_tours
        }

        if (field === 'inline_opcionales') {
            const selectedOpcIds = actualValue ? actualValue.split(', ').filter(Boolean) : []
            const existingRO = originalRow.reserva_opcionales || []
            const existingIds = existingRO.map(ro => ro.opcional_id)
            const addedIds = selectedOpcIds.filter(id => !existingIds.includes(id))
            const removedIds = existingIds.filter(id => !selectedOpcIds.includes(id))

            let finalRO = [...existingRO]
            if (removedIds.length > 0) {
                finalRO = finalRO.filter(ro => !removedIds.includes(ro.opcional_id))
                await supabase.from('reserva_opcionales').delete().eq('reserva_id', id).in('opcional_id', removedIds)
            }
            if (addedIds.length > 0) {
                const newRows = addedIds.map(oid => {
                    const o = opcionalesList.find(x => x.id === oid) || {}
                    return {
                        reserva_id: id,
                        opcional_id: oid,
                        precio_venta: parseFloat(o.precio_usd || 0),
                        costo_operador: parseFloat(o.costo_operador || 0)
                    }
                })
                finalRO = [...finalRO, ...newRows]
                const { error } = await supabase.from('reserva_opcionales').insert(newRows)
                if (error) console.error("Error inline insert opcionales:", error)
            }

            const calcs = recalculateTotals(originalRow.reserva_tours || [], finalRO, originalRow.pax, originalRow.descuentos)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
            newRow.reserva_opcionales = finalRO
            delete payload.inline_opcionales
        }

        if (field === 'descuentos') {
            const calcs = recalculateTotals(originalRow.reserva_tours || [], originalRow.reserva_opcionales || [], originalRow.pax, actualValue)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
        }

        if (field === 'pax') {
            const calcs = recalculateTotals(originalRow.reserva_tours || [], originalRow.reserva_opcionales || [], actualValue, originalRow.descuentos)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
        } else if (field === 'precio_venta' || field === 'inline_tours' || field === 'inline_opcionales' || field === 'descuentos') {
            if (field === 'precio_venta') {
                payload.adelanto = (parseFloat(value || 0) * 0.5).toFixed(2)
                newRow.adelanto  = payload.adelanto
            }
        }

        // Only send db update if there are leftover fields
        const hasFieldsToUpdate = Object.keys(payload).length > 0
        
        // Optimistic UI
        setReservas(prev => prev.map(r => r.id === id ? newRow : r))

        try {
            if (hasFieldsToUpdate) {
                const { error } = await supabase.from('reservas').update(payload).eq('id', id)
                if (error) throw error
            }
            // If the user modified tours or pax, reload to sync ID relationships from database in background
            if (field === 'inline_tours' || field === 'inline_opcionales') {
                setTimeout(() => loadData(true), 500) 
            }
        } catch (error) {
            showToast('Error de sincronización, recargando...', 'error')
            loadData()
        }
    }, [recalculateTotals, showToast, loadData])

    // ─────────────────────────────────────────────────────
    // COMMUNICATION HUB
    // ─────────────────────────────────────────────────────
    const replaceShortcodes = useCallback((template, r) => {
        const precio  = parseFloat(r.precio_venta || 0)
        const adelanto = parseFloat(r.adelanto || 0)
        const saldo   = precio - adelanto

        const toursNames = r.reserva_tours?.map(rt => tours.find(t => t.id === rt.tour_id)?.nombre).filter(Boolean).join(' + ') || 'Tour(s)'
        const opcNames   = r.reserva_opcionales?.map(ro => opcionalesList.find(o => o.id === ro.opcional_id)?.nombre).filter(Boolean).join(' + ') || 'Ninguno'
        const fechasList = r.reserva_tours?.map(rt => rt.fecha_tour ? new Date(rt.fecha_tour).toLocaleDateString('es-PE') : '').filter(Boolean) || []
        const fechaStr   = fechasList.length > 0 ? Array.from(new Set(fechasList)).join(', ') : 'fecha por confirmar'

        const isEN = (r.idioma || '').toUpperCase() === 'EN'
        const sp   = isEN
            ? '⭐ Over 1,500 happy travelers trust us. See their real stories on TripAdvisor: https://bit.ly/your-tripadvisor'
            : '⭐ Más de 1,500 viajeros felices confían en nosotros. Mira sus historias reales en TripAdvisor: https://bit.ly/tu-tripadvisor'

        return template
            .replace(/\{nombre\}/g,     r.cliente_nombre || '')
            .replace(/\{tour\}/g,       toursNames)
            .replace(/\{fecha\}/g,      fechaStr)
            .replace(/\{pax\}/g,        String(r.pax || 1))
            .replace(/\{precio\}/g,     precio.toFixed(2))
            .replace(/\{adelanto\}/g,   adelanto.toFixed(2))
            .replace(/\{saldo\}/g,      saldo.toFixed(2))
            .replace(/\{agencia\}/g,    agencia?.nombre || 'la agencia')
            .replace(/\{opcionales\}/g, opcNames)
            .replace(/\{social_proof\}/gi, sp)
    }, [tours, opcionalesList, agencia])

    const openCommHub = useCallback(async (reserva, destinatario) => {
        setCommModal({ reserva, destinatario })
        setCommSelectedTipo('confirmacion')
        setCommLoading(true)
        try {
            const { data } = await supabase.from('plantillas_whatsapp').select('*').order('tipo')
            setCommPlantillas(data || [])
            const best = (data || []).find(p => p.tipo === 'confirmacion' && p.idioma === (reserva.idioma || 'ES'))
                || (data || []).find(p => p.tipo === 'confirmacion')
                || (data || [])[0]
            if (best) {
                setCommSelectedTipo(best.tipo)
                setCommPreview(replaceShortcodes(best.contenido, reserva))
            } else {
                const toursNames = reserva.reserva_tours?.map(rt => tours.find(t => t.id === rt.tour_id)?.nombre).filter(Boolean).join(' + ') || 'Tour(s)'
                const fechasList = reserva.reserva_tours?.map(rt => rt.fecha_tour ? new Date(rt.fecha_tour).toLocaleDateString('es-PE') : '').filter(Boolean) || []
                const fechaStr   = fechasList.length > 0 ? Array.from(new Set(fechasList)).join(', ') : 'fecha por confirmar'
                const fallback   = destinatario === 'cliente'
                    ? `Hola ${reserva.cliente_nombre}, te escribimos para confirmar tu reserva del tour ${toursNames} para el ${fechaStr}. ¡Nos vemos pronto!`
                    : `Nueva reserva:\nTour: ${toursNames}\nFecha: ${fechaStr}\nPax: ${reserva.pax}\nSaldo a cobrar: $${(parseFloat(reserva.precio_venta || 0) - parseFloat(reserva.adelanto || 0)).toFixed(2)}`
                setCommPreview(fallback)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setCommLoading(false)
        }
    }, [replaceShortcodes, tours])

    const handleCommTipoChange = useCallback((tipo) => {
        setCommSelectedTipo(tipo)
        if (!commModal) return
        const match = commPlantillas.find(p => p.tipo === tipo && p.idioma === (commModal.reserva.idioma || 'ES'))
            || commPlantillas.find(p => p.tipo === tipo)
        if (match) setCommPreview(replaceShortcodes(match.contenido, commModal.reserva))
    }, [commModal, commPlantillas, replaceShortcodes])

    const handleSendWhatsApp = useCallback(async () => {
        if (!commModal) return
        const { reserva, destinatario } = commModal
        const campo = destinatario === 'cliente' ? 'confirmacion_enviada' : 'reserva_operador_enviada'
        try {
            await supabase.from('reservas').update({ [campo]: new Date().toISOString() }).eq('id', reserva.id)
            loadData()
        } catch (err) { console.error(err) }

        let phone = destinatario === 'cliente'
            ? reserva.cliente_telefono || ''
            : operadores.find(o => o.id === reserva.operador_id)?.telefono || ''

        if (!phone) { showToast('No hay teléfono para este ' + destinatario, 'error'); return }
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(commPreview)}`, '_blank')
        setCommModal(null)
        showToast('Mensaje de WhatsApp abierto ✅')
    }, [commModal, commPreview, operadores, showToast, loadData])

    const handleSendEmail = useCallback(async () => {
        if (!commModal) return
        const { reserva, destinatario } = commModal
        const campo = destinatario === 'cliente' ? 'confirmacion_enviada' : 'reserva_operador_enviada'
        try {
            await supabase.from('reservas').update({ [campo]: new Date().toISOString() }).eq('id', reserva.id)
            loadData()
        } catch (err) { console.error(err) }

        let email = destinatario === 'cliente'
            ? reserva.cliente_email || ''
            : operadores.find(o => o.id === reserva.operador_id)?.email || ''

        if (!email) { showToast('No hay email para este ' + destinatario, 'error'); return }
        const toursStr = reserva.reserva_tours?.map(rt => tours.find(t => t.id === rt.tour_id)?.nombre).filter(Boolean).join(' + ') || 'Tour'
        window.open(`mailto:${email}?subject=${encodeURIComponent(`Reserva: ${toursStr} - ${reserva.cliente_nombre}`)}&body=${encodeURIComponent(commPreview)}`, '_blank')
        setCommModal(null)
        showToast('Email abierto ✅')
    }, [commModal, commPreview, operadores, tours, showToast, loadData])

    // ─────────────────────────────────────────────────────
    // PDF
    // ─────────────────────────────────────────────────────
    const handleDescargarPdf = useCallback(async (reserva) => {
        setPdfGeneratingId(reserva.id)
        setPdfReserva(reserva)

        requestAnimationFrame(() => {
            setTimeout(async () => {
                if (!voucherRef.current) {
                    showToast('Error: No se pudo renderizar el PDF', 'error')
                    setPdfGeneratingId(null)
                    return
                }
                const { default: html2pdf } = await import('html2pdf.js')
                const opt = {
                    margin: 0,
                    filename: `Voucher-${reserva.codigo_reserva || reserva.id}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                }
                html2pdf().set(opt).from(voucherRef.current).save()
                    .then(() => {
                        showToast('PDF descargado exitosamente')
                        setPdfGeneratingId(null)
                        setPdfReserva(null)
                    })
                    .catch(e => {
                        console.error(e)
                        showToast('Error al generar PDF', 'error')
                        setPdfGeneratingId(null)
                        setPdfReserva(null)
                    })
            }, 50)
        })
    }, [showToast])

    return {
        // Data
        reservas, setReservas,
        operadores, tours, opcionalesList, descuentosList,
        loading, setLoading,
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
    }
}
