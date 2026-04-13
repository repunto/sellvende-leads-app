/**
 * useMetaSync — Custom hook for Meta Ads leads synchronization.
 *
 * Architecture (Sprint I — Realtime):
 *  - Supabase Realtime WebSocket listens for INSERT/UPDATE/DELETE on `leads`.
 *  - New leads appear at the top of the table instantly (no refresh needed).
 *  - If user is on page 2+ or has filters, a notification banner appears.
 *  - 30-min polling kept as a silent "catch-up" Safety Net fallback.
 *  - Server-Side Pagination (Sprint H) fully preserved.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const LEADS_PER_PAGE   = 50
export const KANBAN_MAX_LEADS = 1000
const        SYNC_INTERVAL_MS = 30 * 60 * 1000

export function useMetaSync({ agenciaId, showToast, setConfirmDialog }) {
    // ── Core state ───────────────────────────────────────────────────────────
    const [leads,               setLeads]               = useState([])
    const [totalLeads,          setTotalLeads]          = useState(0)
    const [loading,             setLoading]             = useState(true)
    const [syncing,             setSyncing]             = useState(false)
    const [syncProgress,        setSyncProgress]        = useState('')
    const [lastSync,            setLastSync]            = useState(null)
    const [emailCounts,         setEmailCounts]         = useState({})
    const [sequenceEnrollments, setSequenceEnrollments] = useState({})

    // ── KPIs (from server RPC) ───────────────────────────────────────────────
    const [kpis, setKpis] = useState({
        total: 0, nuevo: 0, contactado: 0,
        cotizado: 0, cliente: 0, frios: 0, dado_de_baja: 0
    })

    // ── Realtime: incoming leads notification ────────────────────────────────
    // When user is NOT on page 1 / has filters, we buffer new leads here
    // instead of interrupting their view.
    const [pendingNewLeads, setPendingNewLeads] = useState(0)

    const syncIntervalRef     = useRef(null)
    const realtimeChannelRef  = useRef(null)
    // Track current filter context to decide whether to inject or buffer
    const currentFiltersRef   = useRef({ page: 1, search: '', estado: '', formName: '', dateFrom: '', dateTo: '', isKanban: false })

    // ────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────
    const refreshKpis = useCallback(async () => {
        if (!agenciaId) return
        const { data } = await supabase.rpc('get_leads_kpis', { p_agencia_id: agenciaId })
        if (data) setKpis(data)
    }, [agenciaId])

    const refreshEmailCounts = useCallback(async () => {
        if (!agenciaId) return
        const { data } = await supabase.rpc('get_email_counts', { p_agencia_id: agenciaId })
        if (data) {
            const counts = {}
            data.forEach(log => { counts[log.lead_id] = parseInt(log.count, 10) || 0 })
            setEmailCounts(counts)
        }
    }, [agenciaId])

    // ────────────────────────────────────────────────────────────────────────
    // loadLeads — main paginated data fetcher
    // ────────────────────────────────────────────────────────────────────────
    const loadLeads = useCallback(async ({
        page     = 1,
        search   = '',
        estado   = '',
        formName = '',
        dateFrom = '',
        dateTo   = '',
        isKanban = false,
    } = {}) => {
        if (!agenciaId) return

        // Save current filter state for Realtime injection decisions
        currentFiltersRef.current = { page, search, estado, formName, dateFrom, dateTo, isKanban }

        setLoading(true)
        setPendingNewLeads(0) // clear any buffered notification on reload

        const { data: rows, error } = await supabase.rpc('get_leads_page', {
            p_agencia_id:   agenciaId,
            p_page:         page,
            p_per_page:     LEADS_PER_PAGE,
            p_search:       search   || null,
            p_estado:       estado   || null,
            p_form_name:    formName || null,
            p_date_from:    dateFrom || null,
            p_date_to:      dateTo   || null,
            p_kanban:       isKanban,
            p_kanban_limit: KANBAN_MAX_LEADS,
        })

        if (error) {
            console.error('[loadLeads] RPC error:', error)
            showToast('Error cargando leads: ' + error.message, 'error')
            setLoading(false)
            return
        }

        const serverTotal = rows?.[0]?.total_count ?? 0
        setLeads(rows || [])
        setTotalLeads(Number(serverTotal))

        await Promise.all([refreshKpis(), refreshEmailCounts()])

        // Fetch sequence enrollments for visible leads only
        if (rows && rows.length > 0) {
            const visibleIds = rows.map(l => l.id)
            const allSeqs = []
            for (let i = 0; i < visibleIds.length; i += 50) {
                const chunk = visibleIds.slice(i, i + 50)
                const { data: seqChunk } = await supabase
                    .from('leads_secuencias')
                    .select('lead_id, secuencia_id, estado, ultimo_paso_ejecutado, secuencias_marketing(nombre)')
                    .in('lead_id', chunk)
                    .in('estado', ['en_progreso', 'pausado'])
                if (seqChunk) allSeqs.push(...seqChunk)
            }
            const enrollments = {}
            allSeqs.forEach(s => { enrollments[s.lead_id] = s })
            setSequenceEnrollments(enrollments)
        }

        setLoading(false)
    }, [agenciaId, showToast, refreshKpis, refreshEmailCounts])

    // ────────────────────────────────────────────────────────────────────────
    // Realtime WebSocket subscription
    // ────────────────────────────────────────────────────────────────────────
    const startRealtimeSubscription = useCallback(() => {
        if (!agenciaId || realtimeChannelRef.current) return

        const channel = supabase
            .channel(`leads-agency-${agenciaId}`)
            .on(
                'postgres_changes',
                {
                    event:  'INSERT',
                    schema: 'public',
                    table:  'leads',
                    filter: `agencia_id=eq.${agenciaId}`,
                },
                (payload) => {
                    const newLead = payload.new
                    const ctx = currentFiltersRef.current

                    // Only inject directly if user is on page 1 with no active filters
                    const isCleanView = ctx.page === 1 && !ctx.search && !ctx.estado && !ctx.formName && !ctx.dateFrom && !ctx.dateTo

                    if (isCleanView) {
                        // Inject at top with a flash marker for animation
                        setLeads(prev => [{ ...newLead, _isNew: true }, ...prev.slice(0, LEADS_PER_PAGE - 1)])
                        setTotalLeads(prev => prev + 1)
                        showToast(`🔥 Nuevo lead: ${newLead.nombre || newLead.email || 'Sin nombre'}`, 'info')
                        // Auto-clear the _isNew marker after 3s
                        setTimeout(() => {
                            setLeads(prev => prev.map(l => l.id === newLead.id ? { ...l, _isNew: false } : l))
                        }, 3000)
                    } else {
                        // Buffer the notification — don't disrupt current filtered view
                        setPendingNewLeads(prev => prev + 1)
                    }

                    // Always refresh KPIs silently
                    refreshKpis()
                }
            )
            .on(
                'postgres_changes',
                {
                    event:  'UPDATE',
                    schema: 'public',
                    table:  'leads',
                    filter: `agencia_id=eq.${agenciaId}`,
                },
                (payload) => {
                    const updated = payload.new
                    setLeads(prev => prev.map(l => l.id === updated.id ? { ...updated } : l))
                    refreshKpis()
                }
            )
            .on(
                'postgres_changes',
                {
                    event:  'DELETE',
                    schema: 'public',
                    table:  'leads',
                },
                (payload) => {
                    const deletedId = payload.old?.id
                    if (deletedId) {
                        setLeads(prev => prev.filter(l => l.id !== deletedId))
                        setTotalLeads(prev => Math.max(0, prev - 1))
                        refreshKpis()
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] ✅ Leads channel connected')
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn('[Realtime] ⚠️ Channel error — falling back to polling')
                }
            })

        realtimeChannelRef.current = channel
    }, [agenciaId, showToast, refreshKpis])

    const stopRealtimeSubscription = useCallback(() => {
        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current)
            realtimeChannelRef.current = null
            console.log('[Realtime] 🔌 Leads channel disconnected')
        }
    }, [])

    // ────────────────────────────────────────────────────────────────────────
    // Auto-start Realtime when agenciaId is available
    // ────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!agenciaId) return
        startRealtimeSubscription()
        return () => stopRealtimeSubscription()
    }, [agenciaId, startRealtimeSubscription, stopRealtimeSubscription])

    // ────────────────────────────────────────────────────────────────────────
    // syncMetaLeads — manual or auto Meta Ads sync
    // ────────────────────────────────────────────────────────────────────────
    const syncMetaLeads = useCallback(async (silent = false) => {
        if (!silent) setSyncing(true)
        if (!silent) setSyncProgress('Conectando con Meta Api (Edge Function)...')

        try {
            const { data, error } = await supabase.functions.invoke('sync-leads', {
                body: { agencia_id: agenciaId }
            })

            if (error) throw error

            if (data.error) {
                const hint = data.error.includes('token') || data.error.includes('Session')
                    ? '⚠️ Tu token de Meta ha expirado. Ve a Configuración y vincula tu página.'
                    : 'Error de Meta API: ' + data.error
                if (!silent) showToast(hint, 'error')
                if (!silent) setSyncing(false)
                return
            }

            const { totalImported, totalSkipped } = data
            setLastSync(new Date())

            if (totalImported > 0) {
                // Realtime will handle the visual injection automatically
                if (!silent) showToast(`🔔 ${totalImported} leads nuevos importados desde Meta!`)
            } else if (!silent) {
                showToast(`✅ Todo sincronizado. ${totalSkipped || 0} ya existían. Evaluando secuencias pendientes...`)
            }

            // ALWAYS trigger process-drips to clear any stuck backlog 
            // even if there were 0 new leads imported today.
            supabase.functions.invoke('process-drips').catch(e =>
                console.warn('[AutoPilot] Could not fire process-drips after sync:', e)
            )
        } catch (err) {
            console.error('Meta sync error:', err)
            if (!silent) showToast('Error sincronizando: ' + err.message, 'error')
        } finally {
            setSyncing(false)
            setSyncProgress('')
        }
    }, [agenciaId, showToast])

    // ────────────────────────────────────────────────────────────────────────
    // deleteAllMetaLeads
    // ────────────────────────────────────────────────────────────────────────
    const deleteAllMetaLeads = useCallback(() => {
        const metaOrigins = ['Meta Ads', 'Facebook Ads', 'Instagram Ads']
        setConfirmDialog({
            title:        'Eliminar Leads de Meta',
            message:      `¿Eliminar TODOS los leads de Meta (Facebook + Instagram)? Podrás re-sincronizar después.`,
            danger:       true,
            confirmLabel: `🗑 Eliminar leads de Meta`,
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    for (const o of metaOrigins) {
                        await supabase.from('leads').delete().eq('origen', o).eq('agencia_id', agenciaId)
                    }
                    showToast(`🗑 Leads de Meta eliminados. Ahora sincroniza de nuevo.`)
                    loadLeads()
                } catch (err) {
                    showToast('Error: ' + err.message, 'error')
                }
            }
        })
    }, [showToast, setConfirmDialog, loadLeads])

    return {
        leads, setLeads,
        totalLeads,
        kpis,
        pendingNewLeads, setPendingNewLeads,
        loading,
        syncing,
        syncProgress,
        lastSync,
        emailCounts, setEmailCounts,
        sequenceEnrollments, setSequenceEnrollments,
        syncIntervalRef,
        loadLeads,
        syncMetaLeads,
        deleteAllMetaLeads,
        SYNC_INTERVAL_MS,
    }
}
