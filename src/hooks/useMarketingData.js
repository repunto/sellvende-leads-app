import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Centralises all state and Supabase I/O for MarketingPage.
 * Returns data, loaders, and action handlers for both tabs.
 */
export function useMarketingData() {
    const { agencia } = useAuth()

    // ── Tab 1: Secuencias ─────────────────────────────────────────────────
    const [secuencias, setSecuencias] = useState([])
    const [loadingSecs, setLoadingSecs] = useState(true)
    const [plantillasEmail, setPlantillasEmail] = useState([])
    const [plantillasWA, setPlantillasWA] = useState([])
    const [metaForms, setMetaForms] = useState([])

    // ── Motor / Master Switch ─────────────────────────────────────────────
    const [masterSwitch, setMasterSwitch] = useState(false)
    const [loadingMasterSwitch, setLoadingMasterSwitch] = useState(false)
    const [cronStatus, setCronStatus] = useState(null) // null | 'active' | 'inactive'
    const [autoEnrollCount, setAutoEnrollCount] = useState(null)
    const [procesandoDrips, setProcesandoDrips] = useState(false)

    // ── Tab 2: ROAS ───────────────────────────────────────────────────────
    const [roasData, setRoasData] = useState([])
    const [loadingRoas, setLoadingRoas] = useState(false)

    // ── Toast ─────────────────────────────────────────────────────────────
    const [toastMsg, setToastMsg] = useState(null)

    const showToast = useCallback((msg, type = 'success') => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 4000)
    }, [])

    // ─────────────────────────────────────────────────────────────────────
    // Loaders
    // ─────────────────────────────────────────────────────────────────────

    const loadSecuencias = useCallback(async () => {
        if (!agencia) return
        setLoadingSecs(true)
        const { data, error } = await supabase
            .from('secuencias_marketing')
            .select('*, pasos:pasos_secuencia(*)')
            .eq('agencia_id', agencia.id)
            .order('created_at', { ascending: false })
        if (!error) setSecuencias(data || [])
        setLoadingSecs(false)
    }, [agencia])

    const loadPlantillas = useCallback(async () => {
        if (!agencia) return
        const [em, wa] = await Promise.all([
            supabase.from('plantillas_email')
                .select('id, tipo, idioma, asunto, nombre, origen')
                .eq('agencia_id', agencia.id),
            supabase.from('plantillas_whatsapp')
                .select('id, tipo, idioma, contenido, nombre, origen')
                .eq('agencia_id', agencia.id)
        ])
        if (!em.error) setPlantillasEmail(em.data || [])
        if (!wa.error) setPlantillasWA(wa.data || [])
    }, [agencia])

    const loadMetaForms = useCallback(async () => {
        if (!agencia) return
        const { data } = await supabase
            .from('leads')
            .select('form_name, producto_interes')
            .or('form_name.not.is.null,producto_interes.not.is.null')
        if (data?.length > 0) {
            const unique = [...new Set(
                data.flatMap(d => [d.form_name, d.producto_interes]).filter(Boolean)
            )].sort()
            setMetaForms(unique)
        }
    }, [agencia])

    const loadMasterSwitch = useCallback(async () => {
        if (!agencia) return
        const { data } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('agencia_id', agencia.id)
            .eq('clave', 'master_sequence_switch')
            .maybeSingle()
        setMasterSwitch(data?.valor === 'true')
    }, [agencia])

    const loadSystemStatus = useCallback(async () => {
        if (!agencia) return
        const { data: cronData } = await supabase
            .rpc('check_cron_job_exists', { job_name: 'autopilot-drips-daily' })
            .maybeSingle()
        setCronStatus(cronData === true ? 'active' : 'inactive')

        const today = new Date().toISOString().split('T')[0]
        const { count } = await supabase
            .from('leads_secuencias')
            .select('id', { count: 'exact', head: true })
            .eq('agencia_id', agencia.id)
            .gte('created_at', today)
        setAutoEnrollCount(count || 0)
    }, [agencia])

    const loadRoasData = useCallback(async () => {
        if (!agencia) return
        setLoadingRoas(true)
        const [invResp, leadsResp, resResp] = await Promise.all([
            supabase.from('inversion_marketing')
                .select('*')
                .eq('agencia_id', agencia.id)
                .order('anio', { ascending: false })
                .order('mes', { ascending: false }),
            supabase.from('leads')
                .select('id, origen, created_at')
                .eq('agencia_id', agencia.id),
            supabase.from('ventas')
                .select('id, lead_id, precio_venta, estado')
                .eq('agencia_id', agencia.id)
                .in('estado', ['confirmada', 'completada', 'pagada'])
        ])

        const inv    = invResp.data   || []
        const leads  = leadsResp.data || []
        const res    = resResp.data   || []

        const computed = inv.map(i => {
            const leadsFromInv = leads.filter(l => {
                const dt = new Date(l.created_at)
                return (
                    dt.getMonth() + 1 === i.mes &&
                    dt.getFullYear() === i.anio &&
                    l.origen?.toLowerCase().trim() === i.campana_origen.toLowerCase().trim()
                )
            })
            const numLeads   = leadsFromInv.length
            const leadIds    = leadsFromInv.map(l => l.id)
            const resFromInv = res.filter(r => r.lead_id && leadIds.includes(r.lead_id))
            const numClientes = resFromInv.length
            const totalVenta  = resFromInv.reduce((s, r) => s + Number(r.precio_venta || 0), 0)
            const cpl  = numLeads   > 0 ? i.gasto_usd / numLeads   : 0
            const cac  = numClientes > 0 ? i.gasto_usd / numClientes : 0
            const roas = i.gasto_usd > 0 ? totalVenta  / i.gasto_usd  : 0
            return { ...i, numLeads, numClientes, totalVenta, cpl, cac, roas }
        })

        setRoasData(computed)
        setLoadingRoas(false)
    }, [agencia])

    // ─────────────────────────────────────────────────────────────────────
    // Bootstrap
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!agencia) return
        loadSecuencias()
        loadPlantillas()
        loadRoasData()
        loadMasterSwitch()
        loadSystemStatus()
        loadMetaForms()
    }, [agencia]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─────────────────────────────────────────────────────────────────────
    // Actions: Secuencias
    // ─────────────────────────────────────────────────────────────────────

    const saveSecuencia = useCallback(async ({ editingSecuencia, secuenciaForm, pasos }) => {
        const payload = {
            ...secuenciaForm,
            agencia_id: agencia.id,
            nombre: secuenciaForm.producto_match || 'Secuencia'
        }
        let secId = null

        if (editingSecuencia) {
            const { error } = await supabase
                .from('secuencias_marketing')
                .update(payload)
                .eq('id', editingSecuencia.id)
            if (error) throw error
            secId = editingSecuencia.id
            showToast('Secuencia actualizada')
        } else {
            const { data, error } = await supabase
                .from('secuencias_marketing')
                .insert([payload])
                .select()
                .single()
            if (error) throw error
            secId = data.id
            showToast('Secuencia creada')
        }

        // Rebuild steps (delete-then-insert)
        if (editingSecuencia) {
            await supabase.from('pasos_secuencia').delete().eq('secuencia_id', secId)
        }
        if (pasos.length > 0) {
            const pasosPayload = pasos.map(p => ({
                secuencia_id:          secId,
                dia_envio:             p.dia_envio,
                plantilla_email_id:    p.plantilla_email_id    || null,
                plantilla_whatsapp_id: p.plantilla_whatsapp_id || null
            }))
            const { error: errPasos } = await supabase.from('pasos_secuencia').insert(pasosPayload)
            if (errPasos) throw errPasos
        }

        await loadSecuencias()
    }, [agencia, loadSecuencias, showToast])

    const deleteSecuencia = useCallback(async (id) => {
        await supabase.from('secuencias_marketing').delete().eq('id', id)
        showToast('Secuencia eliminada')
        await loadSecuencias()
    }, [loadSecuencias, showToast])

    // ─────────────────────────────────────────────────────────────────────
    // Actions: Master Switch + Drips
    // ─────────────────────────────────────────────────────────────────────

    const validateEmailMotor = useCallback(async () => {
        const { data, error } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .eq('agencia_id', agencia.id)
            .in('clave', ['proveedor_email', 'gmail_app_password', 'resend_api_key', 'email_remitente'])
        if (error || !data) return { valid: false, error: 'Error al comprobar configuración' }

        const conf = {}
        data.forEach(r => (conf[r.clave] = r.valor))

        const prov = conf.proveedor_email || 'gmail'
        if (!conf.email_remitente)
            return { valid: false, error: '⛔ Configuracion Incompleta: Falta Email Remitente.' }
        if (prov === 'gmail') {
            const pwd = (conf.gmail_app_password || '').replace(/\s+/g, '')
            if (pwd.length !== 16)
                return { valid: false, error: '⛔ Configuracion Incompleta: Falta tu Contraseña de App Google secreta (16 letras).' }
        } else {
            if (!conf.resend_api_key)
                return { valid: false, error: '⛔ Configuracion Incompleta: Falta la API Key de Resend.' }
        }
        return { valid: true }
    }, [agencia])

    const toggleMasterSwitch = useCallback(async (newVal) => {
        setLoadingMasterSwitch(true)
        if (newVal) {
            const check = await validateEmailMotor()
            if (!check.valid) {
                showToast(check.error + ' Ve a Ajustes > Datos de Agencia.', 'error')
                setLoadingMasterSwitch(false)
                return
            }
        }

        const { error } = await supabase
            .from('configuracion')
            .upsert(
                { agencia_id: agencia.id, clave: 'master_sequence_switch', valor: newVal ? 'true' : 'false' },
                { onConflict: 'agencia_id,clave' }
            )
        if (error) {
            showToast('Error al actualizar Master Switch', 'error')
        } else {
            setMasterSwitch(newVal)
            showToast(
                `⚙️ Secuencias globales ${newVal ? 'ACTIVADAS' : 'PAUSADAS'} en toda la agencia.`,
                newVal ? 'success' : 'neutral'
            )
        }
        setLoadingMasterSwitch(false)
    }, [agencia, validateEmailMotor, showToast])

    const runDripsCycle = useCallback(async (onConfirm) => {
        if (!masterSwitch) {
            showToast('⚠️ El Motor Global está apagado. Enciéndelo primero.', 'error')
            return false
        }
        const check = await validateEmailMotor()
        if (!check.valid) {
            showToast(check.error + ' Ajusta esto en Configuración.', 'error')
            return false
        }
        // Signal to caller that validation passed — caller opens ConfirmDialog
        return true
    }, [masterSwitch, validateEmailMotor, showToast])

    const executeDripsCycle = useCallback(async () => {
        setProcesandoDrips(true)
        showToast('Iniciando ciclo manual de Autopilot...', 'info')
        try {
            const { data, error } = await supabase.functions.invoke('process-drips')
            if (error) throw error
            if (data?.errors?.length > 0) {
                showToast(
                    `⚠️ El ciclo terminó pero hubo ${data.errors.length} errores. Revisa tu contraseña de App de Gmail.`,
                    'error'
                )
            } else {
                showToast('✅ El motor procesó los drips pendientes exitosamente.', 'success')
            }
            await loadSystemStatus()
        } catch (err) {
            showToast('Hubo un error al ejecutar el ciclo: ' + err.message, 'error')
        } finally {
            setProcesandoDrips(false)
        }
    }, [loadSystemStatus, showToast])

    // ─────────────────────────────────────────────────────────────────────
    // Actions: ROAS / Inversión
    // ─────────────────────────────────────────────────────────────────────

    const saveInversion = useCallback(async ({ editingInversion, inversionForm }) => {
        const payload = { ...inversionForm, agencia_id: agencia.id }
        if (editingInversion) {
            const { error } = await supabase
                .from('inversion_marketing')
                .update(payload)
                .eq('id', editingInversion.id)
            if (error) throw error
            showToast('Inversión actualizada')
        } else {
            const { error } = await supabase
                .from('inversion_marketing')
                .insert([payload])
            if (error) throw error
            showToast('Inversión registrada')
        }
        await loadRoasData()
    }, [agencia, loadRoasData, showToast])

    const deleteInversion = useCallback(async (id) => {
        const { error } = await supabase.from('inversion_marketing').delete().eq('id', id)
        if (error) showToast('Error al eliminar', 'error')
        else { showToast('Eliminado'); await loadRoasData() }
    }, [loadRoasData, showToast])

    return {
        // State — Secuencias
        secuencias, loadingSecs,
        plantillasEmail, plantillasWA, metaForms,
        // State — Motor
        masterSwitch, loadingMasterSwitch,
        cronStatus, autoEnrollCount, procesandoDrips,
        // State — ROAS
        roasData, loadingRoas,
        // Toast
        toastMsg,
        showToast,
        // Actions
        saveSecuencia,
        deleteSecuencia,
        toggleMasterSwitch,
        runDripsCycle,
        executeDripsCycle,
        saveInversion,
        deleteInversion,
    }
}
