/**
 * LeadsPage — Orchestrator (Phase 2 refactored)
 *
 * Logic is fully delegated to custom hooks:
 *   - useMetaSync    → load/sync leads with Meta Ads
 *   - useLeadEmail   → individual/mass email + drip modal
 *   - useLeadSequences → sequence assignment, mass enroll, force-next
 *
 * This file owns only: UI state, filter/pagination, WhatsApp flow,
 * lead CRUD (create/update/delete) and the render tree.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Hooks ──────────────────────────────────────────────
import { useMetaSync }      from '../hooks/useMetaSync'
import { useLeadEmail }     from '../hooks/useLeadEmail'
import { useLeadSequences } from '../hooks/useLeadSequences'

// ── View components ────────────────────────────────────
import LeadsHeaderKPIs from '../components/leads/views/LeadsHeaderKPIs'
import LeadsToolbar    from '../components/leads/views/LeadsToolbar'
import LeadsKanbanView from '../components/leads/views/LeadsKanbanView'
import LeadsTableView  from '../components/leads/views/LeadsTableView'
import SkeletonTable   from '../components/SkeletonTable'

// ── Modal components ───────────────────────────────────
import LeadFormModal         from '../components/leads/modals/LeadFormModal'
import MassSequenceModal     from '../components/leads/modals/MassSequenceModal'
import MassEmailModal        from '../components/leads/modals/MassEmailModal'
import LeadDetailPanel       from '../components/leads/modals/LeadDetailPanel'
import IndividualEmailModal  from '../components/leads/modals/IndividualEmailModal'
import ConfirmModal          from '../components/leads/modals/ConfirmModal'
import WaProductoSelectorModal   from '../components/leads/modals/WaProductoSelectorModal'

// ── Utilities ──────────────────────────────────────────
import { getColdLevel, getLeadScore, formatTemporada } from '../lib/leadsUtils'
import { LEADS_PER_PAGE } from '../hooks/useMetaSync'

// ── Constants ──────────────────────────────────────────
// LEADS_PER_PAGE imported from useMetaSync
const KANBAN_COLS = [
    { estado: 'nuevo',      label: 'Nuevo',      color: '#3b82f6', icon: '✨' },
    { estado: 'contactado', label: 'Contactado',  color: '#eab308', icon: '📞' },
    { estado: 'cotizado',   label: 'Cotizado',    color: '#f97316', icon: '💰' },
    { estado: 'ventado',  label: 'Ventado',   color: '#10b981', icon: '✅' },
]
const badgeClass = (estado) => `badge badge-${estado}`

// ─────────────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
    const { agencia } = useAuth()

    // ── Local UI state ──────────────────────────────────
    const [toast, setToast]                 = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)
    const [search, setSearch]               = useState('')
    const [filtroEstado, setFiltroEstado]   = useState('')
    const [filtroFormulario, setFiltroFormulario] = useState('')
    const [currentPage, setCurrentPage]     = useState(1)
    const [viewMode, setViewMode]           = useState('table')
    const [selectedLeads, setSelectedLeads] = useState(new Set())
    const [dateFrom, setDateFrom]           = useState('')
    const [dateTo, setDateTo]               = useState('')
    const [draggedLeadId, setDraggedLeadId] = useState(null)

    // ── Detail panel ────────────────────────────────────
    const [detailLead, setDetailLead]       = useState(null)
    const [detailEmails, setDetailEmails]   = useState([])

    // ── Template data ────────────────────────────────────
    const [waTemplates, setWaTemplates]       = useState([])
    const [emailTemplates, setEmailTemplates] = useState([])
    const [configs, setConfigs]               = useState({})
    const [allProductos, setAllProductos]             = useState([])
    const [secuencias, setSecuencias]         = useState([])
    const [globalForms, setGlobalForms]       = useState([])

    // ── WhatsApp producto selector modal ────────────────────
    const [waModal, setWaModal] = useState(null)

    // ── Lead form ───────────────────────────────────────
    const [showForm, setShowForm]       = useState(false)
    const [editingLead, setEditingLead] = useState(null)
    const [formData, setFormData]       = useState({
        nombre: '', email: '', telefono: '', producto_interes: '',
        origen: 'Orgánico / Manual', idioma: 'ES',
        personas: '', temporada: '', notas: '', estado: 'nuevo'
    })

    // ── Toast helper ─────────────────────────────────────
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }, [])

    // ─────────────────────────────────────────────────────
    // HOOK: Meta Sync (loads leads, syncs with Meta Ads)
    // ─────────────────────────────────────────────────────
    const {
        leads, setLeads,
        totalLeads,
        kpis,
        pendingNewLeads, setPendingNewLeads,
        loading,
        syncing,
        syncProgress,
        lastSync,
        emailCounts, setEmailCounts,
        sequenceEnrollments: seqEnrollmentsFromSync, setSequenceEnrollments: setSeqEnrollmentsSync,
        syncIntervalRef,
        loadLeads,
        syncMetaLeads,
        deleteAllMetaLeads,
        SYNC_INTERVAL_MS,
    } = useMetaSync({ agenciaId: agencia?.id, showToast, setConfirmDialog })

    // loadLeads helper: passes current filter state to the server
    const reloadPage = useCallback((overrides = {}) => {
        loadLeads({
            page:     overrides.page     ?? currentPage,
            search:   overrides.search   ?? search,
            estado:   overrides.estado   ?? filtroEstado,
            formName: overrides.formName ?? filtroFormulario,
            dateFrom: overrides.dateFrom ?? dateFrom,
            dateTo:   overrides.dateTo   ?? dateTo,
            isKanban: overrides.isKanban ?? (viewMode === 'kanban'),
        })
    }, [loadLeads, currentPage, search, filtroEstado, filtroFormulario, dateFrom, dateTo, viewMode])

    // ─────────────────────────────────────────────────────
    // HOOK: Lead Sequences
    // ─────────────────────────────────────────────────────
    const {
        leadSecuencia, setLeadSecuencia,
        sequenceEnrollments: localSeqEnrollments, setSequenceEnrollments,
        showMassSequenceModal, setShowMassSequenceModal,
        selectedMassSequenceId, setSelectedMassSequenceId,
        enrollingSequence,
        handleAssignSecuencia,
        forceNextDripStep,
        handleStopSequence,
        handleMassSequenceEnroll: _handleMassSequenceEnroll,
    } = useLeadSequences({
        detailLead,
        secuencias,
        setLeads,
        setDetailLead,
        setDetailEmails,
        showToast,
        setConfirmDialog,
    })

    // Merge: DB-loaded enrollments (seqEnrollmentsFromSync) as base,
    // local session changes (localSeqEnrollments) override on top.
    // This fixes the missing 🚀 after mass enroll or page reload.
    const sequenceEnrollments = { ...seqEnrollmentsFromSync, ...localSeqEnrollments }

    // mass enroll needs selectedLeads Set
    const handleMassSequenceEnroll = useCallback(() => {
        _handleMassSequenceEnroll(selectedLeads, leads)
    }, [_handleMassSequenceEnroll, selectedLeads, leads])

    // ─────────────────────────────────────────────────────
    // HOOK: Lead Email
    // ─────────────────────────────────────────────────────
    const {
        showEmailModal, setShowEmailModal,
        showIndividualEmailModal,
        emailSending,
        emailSuccessAnim,
        emailProgress,
        emailPreviewMode, setEmailPreviewMode,
        emailMode, setEmailMode,
        individualEmailLead,
        emailSubject, setEmailSubject,
        emailBody, setEmailBody,
        selectedEmailTemplate, setSelectedEmailTemplate,
        selectedSequenceId, setSelectedSequenceId,
        handleIndividualEmailClick,
        closeIndividualEmailModal,
        handleTemplateDropdownChange,
        openEmailModal: _openEmailModal,
        sendIndividualEmail,
        startDripSequenceFromModal,
        sendBulkEmail: _sendBulkEmail,
    } = useLeadEmail({
        agencia,
        emailTemplates,
        secuencias,
        detailLead,
        setLeads,
        setEmailCounts,
        setSequenceEnrollments,
        setDetailLead,
        setLeadSecuencia,
        setDetailEmails,
        showToast,
        setConfirmDialog,
    })

    // Wrappers that inject context the hook needs from here
    const openEmailModal = useCallback(() => {
        _openEmailModal(leads, selectedLeads)
    }, [_openEmailModal, leads, selectedLeads])

    const sendBulkEmail = useCallback(() => {
        _sendBulkEmail(leads, selectedLeads)
    }, [_sendBulkEmail, leads, selectedLeads])

    // ─────────────────────────────────────────────────────
    // EFFECTS: Load templates + auto-sync
    // ─────────────────────────────────────────────────────

    // Initial load
    useEffect(() => {
        if (agencia?.id) reloadPage({ page: 1 })
    }, [agencia?.id]) // eslint-disable-line

    useEffect(() => {
        if (!agencia?.id) return
        supabase.from('plantillas_whatsapp').select('*').eq('agencia_id', agencia.id)
            .then(({ data }) => { if (data) setWaTemplates(data) })
        supabase.from('plantillas_email').select('*').eq('agencia_id', agencia.id)
            .then(({ data }) => { if (data) setEmailTemplates(data) })
        supabase.from('configuracion').select('clave, valor').eq('agencia_id', agencia.id)
            .then(({ data }) => {
                if (data) {
                    const map = {}
                    data.forEach(r => { map[r.clave] = r.valor })
                    setConfigs(map)
                }
            })
        supabase.from('secuencias_marketing').select('*, pasos:pasos_secuencia(*)')
            .eq('agencia_id', agencia.id).eq('activa', true)
            .then(({ data }) => { if (data) setSecuencias(data) })
        supabase.from('productos').select('id, nombre, precio_usd, duracion_dias')
            .eq('agencia_id', agencia.id)
            .then(({ data }) => { if (data) setAllProductos(data) })
            
        // Fetch all distinct forms from the entire database, not just paginated
        supabase.from('leads').select('form_name, producto_interes').eq('agencia_id', agencia.id).limit(5000)
            .then(({ data }) => {
                if (data) {
                    const uniqueForms = new Set(data.map(l => {
                        let f = l.form_name || l.producto_interes || '';
                        if (f.includes(' - ')) f = f.split(' - ')[0].trim();
                        return f;
                    }).filter(Boolean));
                    setGlobalForms([...uniqueForms].sort());
                }
            })
    }, [agencia?.id])

    // Auto-sync Meta every 30 min
    useEffect(() => {
        syncMetaLeads(true) // silent initial sync
        syncIntervalRef.current = setInterval(() => syncMetaLeads(true), SYNC_INTERVAL_MS)
        return () => clearInterval(syncIntervalRef.current)
    }, []) // eslint-disable-line

    // Re-fetch from server whenever any filter changes (page resets to 1)
    useEffect(() => {
        if (!agencia?.id) return
        setCurrentPage(1)
        setSelectedLeads(new Set())
        reloadPage({ page: 1 })
    }, [search, filtroEstado, filtroFormulario, dateFrom, dateTo, viewMode]) // eslint-disable-line

    // Re-fetch when page number changes
    useEffect(() => {
        if (!agencia?.id) return
        reloadPage({ page: currentPage })
    }, [currentPage]) // eslint-disable-line

    // ─────────────────────────────────────────────────────
    // PAGINATION — now server-driven
    // ─────────────────────────────────────────────────────
    // All leads returned are already the current page
    const filtered  = leads          // server already filtered
    const paginated = leads          // server already paginated
    const startIdx  = (currentPage - 1) * LEADS_PER_PAGE
    const totalPages = Math.ceil(totalLeads / LEADS_PER_PAGE)

    // ─────────────────────────────────────────────────────
    // DETAIL PANEL
    // ─────────────────────────────────────────────────────
    const openDetailPanel = useCallback(async (lead) => {
        setDetailLead(lead)
        const { data } = await supabase.from('email_log')
            .select('*').eq('lead_id', lead.id)
            .order('created_at', { ascending: false }).limit(20)
        setDetailEmails(data || [])
    }, [])

    // ─────────────────────────────────────────────────────
    // LEAD CRUD
    // ─────────────────────────────────────────────────────
    const openForm = useCallback((lead) => {
        if (lead) {
            setEditingLead(lead)
            setFormData({
                nombre: lead.nombre || '', email: lead.email || '',
                telefono: lead.telefono || '', producto_interes: lead.producto_interes || '',
                origen: lead.origen || 'Orgánico / Manual', idioma: lead.idioma || 'ES',
                personas: lead.personas || '', temporada: lead.temporada || '',
                notas: lead.notas || '', estado: lead.estado || 'nuevo',
            })
        } else {
            setEditingLead(null)
            setFormData({
                nombre: '', email: '', telefono: '', producto_interes: '',
                origen: 'Orgánico / Manual', idioma: 'ES',
                personas: '', temporada: '', notas: '', estado: 'nuevo'
            })
        }
        setShowForm(true)
    }, [])

    const handleSave = useCallback(async () => {
        try {
            if (editingLead) {
                const { error } = await supabase.from('leads').update(formData).eq('id', editingLead.id)
                if (error) throw error
                showToast('Lead actualizado correctamente')
            } else {
                const { error } = await supabase.from('leads').insert([{ ...formData, agencia_id: agencia?.id }])
                if (error) throw error
                showToast('Lead creado exitosamente')
            }
            setShowForm(false)
            reloadPage({ page: 1 })
        } catch (error) {
            console.error(error)
            alert('Error al guardar: ' + error.message)
        }
    }, [editingLead, formData, showToast, reloadPage, agencia])

    const handleDelete = useCallback((id) => {
        setConfirmDialog({
            title: 'Eliminar Lead',
            message: '¿Estás seguro de que deseas eliminar este lead? Esta acción no se puede deshacer.',
            danger: true,
            confirmLabel: '🗑 Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    const { error } = await supabase.from('leads').delete().eq('id', id)
                    if (error) throw error
                    showToast('Lead eliminado')
                    reloadPage({ page: 1 })
                } catch (error) {
                    showToast('Error al eliminar: ' + error.message, 'error')
                }
            }
        })
    }, [showToast, reloadPage, setConfirmDialog])

    // ─────────────────────────────────────────────────────
    // LEAD SELECTION (bulk)
    // ─────────────────────────────────────────────────────
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

    const toggleSelectLead = useCallback((id, isShiftPressed, currentIndex) => {
        setSelectedLeads(prev => {
            const next = new Set(prev)
            
            if (isShiftPressed && lastSelectedIndex !== null) {
                const start = Math.min(lastSelectedIndex, currentIndex);
                const end = Math.max(lastSelectedIndex, currentIndex);
                
                const rangeLeads = leads.slice(start, end + 1);
                
                // Determine if we should select or unselect based on the current lead's state
                const isCurrentlySelected = prev.has(id);
                
                rangeLeads.forEach(l => {
                    if (l.email && !l.email_rebotado && !l.unsubscribed) {
                        if (isCurrentlySelected) {
                            next.delete(l.id); // Shift+Click to unselect range
                        } else {
                            next.add(l.id); // Shift+Click to select range
                        }
                    }
                })
            } else {
                next.has(id) ? next.delete(id) : next.add(id)
            }
            
            return next
        })
        setLastSelectedIndex(currentIndex);
    }, [leads, lastSelectedIndex])

    // toggleSelectAll selects ALL valid leads across ALL pages using the server RPC
    const [cargandoSeleccionMassiva, setCargandoSeleccionMassiva] = useState(false);
    const toggleSelectAll = useCallback(async () => {
        // If already have selections, clear them (toggle off)
        if (selectedLeads.size > 0) {
            setSelectedLeads(new Set());
            return;
        }

        setCargandoSeleccionMassiva(true);
        try {
            const PER_PAGE = 500;
            const allIds = [];

            const { data: firstPage, error: firstErr } = await supabase.rpc('get_leads_page', {
                p_agencia_id:   agencia?.id,
                p_page:         1,
                p_per_page:     PER_PAGE,
                p_search:       search   || null,
                p_estado:       filtroEstado   || null,
                p_form_name:    filtroFormulario || null,
                p_date_from:    dateFrom || null,
                p_date_to:      dateTo   || null,
                p_kanban:       false,
                p_kanban_limit: 0,
            });
            if (firstErr) throw firstErr;
            if (!firstPage || firstPage.length === 0) {
                showToast('No se encontraron leads con estos filtros', 'info');
                setCargandoSeleccionMassiva(false);
                return;
            }

            const totalCount = Number(firstPage[0]?.total_count ?? 0);
            firstPage.forEach(l => { if (l.email && !l.unsubscribed) allIds.push(l.id) });

            const totalPages = Math.ceil(totalCount / PER_PAGE);
            for (let p = 2; p <= totalPages; p++) {
                const { data: pageData, error: pageErr } = await supabase.rpc('get_leads_page', {
                    p_agencia_id:   agencia?.id,
                    p_page:         p,
                    p_per_page:     PER_PAGE,
                    p_search:       search   || null,
                    p_estado:       filtroEstado   || null,
                    p_form_name:    filtroFormulario || null,
                    p_date_from:    dateFrom || null,
                    p_date_to:      dateTo   || null,
                    p_kanban:       false,
                    p_kanban_limit: 0,
                });
                if (pageErr) throw pageErr;
                if (pageData) pageData.forEach(l => { if (l.email && !l.unsubscribed) allIds.push(l.id) });
            }

            setSelectedLeads(new Set(allIds));
            showToast(`🎯 ${allIds.length} leads seleccionados de todas las páginas`);
        } catch (error) {
            showToast('Error seleccionando todos: ' + error.message, 'error');
        } finally {
            setCargandoSeleccionMassiva(false);
        }
     }, [agencia?.id, search, filtroEstado, filtroFormulario, dateFrom, dateTo, selectedLeads.size, showToast]);



    // ─────────────────────────────────────────────────────
    // KANBAN
    // ─────────────────────────────────────────────────────
    const handleKanbanDrop = useCallback(async (newEstado) => {
        if (!draggedLeadId) return
        
        const draggedLead = leads.find(l => l.id === draggedLeadId)
        if (!draggedLead) {
            setDraggedLeadId(null)
            return
        }

        const proceedWithDrop = async () => {
            try {
                let updates = { estado: newEstado }

                // Calcular Speed-to-lead si pasa de nuevo a contactado
                if (newEstado === 'contactado' && draggedLead.estado === 'nuevo') {
                    updates.responded_at = new Date().toISOString()
                    const diffMs = new Date() - new Date(draggedLead.created_at)
                    updates.time_to_respond_mins = Math.max(0, Math.floor(diffMs / 60000))
                    
                    if (!draggedLead.ultimo_contacto) {
                        updates.ultimo_contacto = new Date().toISOString()
                    }
                }

                await supabase.from('leads').update(updates).eq('id', draggedLead.id)
                setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, ...updates } : l))
                showToast(`Lead movido a "${newEstado}"`)
            } catch (err) {
                showToast('Error: ' + err.message, 'error')
            }
        }

        if (newEstado === 'contactado' && draggedLead.estado === 'nuevo' && !draggedLead.ultimo_contacto) {
            setConfirmDialog({
                title: '🛑 Validación de Contacto',
                message: 'Este lead no registra ningún email automático ni chat de WhatsApp. Por favor, asegúrate de haberle hablado primero para no reportar una conversión ficticia al Píxel de Meta.\n\n¿Deseas marcarlo como contactado manualmente asumiendo la responsabilidad?',
                danger: false,
                confirmLabel: 'Confirmar Contacto Manual',
                onConfirm: async () => {
                    setConfirmDialog(null)
                    await proceedWithDrop()
                }
            })
            setDraggedLeadId(null)
            return
        }

        await proceedWithDrop()
        setDraggedLeadId(null)
    }, [draggedLeadId, leads, setLeads, showToast, setConfirmDialog])

    // ─────────────────────────────────────────────────────
    // WHATSAPP
    // ─────────────────────────────────────────────────────
    const getWaTemplateAndMsg = useCallback((lead) => {
        let tipoBuscado = 'lead_primer_contacto'
        if (lead.estado === 'contactado') tipoBuscado = 'lead_seguimiento'
        if (lead.estado === 'cotizado')   tipoBuscado = 'cotizacion'
        if (lead.estado === 'ventado')  tipoBuscado = 'confirmacion'
        const idiomaLead = lead.idioma === 'EN' ? 'EN' : 'ES'

        let template = waTemplates.find(t =>
            t.tipo === tipoBuscado && t.idioma === idiomaLead &&
            t.origen && lead.form_name && t.origen.toLowerCase() === lead.form_name.toLowerCase()
        )
        if (!template && lead.producto_interes) {
            const keyword = lead.producto_interes.toLowerCase().trim()
            template = waTemplates.find(t =>
                t.tipo === tipoBuscado && t.idioma === idiomaLead &&
                t.nombre?.toLowerCase().includes(keyword)
            )
        }
        if (!template) template = waTemplates.find(t => t.tipo === tipoBuscado && t.idioma === idiomaLead && (!t.origen || t.origen === ''))
        if (!template && idiomaLead !== 'ES') template = waTemplates.find(t => t.tipo === tipoBuscado && t.idioma === 'ES' && (!t.origen || t.origen === ''))
        if (!template) template = waTemplates[0]

        let baseMsg = template?.contenido || ''
        if (!template) {
            baseMsg = idiomaLead === 'EN'
                ? `Hello {nombre}, thank you for your interest in {producto}. How can I help you?`
                : `Hola {nombre}, gracias por tu interés en {producto}. ¿Cómo te puedo ayudar?`
        }
        return { template, baseMsg }
    }, [waTemplates])

    const handleWhatsAppClick = useCallback((lead) => {
        const { template, baseMsg } = getWaTemplateAndMsg(lead)
        if (!baseMsg) return
        if (baseMsg.includes('{precio}')) {
            const searchKeyword = (template?.nombre || lead.producto_interes || '').toLowerCase()
            let matches = allProductos.filter(t => t.nombre.toLowerCase().includes(searchKeyword))
            if (matches.length === 0 && lead.producto_interes)
                matches = allProductos.filter(t => t.nombre.toLowerCase().includes(lead.producto_interes.toLowerCase()))
            if (matches.length === 0) matches = allProductos
            setWaModal({ lead, template, baseMsg, matchingProductos: matches })
            return
        }
        finishWaClick(lead, baseMsg, null)
    }, [getWaTemplateAndMsg, allProductos])

    const finishWaClick = useCallback((lead, baseMsg, selectedProducto) => {
        const isEN = lead.idioma === 'EN'
        const socialProofWA = isEN
            ? '⭐ Over 1,500 happy customers trust us. See their real stories on our reviews page.'
            : '⭐ Más de 1,500 clientes felices confían en nosotros. Mira sus historias reales en nuestra página de reseñas.'

        let msg = baseMsg
            .replace(/{nombre}/gi, lead.nombre || '')
            .replace(/{producto}/gi, selectedProducto?.nombre || lead.producto_interes || 'nuestros productos')
            .replace(/{personas}/gi, lead.personas || '')
            .replace(/{temporada}/gi, formatTemporada(lead.temporada))
            .replace(/{fecha}/gi, formatTemporada(lead.temporada))
            .replace(/{fechaviaje}/gi, formatTemporada(lead.temporada))
            .replace(/{pax}/gi, lead.personas || '')
            .replace(/{telefono}/gi, configs.whatsapp || configs.telefono_agencia || '')
            .replace(/{email}/gi, configs.email_contacto || '')
            .replace(/{agencia}/gi, configs.nombre_visible || agencia?.nombre || 'nuestra agencia')
            .replace(/{social_proof}/gi, socialProofWA)

        msg = selectedProducto
            ? msg.replace(/{precio}/gi, `$${selectedProducto.precio_usd}`)
            : msg.replace(/{precio}/gi, '')

        let tel = (lead.telefono || '').replace(/[^0-9]/g, '')
        const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`

        supabase.from('leads').update({ ultimo_contacto: new Date().toISOString() }).eq('id', lead.id).then()
        window.open(url, '_blank')
        setWaModal(null)
    }, [configs, agencia])

    // ─────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────
    return (
        <>
            {/* ── Toast ── */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : toast.type === 'info' ? 'toast-info' : 'toast-success'}`}>
                    {toast.msg}
                </div>
            )}

            {/* ── Header KPIs ── */}
            <LeadsHeaderKPIs
                kpis={kpis}
                lastSync={lastSync}
                setFiltroEstado={setFiltroEstado}
            />

            <div className="page-body">
                {/* ── Toolbar ── */}
                <LeadsToolbar
                    search={search} setSearch={setSearch}
                    filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado}
                    filtroFormulario={filtroFormulario} setFiltroFormulario={setFiltroFormulario}
                    leads={leads}
                    globalForms={globalForms}
                    syncMetaLeads={syncMetaLeads} syncing={syncing}
                    deleteAllMetaLeads={deleteAllMetaLeads}
                    openForm={openForm}
                    dateFrom={dateFrom} setDateFrom={setDateFrom}
                    dateTo={dateTo} setDateTo={setDateTo}
                    selectedLeads={selectedLeads} filtered={filtered}
                    openEmailModal={openEmailModal}
                    setShowMassSequenceModal={setShowMassSequenceModal}
                    viewMode={viewMode} setViewMode={setViewMode}
                />

                {/* ── Sync progress bar ── */}
                {syncProgress && (
                    <div style={{
                        padding: '8px 16px', marginBottom: 12,
                        background: 'var(--color-bg-hover)', borderRadius: 6,
                        fontSize: '0.85rem', color: 'var(--color-text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 8
                    }}>
                        <span style={{ animation: 'pulse 1s infinite' }}>📡</span> {syncProgress}
                    </div>
                )}

                {/* ── Realtime: pending new leads banner ── */}
                {pendingNewLeads > 0 && (
                    <div
                        onClick={() => {
                            setPendingNewLeads(0)
                            reloadPage({ page: 1 })
                        }}
                        style={{
                            padding: '10px 16px', marginBottom: 12,
                            background: 'linear-gradient(90deg, #10b98120, #3b82f620)',
                            border: '1px solid #10b98150',
                            borderRadius: 8, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 10,
                            animation: 'slideDown 0.3s ease',
                            fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)'
                        }}
                    >
                        <span style={{ fontSize: '1.1rem', animation: 'pulse 1.5s infinite' }}>🔥</span>
                        {pendingNewLeads} nuevo{pendingNewLeads !== 1 ? 's' : ''} lead{pendingNewLeads !== 1 ? 's' : ''} acaba de llegar
                        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-accent)', textDecoration: 'underline' }}>
                            Ver ahora →
                        </span>
                    </div>
                )}

                {/* ── Main view ── */}
                {loading ? (
                    <SkeletonTable rows={5} columns={8} />
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-text">
                            No hay leads{filtroEstado ? ` con estado "${filtroEstado}"` : ''}
                        </div>
                        <div className="empty-state-sub">Haz clic en "+ Nuevo Lead" para agregar uno.</div>
                    </div>
                ) : viewMode === 'kanban' ? (
                    <LeadsKanbanView
                        filtered={filtered}
                        KANBAN_COLS={KANBAN_COLS}
                        handleKanbanDrop={handleKanbanDrop}
                        setDraggedLeadId={setDraggedLeadId}
                        openDetailPanel={openDetailPanel}
                        getColdLevel={getColdLevel}
                        getLeadScore={getLeadScore}
                        handleWhatsAppClick={handleWhatsAppClick}
                        openForm={openForm}
                    />
                ) : (
                    <LeadsTableView
                        filtered={filtered}
                        leads={leads}
                        startIdx={startIdx}
                        LEADS_PER_PAGE={LEADS_PER_PAGE}
                        selectedLeads={selectedLeads}
                        setSelectedLeads={setSelectedLeads}
                        paginated={paginated}
                        toggleSelectAll={toggleSelectAll}
                        cargandoSeleccionMassiva={cargandoSeleccionMassiva}
                        toggleSelectLead={toggleSelectLead}
                        openDetailPanel={openDetailPanel}
                        getColdLevel={getColdLevel}
                        getLeadScore={getLeadScore}
                        badgeClass={badgeClass}
                        emailCounts={emailCounts}
                        sequenceEnrollments={sequenceEnrollments}
                        handleStopSequence={handleStopSequence}
                        secuencias={secuencias}
                        handleWhatsAppClick={handleWhatsAppClick}
                        openForm={openForm}
                        handleDelete={handleDelete}
                        totalLeads={totalLeads}
                        totalPages={totalPages}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                    />
                )}

                {/* ── Modals ── */}
                <LeadFormModal
                    show={showForm}
                    onClose={() => setShowForm(false)}
                    editingLead={editingLead}
                    formData={formData}
                    setFormData={setFormData}
                    handleSave={handleSave}
                    leads={leads}
                />

                <MassSequenceModal
                    show={showMassSequenceModal}
                    onClose={() => setShowMassSequenceModal(false)}
                    selectedLeadsCount={selectedLeads.size}
                    secuencias={secuencias}
                    selectedMassSequenceId={selectedMassSequenceId}
                    setSelectedMassSequenceId={setSelectedMassSequenceId}
                    enrollingSequence={enrollingSequence}
                    enrollMassSequence={handleMassSequenceEnroll}
                />

                <MassEmailModal
                    show={showEmailModal}
                    onClose={() => setShowEmailModal(false)}
                    selectedLeadsCount={selectedLeads.size}
                    emailTemplates={emailTemplates}
                    selectedEmailTemplate={selectedEmailTemplate}
                    setSelectedEmailTemplate={setSelectedEmailTemplate}
                    emailSubject={emailSubject}
                    setEmailSubject={setEmailSubject}
                    emailBody={emailBody}
                    setEmailBody={setEmailBody}
                    emailPreviewMode={emailPreviewMode}
                    setEmailPreviewMode={setEmailPreviewMode}
                    configs={configs}
                    agencia={agencia}
                    emailSending={emailSending}
                    emailSuccessAnim={emailSuccessAnim}
                    emailProgress={emailProgress}
                    sendBulkEmail={sendBulkEmail}
                />

                <LeadDetailPanel
                    detailLead={detailLead}
                    setDetailLead={setDetailLead}
                    openForm={openForm}
                    handleWhatsAppClick={handleWhatsAppClick}
                    getLeadScore={getLeadScore}
                    badgeClass={badgeClass}
                    getColdLevel={getColdLevel}
                    leadSecuencia={leadSecuencia}
                    secuencias={secuencias}
                    handleAssignSecuencia={handleAssignSecuencia}
                    forceNextDripStep={forceNextDripStep}
                    detailEmails={detailEmails}
                    handleIndividualEmailClick={handleIndividualEmailClick}
                    emailTemplates={emailTemplates}
                />

                <IndividualEmailModal
                    show={showIndividualEmailModal}
                    onClose={closeIndividualEmailModal}
                    lead={individualEmailLead}
                    emailMode={emailMode}
                    setEmailMode={setEmailMode}
                    selectedSequenceId={selectedSequenceId}
                    setSelectedSequenceId={setSelectedSequenceId}
                    secuencias={secuencias}
                    emailTemplates={emailTemplates}
                    selectedEmailTemplate={selectedEmailTemplate}
                    onTemplateChange={handleTemplateDropdownChange}
                    emailSubject={emailSubject}
                    setEmailSubject={setEmailSubject}
                    emailBody={emailBody}
                    setEmailBody={setEmailBody}
                    emailPreviewMode={emailPreviewMode}
                    setEmailPreviewMode={setEmailPreviewMode}
                    configs={configs}
                    agencia={agencia}
                    emailSending={emailSending}
                    emailSuccessAnim={emailSuccessAnim}
                    sendIndividualEmail={sendIndividualEmail}
                    startDripSequenceFromModal={startDripSequenceFromModal}
                />

                <WaProductoSelectorModal
                    waModal={waModal}
                    setWaModal={setWaModal}
                    finishWaClick={finishWaClick}
                />

                <ConfirmModal
                    show={!!confirmDialog}
                    title={confirmDialog?.title || ''}
                    message={confirmDialog?.message || ''}
                    danger={confirmDialog?.danger || false}
                    confirmLabel={confirmDialog?.confirmLabel}
                    onConfirm={confirmDialog?.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            </div>
        </>
    )
}
