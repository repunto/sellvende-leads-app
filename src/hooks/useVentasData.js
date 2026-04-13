/**
 * useVentasData — Custom hook for VentasPage logic.
 * Encapsulates: loadData, CRUD, inline update, PDF, Communication Hub.
 * Extracted from VentasPage.jsx (Phase 3 refactor)
 */
import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
    lead_id: '', cliente_nombre: '', cliente_email: '', cliente_telefono: '',
    pax: 1, idioma: 'ES', descuentos: '',
    precio_venta: 0, costo_asesor: 0, adelanto: 0, pago_asesor: 0,
    estado: 'pendiente',
    productos_list: [],
    extras_list: []
}

export function useVentasData({ agencia, showToast, setConfirmDialog }) {

    // ── Core data ───────────────────────────────────────
    const [ventas, setVentas]           = useState([])
    const [asesores, setAsesores]       = useState([])
    const [productos, setProductos]                 = useState([])
    const [extrasList, setextrasList] = useState([])
    const [descuentosList, setDescuentosList] = useState([])
    const [loading, setLoading]             = useState(true)

    // ── Form modal ──────────────────────────────────────
    const [showForm, setShowForm]           = useState(false)
    const [editingVenta, setEditingVenta] = useState(null)
    const [formData, setFormData]           = useState(EMPTY_FORM)

    // ── Communication Hub ───────────────────────────────
    const [commModal, setCommModal]         = useState(null)
    const [commPlantillas, setCommPlantillas] = useState([])
    const [commSelectedTipo, setCommSelectedTipo] = useState('confirmacion')
    const [commPreview, setCommPreview]     = useState('')
    const [commLoading, setCommLoading]     = useState(false)

    // ── PDF Generation ──────────────────────────────────
    const voucherRef                        = useRef(null)
    const [pdfVenta, setPdfVenta]       = useState(null)
    const [pdfGeneratingId, setPdfGeneratingId] = useState(null)

    // ─────────────────────────────────────────────────────
    // DATA LOADING
    // ─────────────────────────────────────────────────────
    const loadData = useCallback(async (silent = false) => {
        if (!agencia?.id) return
        if (!silent) setLoading(true)

        const [ventasRes, asesoresRes, productosRes, extrasRes, descuentosRes] = await Promise.all([
            supabase.from('ventas').select('*, venta_productos(*), venta_extras(*)').eq('agencia_id', agencia.id).order('created_at', { ascending: false }),
            supabase.from('asesores').select('id, nombre, email, telefono').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('productos').select('id, nombre, precio_usd, costo_asesor').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('extras').select('id, nombre, precio_usd, costo_asesor').eq('agencia_id', agencia.id).eq('activo', true).order('nombre'),
            supabase.from('descuentos').select('id, nombre, descuento_web, tipo').eq('agencia_id', agencia.id).eq('activo', true).order('nombre')
        ])

        if (!ventasRes.error) setVentas(ventasRes.data || [])
        if (!asesoresRes.error) setAsesores(asesoresRes.data || [])
        if (!productosRes.error) setProductos(productosRes.data || [])
        if (!extrasRes.error) setextrasList(extrasRes.data || [])
        if (!descuentosRes.error) setDescuentosList(descuentosRes.data || [])
        if (!silent) setLoading(false)
    }, [agencia?.id])

    // ─────────────────────────────────────────────────────
    // FINANCIAL CALCULATOR (pure helper, no state)
    // ─────────────────────────────────────────────────────
    const recalculateTotals = useCallback((tList, oList, paxVal, descName) => {
        const paxNum  = parseInt(paxVal) || 1
        const productosPV = tList.reduce((sum, t) => sum + (parseFloat(t.precio_venta) || 0), 0)
        const productosCO = tList.reduce((sum, t) => sum + (parseFloat(t.costo_asesor) || 0), 0)
        const opcPV   = oList.reduce((sum, o) => sum + (parseFloat(o.precio_venta) || 0), 0)
        const opcCO   = oList.reduce((sum, o) => sum + (parseFloat(o.costo_asesor) || 0), 0)
        let totalPV = ((productosPV + opcPV) * paxNum)
        const totalCO = ((productosCO + opcCO) * paxNum).toFixed(2)

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
            costo_asesor: totalCO,
            adelanto: (parseFloat(totalPV) * 0.5).toFixed(2)
        }
    }, [descuentosList])

    // ─────────────────────────────────────────────────────
    // FORM HELPERS (setters that auto-recalculate totals)
    // ─────────────────────────────────────────────────────
    const setProductosList = useCallback((newList) => {
        setFormData(prev => ({
            ...prev,
            productos_list: newList,
            ...recalculateTotals(newList, prev.extras_list, prev.pax)
        }))
    }, [recalculateTotals])

    const setextrasLista = useCallback((newList) => {
        setFormData(prev => ({
            ...prev,
            extras_list: newList,
            ...recalculateTotals(prev.productos_list, newList, prev.pax)
        }))
    }, [recalculateTotals])

    const handlePaxChange = useCallback((value) => {
        setFormData(prev => ({
            ...prev,
            pax: value,
            ...recalculateTotals(prev.productos_list, prev.extras_list, value)
        }))
    }, [recalculateTotals])

    // ─────────────────────────────────────────────────────
    // FORM OPEN / CLOSE
    // ─────────────────────────────────────────────────────
    const openForm = useCallback((venta = null, prefillLead = null) => {
        if (venta) {
            setEditingVenta(venta)
            setFormData({
                lead_id: venta.lead_id || '',
                cliente_nombre: venta.cliente_nombre || '',
                cliente_email: venta.cliente_email || '',
                cliente_telefono: venta.cliente_telefono || '',
                pax: venta.pax || 1,
                idioma: venta.idioma || 'ES',
                descuentos: venta.descuentos || '',
                precio_venta: venta.precio_venta || 0,
                costo_asesor: venta.costo_asesor || 0,
                adelanto: venta.adelanto || 0,
                pago_asesor: venta.pago_asesor || 0,
                asesor_id: venta.asesor_id || null,
                estado: venta.estado || 'pendiente',
                productos_list: venta.venta_productos || [],
                extras_list: venta.venta_extras || []
            })
        } else {
            setEditingVenta(null)
            setFormData({
                ...EMPTY_FORM,
                agencia_id: agencia?.id,
                ...(prefillLead ? {
                    lead_id: prefillLead.id || '',
                    cliente_nombre: prefillLead.nombre || '',
                    cliente_email: prefillLead.email || '',
                    cliente_telefono: prefillLead.telefono || '',
                } : {})
            })
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
            const { productos_list, extras_list, ...masterPayload } = formData
            if (!masterPayload.lead_id) masterPayload.lead_id = null

            let ventaId = null
            if (editingVenta) {
                ventaId = editingVenta.id
                const { error: err1 } = await supabase.from('ventas').update(masterPayload).eq('id', ventaId)
                if (err1) throw err1
                await supabase.from('venta_productos').delete().eq('venta_id', ventaId)
                await supabase.from('venta_extras').delete().eq('venta_id', ventaId)
            } else {
                const { data: newRes, error: err2 } = await supabase.from('ventas').insert([masterPayload]).select('id').single()
                if (err2) throw err2
                ventaId = newRes.id

                // NEW: If this sale comes from a lead, move the lead to "cliente" status
                if (masterPayload.lead_id) {
                    await supabase.from('leads').update({
                        estado: 'cliente',
                        ultimo_contacto: new Date().toISOString()
                    }).eq('id', masterPayload.lead_id)
                }
            }

            const validProductos = productos_list.filter(t => t.producto_id)
            if (validProductos.length > 0) {
                const { error: errT } = await supabase.from('venta_productos').insert(
                    validProductos.map(t => ({
                        venta_id: ventaId,
                        producto_id: t.producto_id,
                        fecha_servicio: t.fecha_servicio || null,
                        precio_venta: t.precio_venta || 0,
                        costo_asesor: t.costo_asesor || 0,
                        asesor_id: t.asesor_id || null
                    }))
                )
                if (errT) throw errT
            }

            const validOpc = extras_list.filter(o => o.extra_id)
            if (validOpc.length > 0) {
                const { error: errO } = await supabase.from('venta_extras').insert(
                    validOpc.map(o => ({
                        venta_id: ventaId,
                        extra_id: o.extra_id,
                        fecha_extra: o.fecha_extra || null,
                        precio_venta: o.precio_venta || 0,
                        costo_asesor: o.costo_asesor || 0
                    }))
                )
                if (errO) throw errO
            }

            showToast(editingVenta ? 'Itinerario actualizado' : 'Venta multi-producto creada')
            setShowForm(false)
            loadData()
        } catch (error) {
            console.error(error)
            alert('Error al guardar el itinerario: ' + error.message)
            setLoading(false)
        }
    }, [formData, editingVenta, showToast, loadData])

    // ─────────────────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────────────────
    const handleDelete = useCallback((id) => {
        setConfirmDialog({
            title: 'Eliminar Venta',
            message: '¿Eliminar esta venta y todos sus productos de forma permanente? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar permanentemente',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('ventas').delete().eq('id', id)
                    if (error) throw error
                    showToast('Venta eliminada exitosamente')
                    loadData()
                } catch (error) {
                    showToast('Error al eliminar la venta', 'error')
                }
            }
        })
    }, [showToast, loadData, setConfirmDialog])

    // ─────────────────────────────────────────────────────
    // INLINE UPDATE (Google Sheets UX)
    // ─────────────────────────────────────────────────────
    const handleInlineUpdate = useCallback(async (id, field, value, originalRow) => {
        let actualValue = value
        if ((field === 'asesor_id' || field === 'producto_id' || field === 'lead_id') && actualValue === '') {
            actualValue = null
        }

        let payload = { [field]: actualValue }
        let newRow  = { ...originalRow, ...payload }

        if (field === 'fecha_servicio' && originalRow.venta_productos?.length > 0) {
            const firstProductoId = originalRow.venta_productos[0].id
            try {
                await supabase.from('venta_productos').update({ fecha_servicio: actualValue }).eq('id', firstProductoId)
                newRow.venta_productos = [...originalRow.venta_productos]
                newRow.venta_productos[0] = { ...newRow.venta_productos[0], fecha_servicio: actualValue }
                delete payload.fecha_servicio
            } catch (err) {
                showToast('Error actualizando fecha_servicio', 'error')
                return
            }
        }

        if (field === 'inline_productos') {
            const selectedProductoIds = actualValue ? actualValue.split(', ').filter(Boolean) : []
            const existingRT = originalRow.venta_productos || []
            const existingIds = existingRT.map(rt => rt.producto_id)
            const addedIds = selectedProductoIds.filter(id => !existingIds.includes(id))
            const removedIds = existingIds.filter(id => !selectedProductoIds.includes(id))

            let finalRT = [...existingRT]
            if (removedIds.length > 0) {
                finalRT = finalRT.filter(rt => !removedIds.includes(rt.producto_id))
                await supabase.from('venta_productos').delete().eq('venta_id', id).in('producto_id', removedIds)
            }
            if (addedIds.length > 0) {
                const newRows = addedIds.map(tid => {
                    const t = productos.find(x => x.id === tid) || {}
                    return {
                        venta_id: id,
                        producto_id: tid,
                        fecha_servicio: originalRow.fecha_servicio || null,
                        precio_venta: parseFloat(t.precio_usd || 0),
                        costo_asesor: parseFloat(t.costo_asesor || 0)
                    }
                })
                finalRT = [...finalRT, ...newRows]
                const { error } = await supabase.from('venta_productos').insert(newRows)
                if (error) console.error("Error inline insert productos:", error)
            }

            const calcs = recalculateTotals(finalRT, originalRow.venta_extras || [], originalRow.pax, originalRow.descuentos)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
            newRow.venta_productos = finalRT
            delete payload.inline_productos
        }

        if (field === 'inline_extras') {
            const selectedOpcIds = actualValue ? actualValue.split(', ').filter(Boolean) : []
            const existingRO = originalRow.venta_extras || []
            const existingIds = existingRO.map(ro => ro.extra_id)
            const addedIds = selectedOpcIds.filter(id => !existingIds.includes(id))
            const removedIds = existingIds.filter(id => !selectedOpcIds.includes(id))

            let finalRO = [...existingRO]
            if (removedIds.length > 0) {
                finalRO = finalRO.filter(ro => !removedIds.includes(ro.extra_id))
                await supabase.from('venta_extras').delete().eq('venta_id', id).in('extra_id', removedIds)
            }
            if (addedIds.length > 0) {
                const newRows = addedIds.map(oid => {
                    const o = extrasList.find(x => x.id === oid) || {}
                    return {
                        venta_id: id,
                        extra_id: oid,
                        precio_venta: parseFloat(o.precio_usd || 0),
                        costo_asesor: parseFloat(o.costo_asesor || 0)
                    }
                })
                finalRO = [...finalRO, ...newRows]
                const { error } = await supabase.from('venta_extras').insert(newRows)
                if (error) console.error("Error inline insert extras:", error)
            }

            const calcs = recalculateTotals(originalRow.venta_productos || [], finalRO, originalRow.pax, originalRow.descuentos)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
            newRow.venta_extras = finalRO
            delete payload.inline_extras
        }

        if (field === 'descuentos') {
            const calcs = recalculateTotals(originalRow.venta_productos || [], originalRow.venta_extras || [], originalRow.pax, actualValue)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
        }

        if (field === 'pax') {
            const calcs = recalculateTotals(originalRow.venta_productos || [], originalRow.venta_extras || [], actualValue, originalRow.descuentos)
            Object.assign(payload, calcs)
            Object.assign(newRow, calcs)
        } else if (field === 'precio_venta' || field === 'inline_productos' || field === 'inline_extras' || field === 'descuentos') {
            if (field === 'precio_venta') {
                payload.adelanto = (parseFloat(value || 0) * 0.5).toFixed(2)
                newRow.adelanto  = payload.adelanto
            }
        }

        // Only send db update if there are leftover fields
        const hasFieldsToUpdate = Object.keys(payload).length > 0
        
        // Optimistic UI
        setVentas(prev => prev.map(r => r.id === id ? newRow : r))

        try {
            if (hasFieldsToUpdate) {
                const { error } = await supabase.from('ventas').update(payload).eq('id', id)
                if (error) throw error
            }
            // If the user modified productos or pax, reload to sync ID relationships from database in background
            if (field === 'inline_productos' || field === 'inline_extras') {
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

        const productosNames = r.venta_productos?.map(rt => productos.find(t => t.id === rt.producto_id)?.nombre).filter(Boolean).join(' + ') || 'Producto(s)'
        const opcNames   = r.venta_extras?.map(ro => extrasList.find(o => o.id === ro.extra_id)?.nombre).filter(Boolean).join(' + ') || 'Ninguno'
        const fechasList = r.venta_productos?.map(rt => rt.fecha_servicio ? new Date(rt.fecha_servicio).toLocaleDateString('es-PE') : '').filter(Boolean) || []
        const fechaStr   = fechasList.length > 0 ? Array.from(new Set(fechasList)).join(', ') : 'fecha por confirmar'

        const isEN = (r.idioma || '').toUpperCase() === 'EN'
        const sp   = isEN
            ? '⭐ Over 1,500 happy customers trust us. See their real stories on our reviews page.'
            : '⭐ Más de 1,500 clientes felices confían en nosotros. Mira sus historias reales en nuestra página de reseñas.'

        return template
            .replace(/\{nombre\}/g,     r.cliente_nombre || '')
            .replace(/\{producto\}/g,       productosNames)
            .replace(/\{fecha\}/g,      fechaStr)
            .replace(/\{pax\}/g,        String(r.pax || 1))
            .replace(/\{precio\}/g,     precio.toFixed(2))
            .replace(/\{adelanto\}/g,   adelanto.toFixed(2))
            .replace(/\{saldo\}/g,      saldo.toFixed(2))
            .replace(/\{agencia\}/g,    agencia?.nombre || 'la agencia')
            .replace(/\{extras\}/g, opcNames)
            .replace(/\{social_proof\}/gi, sp)
    }, [productos, extrasList, agencia])

    const openCommHub = useCallback(async (venta, destinatario) => {
        setCommModal({ venta, destinatario })
        setCommSelectedTipo('confirmacion')
        setCommLoading(true)
        try {
            const { data } = await supabase.from('plantillas_whatsapp').select('*').order('tipo')
            setCommPlantillas(data || [])
            const best = (data || []).find(p => p.tipo === 'confirmacion' && p.idioma === (venta.idioma || 'ES'))
                || (data || []).find(p => p.tipo === 'confirmacion')
                || (data || [])[0]
            if (best) {
                setCommSelectedTipo(best.tipo)
                setCommPreview(replaceShortcodes(best.contenido, venta))
            } else {
                const productosNames = venta.venta_productos?.map(rt => productos.find(t => t.id === rt.producto_id)?.nombre).filter(Boolean).join(' + ') || 'Producto(s)'
                const fechasList = venta.venta_productos?.map(rt => rt.fecha_servicio ? new Date(rt.fecha_servicio).toLocaleDateString('es-PE') : '').filter(Boolean) || []
                const fechaStr   = fechasList.length > 0 ? Array.from(new Set(fechasList)).join(', ') : 'fecha por confirmar'
                const fallback   = destinatario === 'cliente'
                    ? `🎉 ¡Nueva venta online!\n\nProducto: ${productosNames}\nFecha: ${fechaStr}\nCant.: ${venta.pax}\nTotal pagado: $${parseFloat(venta.adelanto || 0).toFixed(2)}\nSaldo a cobrar: $${(parseFloat(venta.precio_venta || 0) - parseFloat(venta.adelanto || 0)).toFixed(2)}\nID Transacción: ${venta.id_transaccion}`
                    : `Nueva venta:\nProducto: ${productosNames}\nFecha: ${fechaStr}\nCant.: ${venta.pax}\nSaldo a cobrar: $${(parseFloat(venta.precio_venta || 0) - parseFloat(venta.adelanto || 0)).toFixed(2)}`
                setCommPreview(fallback)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setCommLoading(false)
        }
    }, [replaceShortcodes, productos])

    const handleCommTipoChange = useCallback((tipo) => {
        setCommSelectedTipo(tipo)
        if (!commModal) return
        const match = commPlantillas.find(p => p.tipo === tipo && p.idioma === (commModal.venta.idioma || 'ES'))
            || commPlantillas.find(p => p.tipo === tipo)
        if (match) setCommPreview(replaceShortcodes(match.contenido, commModal.venta))
    }, [commModal, commPlantillas, replaceShortcodes])

    const handleSendWhatsApp = useCallback(async () => {
        if (!commModal) return
        const { venta, destinatario } = commModal
        const campo = destinatario === 'cliente' ? 'confirmacion_enviada' : 'venta_asesor_enviada'
        try {
            await supabase.from('ventas').update({ [campo]: new Date().toISOString() }).eq('id', venta.id)
            loadData()
        } catch (err) { console.error(err) }

        let phone = destinatario === 'cliente'
            ? venta.cliente_telefono || ''
            : asesores.find(o => o.id === venta.asesor_id)?.telefono || ''

        if (!phone) { showToast('No hay teléfono para este ' + destinatario, 'error'); return }
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(commPreview)}`, '_blank')
        setCommModal(null)
        showToast('Mensaje de WhatsApp abierto ✅')
    }, [commModal, commPreview, asesores, showToast, loadData])

    const handleSendEmail = useCallback(async () => {
        if (!commModal) return
        const { venta, destinatario } = commModal
        const campo = destinatario === 'cliente' ? 'confirmacion_enviada' : 'venta_asesor_enviada'
        try {
            await supabase.from('ventas').update({ [campo]: new Date().toISOString() }).eq('id', venta.id)
            loadData()
        } catch (err) { console.error(err) }

        let email = destinatario === 'cliente'
            ? venta.cliente_email || ''
            : asesores.find(o => o.id === venta.asesor_id)?.email || ''

        if (!email) { showToast('No hay email para este ' + destinatario, 'error'); return }
        const productosStr = venta.venta_productos?.map(rt => productos.find(t => t.id === rt.producto_id)?.nombre).filter(Boolean).join(' + ') || 'Producto'
        window.open(`mailto:${email}?subject=${encodeURIComponent(`Venta: ${productosStr} - ${venta.cliente_nombre}`)}&body=${encodeURIComponent(commPreview)}`, '_blank')
        setCommModal(null)
        showToast('Email abierto ✅')
    }, [commModal, commPreview, asesores, productos, showToast, loadData])

    // ─────────────────────────────────────────────────────
    // PDF
    // ─────────────────────────────────────────────────────
    const handleDescargarPdf = useCallback(async (venta) => {
        setPdfGeneratingId(venta.id)
        setPdfVenta(venta)

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
                    filename: `Voucher-${venta.codigo_venta || venta.id}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                }
                html2pdf().set(opt).from(voucherRef.current).save()
                    .then(() => {
                        showToast('PDF descargado exitosamente')
                        setPdfGeneratingId(null)
                        setPdfVenta(null)
                    })
                    .catch(e => {
                        console.error(e)
                        showToast('Error al generar PDF', 'error')
                        setPdfGeneratingId(null)
                        setPdfVenta(null)
                    })
            }, 50)
        })
    }, [showToast])

    return {
        // Data
        ventas, setVentas,
        asesores, productos, extrasList, descuentosList,
        loading, setLoading,
        loadData,
        // Form
        showForm, setShowForm,
        editingVenta,
        formData, setFormData,
        openForm,
        handleSave,
        handleDelete,
        handleInlineUpdate,
        setProductosList,
        setextrasLista,
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
        pdfVenta,
        pdfGeneratingId,
        handleDescargarPdf,
    }
}
