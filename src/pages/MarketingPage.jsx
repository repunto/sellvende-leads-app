import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/leads/modals/ConfirmModal'
import PlantillasTab from './configuracion/tabs/PlantillasTab'
import PlantillasWhatsAppTab from './configuracion/tabs/PlantillasWhatsAppTab'
const TIPOS_LABELS = {
    lead_primer_contacto: '1. Primer Contacto',
    lead_seguimiento: '2. Seguimiento',
    lead_reenganche: '3. Re-enganche',
    cotizacion: '1. Cotización',
    confirmacion: '2. Confirmación',
    recordatorio: '3. Recordatorio',
    resena: '4. Reseña'
}

export default function MarketingPage() {
    const { agencia } = useAuth()
    const [activeTab, setActiveTab] = useState('secuencias')
    
    // Tab 1: Secuencias
    const [secuencias, setSecuencias] = useState([])
    const [loadingSecs, setLoadingSecs] = useState(true)
    const [showSecuenciaForm, setShowSecuenciaForm] = useState(false)
    const [editingSecuencia, setEditingSecuencia] = useState(null)
    const [secuenciaForm, setSecuenciaForm] = useState({ nombre: '', descripcion: '', activa: true, producto_match: '' })

    const [pasos, setPasos] = useState([])
    const [plantillasEmail, setPlantillasEmail] = useState([])
    const [plantillasWA, setPlantillasWA] = useState([])
    const [metaForms, setMetaForms] = useState([])

    // Tab 2: Dashboard ROAS
    const [roasData, setRoasData] = useState([])
    const [loadingRoas, setLoadingRoas] = useState(false)
    const [showInversionForm, setShowInversionForm] = useState(false)
    const [inversionForm, setInversionForm] = useState({ campana_origen: 'Meta Ads', mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), gasto_usd: 0 })
    const [editingInversion, setEditingInversion] = useState(null)

    // Master Switch
    const [masterSwitch, setMasterSwitch] = useState(false)
    const [loadingMasterSwitch, setLoadingMasterSwitch] = useState(false);
    const [cronStatus, setCronStatus] = useState(null) // null | 'active' | 'inactive'
    const [autoEnrollCount, setAutoEnrollCount] = useState(null)

    // Manual Drips Trigger
    const [procesandoDrips, setProcesandoDrips] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null)

    const [toastMsg, setToastMsg] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 4000)
    }

    useEffect(() => {
        if (!agencia) return
        loadSecuencias()
        loadPlantillas()
        loadRoasData()
        loadMasterSwitch()
        loadSystemStatus()
        loadMetaForms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencia])

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showSecuenciaForm) {
                setShowSecuenciaForm(false);
                setEditingSecuencia(null);
                setSecuenciaForm({ nombre: '', descripcion: '', activa: true, producto_match: '' });
                setPasos([]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSecuenciaForm]);

    async function loadMetaForms() {
        const { data } = await supabase.from('leads')
            .select('form_name, producto_interes')
            .eq('agencia_id', agencia.id)
            .or('form_name.not.is.null,producto_interes.not.is.null');
            
        if (data && data.length > 0) {
            // Normalize: strip date suffixes like "Inka Jungle - 21/02/26" → "Inka Jungle"
            const stripDateSuffix = (name) => {
                if (!name) return null
                return name
                    .replace(/\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, '')
                    .replace(/\s*[-–]\s*\d{4}[-/]\d{1,2}([-/]\d{1,2})?\s*$/i, '')
                    .replace(/\s*[-–]\s*[A-Za-z]+\s+\d{4}\s*$/i, '')
                    .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/i, '')
                    .trim()
            }
            const unique = [...new Set(
                data.flatMap(d => [stripDateSuffix(d.form_name), stripDateSuffix(d.producto_interes)]).filter(Boolean)
            )].sort();
            setMetaForms(unique);
        }
    }

    async function loadSystemStatus() {
        // Check if cron job exists
        const { data: cronData } = await supabase
            .rpc('check_cron_job_exists', { job_name: 'autopilot-drips-daily' })
            .maybeSingle()
        setCronStatus(cronData === true ? 'active' : 'inactive')

        // Count leads auto-enrolled today
        const today = new Date().toISOString().split('T')[0]
        const { count } = await supabase
            .from('leads_secuencias')
            .select('id', { count: 'exact', head: true })
            .eq('agencia_id', agencia.id)
            .gte('created_at', today)
        setAutoEnrollCount(count || 0)
    }

    async function loadSecuencias() {
        setLoadingSecs(true)
        const { data, error } = await supabase
            .from('secuencias_marketing')
            .select(`
                *,
                pasos:pasos_secuencia(*)
            `)
            .eq('agencia_id', agencia.id)
            .order('created_at', { ascending: false })

        if (!error) setSecuencias(data || [])
        setLoadingSecs(false)
    }

    async function loadPlantillas() {
        const [em, wa] = await Promise.all([
            supabase.from('plantillas_email').select('id, tipo, idioma, asunto, nombre, origen').eq('agencia_id', agencia.id),
            supabase.from('plantillas_whatsapp').select('id, tipo, idioma, contenido, nombre, origen').eq('agencia_id', agencia.id)
        ])
        if (!em.error) setPlantillasEmail(em.data || [])
        if (!wa.error) setPlantillasWA(wa.data || [])
    }

    async function loadMasterSwitch() {
        const { data } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('agencia_id', agencia.id)
            .eq('clave', 'master_sequence_switch')
            .maybeSingle();
        setMasterSwitch(data?.valor === 'true');
    }

    async function validateEmailMotor() {
        const { data, error } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .eq('agencia_id', agencia.id)
            .in('clave', ['proveedor_email', 'gmail_app_password', 'resend_api_key', 'email_remitente']);
            
        if (error || !data) return { valid: false, error: 'Error al comprobar configuración' };
        
        const conf = {};
        data.forEach(r => conf[r.clave] = r.valor);
        
        const prov = conf.proveedor_email || 'gmail';
        if (!conf.email_remitente) return { valid: false, error: '⛔ Configuracion Incompleta: Falta Email Remitente.' };
        
        if (prov === 'gmail') {
            const pwd = (conf.gmail_app_password || '').replace(/\s+/g, '');
            if (pwd.length !== 16) return { valid: false, error: '⛔ Configuracion Incompleta: Falta tu Contraseña de App Google secreta (16 letras).' };
        } else {
            if (!conf.resend_api_key) return { valid: false, error: '⛔ Configuracion Incompleta: Falta la API Key de Resend.' };
        }
        
        return { valid: true };
    }

    async function toggleMasterSwitch(newVal) {
        if (newVal) {
            setLoadingMasterSwitch(true);
            const check = await validateEmailMotor();
            if (!check.valid) {
                setLoadingMasterSwitch(false);
                showToast(check.error + ' Ve a Ajustes > Datos de Agencia.', 'error');
                return;
            }
        } else {
            setLoadingMasterSwitch(true);
        }

        const { error } = await supabase
            .from('configuracion')
            .upsert({
                agencia_id: agencia.id,
                clave: 'master_sequence_switch',
                valor: newVal ? 'true' : 'false'
            }, { onConflict: 'agencia_id,clave' });
        
        if (error) {
            showToast('Error al actualizar Master Switch', 'error');
            setLoadingMasterSwitch(false);
        } else {
            setMasterSwitch(newVal);
            showToast(`⚙️ Secuencias globales ${newVal ? 'ACTIVADAS' : 'PAUSADAS'} en toda la agencia.`, newVal ? 'success' : 'neutral');
            setLoadingMasterSwitch(false);
        }
    }

    async function processDrips() {
        if (!masterSwitch) {
            showToast('⚠️ El Motor Global está apagado. Enciéndelo primero.', 'error');
            return;
        }
        const check = await validateEmailMotor();
        if (!check.valid) {
            showToast(check.error + ' Ajusta esto en Configuración.', 'error');
            return;
        }

        setConfirmDialog({
            title: '🚀 Ejecutar Ciclo Manual',
            message: 'Esto procesará AHORA MISMO todos los correos pendientes en las secuencias activas. Los leads que tengan un paso listo lo recibirán de inmediato.',
            danger: false,
            confirmLabel: '🚀 Ejecutar Ciclo',
            onConfirm: async () => {
                setConfirmDialog(null)
                setProcesandoDrips(true);
                showToast('Iniciando ciclo manual de Autopilot...', 'info');
                try {
                    const { data, error } = await supabase.functions.invoke('process-drips');
                    if (error) throw error;
                    
                    if (data?.errors?.length > 0) {
                        showToast(`⚠️ El ciclo terminó pero hubo ${data.errors.length} errores. Revisa que tu contraseña de App de Gmail sea correcta.`, 'error');
                        console.error('Errores del Motor Drips:', data.errors);
                    } else {
                        showToast('✅ El motor procesó los drips pendientes exitosamente sin errores.', 'success');
                    }
                    loadSystemStatus()
                } catch (error) {
                    console.error('Error ejecutando ciclo manual:', error);
                    showToast('Hubo un error al ejecutar el ciclo: ' + error.message, 'error');
                } finally {
                    setProcesandoDrips(false);
                }
            }
        })
    }

    function openForm(secuencia = null) {
        if (secuencia) {
            setEditingSecuencia(secuencia)
            setSecuenciaForm({ nombre: secuencia.nombre, descripcion: secuencia.descripcion || '', activa: secuencia.activa, producto_match: secuencia.producto_match || secuencia.nombre || '' })
            setPasos(secuencia.pasos?.sort((a,b) => a.dia_envio - b.dia_envio) || [])
        } else {
            setEditingSecuencia(null)
            setSecuenciaForm({ nombre: '', descripcion: '', activa: true, producto_match: '' })
            setPasos([])
        }
        setShowSecuenciaForm(true)
    }

    async function handleSaveSecuencia(e) {
        e.preventDefault()
        try {
            const payload = { ...secuenciaForm, agencia_id: agencia.id, nombre: secuenciaForm.producto_match || 'Secuencia' }
            let secId = null

            if (editingSecuencia) {
                const { error } = await supabase.from('secuencias_marketing').update(payload).eq('id', editingSecuencia.id)
                if (error) throw error
                secId = editingSecuencia.id
                showToast('Secuencia actualizada')
            } else {
                const { data, error } = await supabase.from('secuencias_marketing').insert([payload]).select().single()
                if (error) throw error
                secId = data.id
                showToast('Secuencia creada')
            }

            // Guardar pasos
            // 1. Borrar anteriores
            if (editingSecuencia) {
                await supabase.from('pasos_secuencia').delete().eq('secuencia_id', secId)
            }
            // 2. Insertar nuevos
            if (pasos.length > 0) {
                const pasosPayload = pasos.map(p => ({
                    secuencia_id: secId,
                    dia_envio: p.dia_envio,
                    plantilla_email_id: p.plantilla_email_id || null,
                    plantilla_whatsapp_id: p.plantilla_whatsapp_id || null
                }))
                const { error: errPasos } = await supabase.from('pasos_secuencia').insert(pasosPayload)
                if (errPasos) throw errPasos
            }

            setShowSecuenciaForm(false)
            loadSecuencias()
        } catch (error) {
            console.error(error)
            showToast('Error: ' + error.message, 'error')
        }
    }

    async function handleDeleteSecuencia(id) {
        setConfirmDialog({
            title: 'Eliminar Secuencia',
            message: '¿Eliminar esta secuencia? Todos los leads activos en ella serán detenidos y no recibirán más correos.',
            danger: true,
            confirmLabel: '🗑️ Eliminar Secuencia',
            onConfirm: async () => {
                setConfirmDialog(null)
                try {
                    await supabase.from('secuencias_marketing').delete().eq('id', id)
                    showToast('Secuencia eliminada')
                    loadSecuencias()
                } catch (error) {
                    console.error(error)
                    showToast('Error al eliminar', 'error')
                }
            }
        })
    }

    function addPaso() {
        // Encontrar siguiente día base
        const lastPaso = pasos.length > 0 ? pasos[pasos.length - 1] : null
        const nextDay = lastPaso ? lastPaso.dia_envio + 2 : 1
        setPasos([...pasos, { dia_envio: nextDay, plantilla_email_id: '', plantilla_whatsapp_id: '' }])
    }

    function updatePaso(index, field, value) {
        const newPasos = [...pasos]
        newPasos[index][field] = value
        setPasos(newPasos)
    }

    function removePaso(index) {
        const newPasos = [...pasos]
        newPasos.splice(index, 1)
        setPasos(newPasos)
    }

    // --- ROAS Logic ---
    async function loadRoasData() {
        setLoadingRoas(true)
        const [invResp, leadsResp, resResp] = await Promise.all([
            supabase.from('inversion_marketing').select('*').eq('agencia_id', agencia.id).order('anio', { ascending: false }).order('mes', { ascending: false }),
            supabase.from('leads').select('id, origen, campaign_name, created_at').eq('agencia_id', agencia.id),
            supabase.from('ventas').select('id, lead_id, precio_venta, estado').eq('agencia_id', agencia.id).in('estado', ['confirmada', 'completada', 'pagada'])
        ])

        const inv = invResp.data || []
        const leads = leadsResp.data || []
        const res = resResp.data || []

        const computed = inv.map(i => {
            const leadsFromInv = leads.filter(l => {
                const dt = new Date(l.created_at)
                const isSameDate = dt.getMonth() + 1 === i.mes && dt.getFullYear() === i.anio
                const matchInv = (name) => name && i.campana_origen && name.toLowerCase().trim() === i.campana_origen.toLowerCase().trim()
                return isSameDate && (matchInv(l.campaign_name) || matchInv(l.origen))
            })
            const numLeads = leadsFromInv.length
            
            const leadIds = leadsFromInv.map(l => l.id)
            const resFromInv = res.filter(r => r.lead_id && leadIds.includes(r.lead_id))
            
            const numClientes = resFromInv.length
            const totalVenta = resFromInv.reduce((sum, r) => sum + Number(r.precio_venta || 0), 0)

            const cpl = numLeads > 0 ? (i.gasto_usd / numLeads) : 0
            const cac = numClientes > 0 ? (i.gasto_usd / numClientes) : 0
            const roas = i.gasto_usd > 0 ? (totalVenta / i.gasto_usd) : 0

            return { ...i, numLeads, numClientes, totalVenta, cpl, cac, roas }
        })

        setRoasData(computed)
        setLoadingRoas(false)
    }

    function openInversionForm(inv = null) {
        if (inv) {
            setEditingInversion(inv)
            setInversionForm({ campana_origen: inv.campana_origen, mes: inv.mes, anio: inv.anio, gasto_usd: inv.gasto_usd })
        } else {
            setEditingInversion(null)
            setInversionForm({ campana_origen: 'Meta Ads', mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), gasto_usd: 0 })
        }
        setShowInversionForm(true)
    }

    async function handleSaveInversion(e) {
        e.preventDefault()
        try {
            const payload = { ...inversionForm, agencia_id: agencia.id }
            if (editingInversion) {
                const { error } = await supabase.from('inversion_marketing').update(payload).eq('id', editingInversion.id)
                if (error) throw error
                showToast('Inversión actualizada')
            } else {
                const { error } = await supabase.from('inversion_marketing').insert([payload])
                if (error) throw error
                showToast('Inversión registrada')
            }
            setShowInversionForm(false)
            loadRoasData()
        } catch (error) {
            showToast('Error: ' + error.message, 'error')
        }
    }

    async function handleDeleteInversion(id) {
        setConfirmDialog({
            title: 'Eliminar Registro Financiero',
            message: '¿Eliminar este registro de inversión? Los cálculos de ROAS se actualizarán.',
            danger: true,
            confirmLabel: '🗑️ Eliminar',
            onConfirm: async () => {
                setConfirmDialog(null)
                const { error } = await supabase.from('inversion_marketing').delete().eq('id', id)
                if (error) showToast('Error al eliminar', 'error')
                else { showToast('Eliminado'); loadRoasData() }
            }
        })
    }

    // If producto_match is set, filter templates by matching origen.
    // If empty (General sequence), show ALL templates so steps can be configured.
    const filteredEmail = secuenciaForm.producto_match
        ? plantillasEmail.filter(t => t.origen === secuenciaForm.producto_match || !t.origen)
        : plantillasEmail;
    const filteredWA = secuenciaForm.producto_match
        ? plantillasWA.filter(t => t.origen === secuenciaForm.producto_match || !t.origen)
        : plantillasWA;

    return (
        <>
        <div className="page-container">
            {toastMsg && (
                <div className={`toast toast-${toastMsg.type}`}>
                    {toastMsg.msg}
                </div>
            )}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Módulo de Marketing y ROI</h1>
                    <p className="page-subtitle">Automatización de ventas y análisis financiero de campañas (ROAS)</p>
                </div>
            </div>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'secuencias' ? 'active' : ''}`}
                    onClick={() => setActiveTab('secuencias')}
                >
                    📫 Secuencias de Emails (Drips)
                </button>
                <button
                    className={`tab ${activeTab === 'plantillas_email' ? 'active' : ''}`}
                    onClick={() => setActiveTab('plantillas_email')}
                >
                    ✉️ Plantillas Email
                </button>
                <button
                    className={`tab ${activeTab === 'plantillas_wa' ? 'active' : ''}`}
                    onClick={() => setActiveTab('plantillas_wa')}
                >
                    📲 Plantillas WhatsApp
                </button>
                <button
                    className={`tab ${activeTab === 'roas' ? 'active' : ''}`}
                    onClick={() => setActiveTab('roas')}
                >
                    📈 Dashboard ROAS
                </button>
            </div>

            {activeTab === 'secuencias' && (
                showSecuenciaForm ? (
                    <div className="card" style={{ padding: '24px 32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{editingSecuencia ? 'Editar Secuencia' : 'Nueva Secuencia'}</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Configura el embudo automático para tus leads.</p>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => {
                                    setShowSecuenciaForm(false);
                                    setEditingSecuencia(null);
                                    setSecuenciaForm({ nombre: '', descripcion: '', activa: true, producto_match: '' });
                                    setPasos([]);
                                }} style={{ padding: '8px 16px', borderRadius: 10, fontWeight: 600 }}>Cancelar</button>
                                <button type="submit" form="secForm" className="btn btn-primary" style={{ padding: '8px 24px', borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px rgba(250, 114, 55, 0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>💾</span> Guardar Secuencia
                                </button>
                            </div>
                        </div>

                        <form id="secForm" onSubmit={handleSaveSecuencia}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 32, alignItems: 'start' }}>
                                {/* PANEL IZQ: AJUSTES */}
                                <div style={{ background: 'var(--color-bg-hover)', padding: 20, borderRadius: 16, border: '1px solid var(--color-border)' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        <span style={{ fontSize: '1.1rem' }}>⚙️</span> Parámetros
                                    </h3>
                                    
                                    <div className="form-group" style={{ marginBottom: 16 }}>
                                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                            Formulario Origen
                                            <span style={{ fontSize: '0.65rem', background: 'rgba(250,114,55,0.15)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 4 }}>Meta Ads</span>
                                        </label>
                                        {metaForms.length === 0 ? (
                                            <div style={{ padding: '10px', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-secondary)', background: 'var(--color-bg)' }}>Sin formularios sincronizados.</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    className="form-control"
                                                    value={secuenciaForm.producto_match}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setSecuenciaForm({ ...secuenciaForm, producto_match: val, nombre: val });
                                                        // Auto-add first step if none exist when a form is explicitly chosen
                                                        if (val && pasos.length === 0) {
                                                            setPasos([{ dia_envio: 1, plantilla_email_id: '', plantilla_whatsapp_id: '' }]);
                                                        }
                                                    }}
                                                    required
                                                    style={{ fontSize: '0.85rem', padding: '10px 12px', width: '100%', appearance: 'none', background: 'var(--color-bg)', border: '2px solid var(--color-border)', borderRadius: 10, outline: 'none', color: 'var(--color-text)' }}
                                                >
                                                    <option value="" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>-- Seleccionar --</option>
                                                    {metaForms.map(f => <option key={f} value={f} style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>{f}</option>)}
                                                </select>
                                                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.7rem' }}>▼</div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="form-group" style={{ marginBottom: 20 }}>
                                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Descripción (Extra)</label>
                                        <textarea
                                            className="form-control"
                                            value={secuenciaForm.descripcion}
                                            onChange={(e) => setSecuenciaForm({ ...secuenciaForm, descripcion: e.target.value })}
                                            placeholder="Detalla el objetivo..."
                                            style={{ fontSize: '0.85rem', padding: '10px', minHeight: 70, resize: 'none', borderRadius: 10, width: '100%', border: '2px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        />
                                    </div>

                                    <div style={{ background: secuenciaForm.activa ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)', padding: '12px 16px', borderRadius: 12, border: `1px solid ${secuenciaForm.activa ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSecuenciaForm({ ...secuenciaForm, activa: !secuenciaForm.activa })}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: secuenciaForm.activa ? '#059669' : 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{secuenciaForm.activa ? '🟢 Operando' : '⏸️ Pausada'}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{secuenciaForm.activa ? 'Envío Activo' : 'Borrador'}</div>
                                        </div>
                                        <div style={{ position: 'relative', width: 40, height: 22, borderRadius: 11, background: secuenciaForm.activa ? '#10b981' : 'var(--color-border)', transition: '0.3s' }}>
                                            <div style={{ position: 'absolute', top: 2, left: secuenciaForm.activa ? 20 : 2, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* PANEL DER: PASOS */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Arquitectura de Pasos</h3>
                                        </div>
                                        <button type="button" className="btn btn-ghost" onClick={addPaso} style={{ color: 'var(--color-primary)', fontWeight: 700, padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', background: 'rgba(250,114,55,0.05)' }}>+ Añadir Paso</button>
                                    </div>

                                    <div style={{ background: 'var(--color-bg)', padding: '20px 0 0 0', borderRadius: 16 }}>
                                        {pasos.length === 0 ? (
                                            <div className="elite-empty-state" style={{ padding: '30px 20px', border: '1px dashed var(--color-border)', borderRadius: 16 }}>
                                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🛤️</div>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px 0' }}>Flujo Vacío</h4>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>Añade el primer punto de contacto.</p>
                                                <button type="button" className="btn btn-primary" onClick={addPaso} style={{ borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: '0.85rem' }}>+ Añadir Mensaje</button>
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative', paddingLeft: 30 }}>
                                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 12, width: 2, background: 'var(--color-border)', borderRadius: 10 }}></div>
                                                
                                                <div style={{ position: 'relative', marginBottom: 20 }}>
                                                    <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '2px solid var(--color-bg)', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)' }}></div>
                                                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '6px 14px', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                                        <span>⚡</span> Entrada del Lead (Día 1)
                                                    </div>
                                                </div>

                                                {pasos.map((p, idx) => {
                                                    const prevDia = idx === 0 ? 0 : pasos[idx-1].dia_envio;
                                                    return (
                                                    <div key={idx} style={{ position: 'relative', marginBottom: 20 }}>
                                                        <div style={{ position: 'absolute', left: -22, top: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', boxShadow: '0 0 0 3px var(--color-bg)', zIndex: 2 }}></div>
                                                        
                                                        <div className="elite-wait-node" style={{ padding: '0px 10px', fontSize: '0.75rem', top: -14, left: -2, border: 'none', background: 'transparent' }}>
                                                            <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>Día:</span>
                                                            <input type="number" min={prevDia} max="365" value={p.dia_envio} onChange={(e) => updatePaso(idx, 'dia_envio', parseInt(e.target.value))} required style={{ width: 30, padding: 0, textAlign: 'center', fontWeight: 800, border: 'none', background: 'transparent', color: 'var(--color-primary)', outline: 'none', fontSize: '0.85rem', marginLeft: 4 }} />
                                                        </div>

                                                        <div className="elite-node-card" style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                                            <button type="button" onClick={() => removePaso(idx)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem' }} title="Eliminar paso">✕</button>
                                                            
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingRight: 20 }}>
                                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)', marginBottom: 6 }}>
                                                                        <span style={{ fontSize: '0.9rem' }}>📧</span> Enviar Email
                                                                    </label>
                                                                    {filteredEmail.length === 0 ? (
                                                                        <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>Sin Plantillas Disponibles</div>
                                                                    ) : (
                                                                        <div style={{ position: 'relative' }}>
                                                                            <select className="form-control" value={p.plantilla_email_id || ''} onChange={(e) => updatePaso(idx, 'plantilla_email_id', e.target.value)} style={{ padding: '8px 10px', fontWeight: 600, appearance: 'none', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, width: '100%', fontSize: '0.75rem', color: p.plantilla_email_id ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                                                                <option value="" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>-- Correo --</option>
                                                                                {filteredEmail.map(tpl => (
                                                                                    <option key={tpl.id} value={tpl.id} style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>[{TIPOS_LABELS[tpl.tipo] || tpl.tipo}] {tpl.nombre}</option>
                                                                                ))}
                                                                            </select>
                                                                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)', fontSize: '0.6rem' }}>▼</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)', marginBottom: 6 }}>
                                                                        <span style={{ display: 'flex', alignItems: 'center' }}><svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></span>
                                                                        WhatsApp
                                                                    </label>
                                                                    {filteredWA.length === 0 ? (
                                                                        <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>Sin Mensajes Disponibles</div>
                                                                    ) : (
                                                                        <div style={{ position: 'relative' }}>
                                                                            <select className="form-control" value={p.plantilla_whatsapp_id || ''} onChange={(e) => updatePaso(idx, 'plantilla_whatsapp_id', e.target.value)} style={{ padding: '8px 10px', fontWeight: 600, appearance: 'none', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, width: '100%', fontSize: '0.75rem', color: p.plantilla_whatsapp_id ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                                                                <option value="" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>-- Mensaje --</option>
                                                                                {filteredWA.map(tpl => (
                                                                                    <option key={tpl.id} value={tpl.id} style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>[{TIPOS_LABELS[tpl.tipo] || tpl.tipo}] {tpl.nombre}</option>
                                                                                ))}
                                                                            </select>
                                                                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)', fontSize: '0.6rem' }}>▼</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )})}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    Autopilot Sequence Hub
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: masterSwitch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '6px 14px', borderRadius: 20, border: `1px solid ${masterSwitch ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: masterSwitch ? '#10b981' : '#ef4444', boxShadow: `0 0 8px ${masterSwitch ? '#10b981' : '#ef4444'}` }}></div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: masterSwitch ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                                            {masterSwitch ? 'Motor Encendido' : 'Motor Apagado'}
                                        </span>
                                    </div>
                                </h2>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem', marginTop: 8 }}>Gestiona tus campañas de goteo (Drip) para mantener a tus leads comprometidos de forma 100% orgánica.</p>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <button className="btn" style={{ background: masterSwitch ? 'var(--color-bg-elevated)' : '#ef4444', border: '1px solid var(--color-border)', color: masterSwitch ? 'var(--color-text)' : 'white', boxShadow: 'var(--shadow-sm)' }} onClick={() => toggleMasterSwitch(!masterSwitch)} disabled={loadingMasterSwitch}>
                                    {loadingMasterSwitch ? '⏳ Guardando...' : masterSwitch ? '⏸️ Pausar Todo el Motor' : '▶️ Encender Motor'}
                                </button>
                                <button className="btn" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', boxShadow: 'var(--shadow-sm)' }} onClick={processDrips} disabled={procesandoDrips}>
                                    {procesandoDrips ? '⏳ Procesando...' : '🚀 Ejecutar Ciclo Manual'}
                                </button>
                                <button className="btn btn-primary" onClick={() => openForm(null)} style={{ boxShadow: 'var(--shadow-primary-soft)' }}>+ Crear Nueva Secuencia</button>
                            </div>
                        </div>

                        {/* ── Sistema Status Panel ── */}
                        {masterSwitch ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                                {/* Cron Job */}
                                <div style={{
                                    background: cronStatus === 'active' ? 'rgba(16,185,129,0.06)' : 'rgba(251,191,36,0.08)',
                                    border: `1px solid ${cronStatus === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(251,191,36,0.3)'}`,
                                    borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start'
                                }}>
                                    <div style={{ fontSize: '1.8rem', marginTop: 2 }}>{cronStatus === 'active' ? '⏰' : '⚙️'}</div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: cronStatus === 'active' ? '#10b981' : '#f59e0b', marginBottom: 4 }}>
                                            {cronStatus === 'active' ? 'Cron Diario Activo' : 'Cron No Configurado'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                            {cronStatus === 'active'
                                                ? `Próxima ejecución: hoy a las ${new Date().getUTCHours() < 8 ? '08:00 UTC' : 'mañana 08:00 UTC'}`
                                                : 'Ejecuta el SQL de configuración para activar el horario automático'}
                                        </div>
                                    </div>
                                </div>

                                {/* Auto-enrolados hoy */}
                                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: '1.8rem', marginTop: 2 }}>⚡</div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#3b82f6', marginBottom: 4 }}>Auto-enrolados hoy</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-text)' }}>
                                            {autoEnrollCount ?? '...'}
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginLeft: 6 }}>leads</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estado motor */}
                                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: '1.8rem', marginTop: 2 }}>🤖</div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#10b981', marginBottom: 4 }}>Autopilot Activo</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                            Leads nuevos se enrolan solos · Correos se envían según calendario
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed #ef4444', padding: '16px 20px', borderRadius: 12, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ fontSize: '2rem' }}>⚠️</div>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ef4444', fontWeight: 800 }}>Motor de Automatización Global Apagado</h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Ningún correo automático será enviado. Enciende el motor con el botón de arriba para reanudar las secuencias activas.</p>
                                </div>
                            </div>
                        )}

                        {loadingSecs ? (
                            <div style={{ padding: '80px 0', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto 16px auto', borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }}></div>
                                <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Sincronizando Autopilot...</p>
                            </div>
                        ) : secuencias.length === 0 ? (
                            <div className="elite-empty-state">
                                <div style={{ fontSize: '3.5rem', marginBottom: 20, textShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>🛩️</div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>Tu Autopilot está inactivo</h3>
                                <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', maxWidth: '450px', margin: '0 auto 30px auto', lineHeight: 1.6 }}>
                                    Las secuencias te permiten vender mientras duermes. Crea tu primera campaña para automatizar el seguimiento de tus leads.
                                </p>
                            </div>
                        ) : (
                            <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                                <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: '0 12px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '0 20px', letterSpacing: '0.5px' }}>Identidad de Secuencia</th>
                                            <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '0 20px', letterSpacing: '0.5px' }}>Arquitectura</th>
                                            <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '0 20px', letterSpacing: '0.5px' }}>Estado</th>
                                            <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '0 20px', textAlign: 'right', letterSpacing: '0.5px' }}>Gestión</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {secuencias.map(s => (
                                            <tr key={s.id} className="elite-table-row">
                                                <td style={{ padding: '24px 20px', border: 'none', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }}>
                                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)', marginBottom: 6 }}>{s.nombre}</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                        {s.producto_match ? s.producto_match.split(',').map((tag, i) => (
                                                            <span key={i} style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--color-primary-soft)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                                                                📋 {tag.trim()}
                                                            </span>
                                                        )) : (
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', italic: 'true' }}>General (aplica a todos los formularios)</span>
                                                        )}
                                                    </div>
                                                    {s.descripcion && <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 500, lineHeight: 1.4, maxWidth: 350 }}>{s.descripcion}</div>}
                                                </td>
                                                <td style={{ padding: '24px 20px', border: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--color-bg)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                                        <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{s.pasos?.length || 0} Pasos programados</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '24px 20px', border: 'none' }}>
                                                    <span className={`elite-badge ${s.activa ? 'elite-badge-success' : 'elite-badge-neutral'}`}>
                                                        {s.activa ? '🟢 Activa / Operando' : '⏸️ Pausada'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '24px 20px', textAlign: 'right', border: 'none', borderTopRightRadius: 16, borderBottomRightRadius: 16 }}>
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                        <button className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => openForm(s)}>✏️ Ver / Editar</button>
                                                        <button className="btn btn-ghost" style={{ padding: '8px 12px', color: 'var(--color-danger)' }} onClick={() => handleDeleteSecuencia(s.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                )
            )}

            {activeTab === 'roas' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Dashboard ROAS — Inteligencia de Mercado</h2>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem' }}>Monitorea el rendimiento de tu inversión publicitaria y el costo de adquisición por cliente en tiempo real.</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => openInversionForm(null)} style={{ boxShadow: 'var(--shadow-primary-soft)' }}>+ Registrar Gasto Publicitario</button>
                    </div>

                    {/* Elite Metrics Summary Bar */}
                    {!loadingRoas && roasData.length > 0 && (
                        <div className="kpi-grid" style={{ marginBottom: 30 }}>
                            <div className="kpi-card">
                                <div className="kpi-card-label">Total Inversión</div>
                                <div className="kpi-card-value">${roasData.reduce((acc, curr) => acc + curr.gasto_usd, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-card-label">Total Leads</div>
                                <div className="kpi-card-value">{roasData.reduce((acc, curr) => acc + curr.numLeads, 0)}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-card-label">Costo Adquisición (CAC)</div>
                                <div className="kpi-card-value">
                                    ${(roasData.reduce((acc, curr) => acc + curr.gasto_usd, 0) / (roasData.reduce((acc, curr) => acc + curr.numClientes, 0) || 1)).toFixed(2)}
                                </div>
                            </div>
                            <div className="kpi-card" style={{ borderBottom: '3px solid var(--color-success)' }}>
                                <div className="kpi-card-label">ROAS Promedio</div>
                                <div className="kpi-card-value" style={{ color: 'var(--color-success)' }}>
                                    {(roasData.reduce((acc, curr) => acc + curr.totalVenta, 0) / (roasData.reduce((acc, curr) => acc + curr.gasto_usd, 0) || 1)).toFixed(2)}x
                                </div>
                            </div>
                        </div>
                    )}

                    {showInversionForm && (
                        <div className="card" style={{ marginBottom: 30, padding: 24, border: '1px solid var(--color-primary-soft)', borderLeft: '4px solid var(--color-primary)' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>{editingInversion ? 'Editar Registro de Gasto' : 'Registrar Nueva Inversión en Pauta'}</h3>
                            <form onSubmit={handleSaveInversion} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, alignItems: 'end' }}>
                                <div className="form-group">
                                    <label className="form-label">Origen / Campaña</label>
                                    <input type="text" className="form-control" value={inversionForm.campana_origen} onChange={(e) => setInversionForm({ ...inversionForm, campana_origen: e.target.value })} required placeholder="Ej: Meta Ads - Machu Picchu" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mes</label>
                                    <select className="form-control" value={inversionForm.mes} onChange={(e) => setInversionForm({ ...inversionForm, mes: parseInt(e.target.value) })} required>
                                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{new Date(2022, m-1).toLocaleString('es-ES', {month: 'long'})}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Año</label>
                                    <input type="number" min="2020" max="2035" className="form-control" value={inversionForm.anio} onChange={(e) => setInversionForm({ ...inversionForm, anio: parseInt(e.target.value) })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Presupuesto USD</label>
                                    <input type="number" step="0.01" min="0" className="form-control" value={inversionForm.gasto_usd} onChange={(e) => setInversionForm({ ...inversionForm, gasto_usd: parseFloat(e.target.value) })} required style={{ fontWeight: 700 }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowInversionForm(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px' }}>Guardar Cambios</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {loadingRoas ? (
                        <div style={{ padding: 60, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>🔄</div>
                            <p style={{ color: 'var(--color-text-secondary)' }}>Calculando rentabilidad cruzando datos de pauta y ventas...</p>
                        </div>
                    ) : roasData.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">⚖️</div>
                            <div className="empty-state-text">Sin Datos de Inversión</div>
                            <div className="empty-state-sub">Agrega tus gastos de Meta Ads o Google Ads para ver el retorno real de tu dinero.</div>
                        </div>
                    ) : (
                        <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                            <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: '0 12px' }}>
                                <thead style={{ background: 'transparent' }}>
                                    <tr>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '0 20px', letterSpacing: '0.5px' }}>Periodo</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Fuente</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Inversión</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Leads</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Ventas</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>CPL</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>CAC</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Ingresos</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>ROAS</th>
                                        <th style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roasData.map((r, idx) => (
                                        <tr key={idx} className="elite-table-row">
                                            <td style={{ padding: '24px 20px', fontWeight: 600, border: 'none', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, color: 'var(--color-text)' }}>
                                                {new Date(r.anio, r.mes-1).toLocaleString('es-ES', {month: 'short'})} {r.anio}
                                            </td>
                                            <td style={{ padding: '24px 20px', border: 'none' }}>
                                                <span style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                                    {r.campana_origen}
                                                </span>
                                            </td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', fontWeight: 700, color: '#ef4444', border: 'none' }}>
                                                ${r.gasto_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', fontWeight: 500, color: 'var(--color-text)', border: 'none' }}>{r.numLeads}</td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', fontWeight: 700, border: 'none', color: 'var(--color-primary)' }}>{r.numClientes}</td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--color-text-secondary)', border: 'none' }}>${r.cpl.toFixed(2)}</td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--color-text-secondary)', border: 'none' }}>${r.cac.toFixed(2)}</td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', fontWeight: 800, color: '#10b981', border: 'none' }}>
                                                ${r.totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '24px 20px', textAlign: 'center', border: 'none' }}>
                                                <div style={{
                                                    display: 'inline-block',
                                                    padding: '6px 14px',
                                                    borderRadius: 20,
                                                    fontSize: '0.9rem',
                                                    fontWeight: 900,
                                                    background: r.roas >= 5 ? 'rgba(16, 185, 129, 0.2)' : r.roas >= 2.5 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                    color: r.roas >= 5 ? '#059669' : r.roas >= 2.5 ? '#2563eb' : '#dc2626',
                                                    boxShadow: r.roas >= 5 ? '0 4px 10px rgba(16, 185, 129, 0.15)' : 'none'
                                                }}>
                                                    {r.roas.toFixed(2)}x
                                                </div>
                                            </td>
                                            <td style={{ padding: '24px 20px', textAlign: 'right', border: 'none', borderTopRightRadius: 16, borderBottomRightRadius: 16 }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openInversionForm(r)}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteInversion(r.id)}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'plantillas_email' && (
                <PlantillasTab showToast={showToast} agencia={agencia} />
            )}

            {activeTab === 'plantillas_wa' && (
                <PlantillasWhatsAppTab showToast={showToast} agencia={agencia} />
            )}

        </div>

        {/* Global Confirm Modal */}
        <ConfirmModal
            show={!!confirmDialog}
            title={confirmDialog?.title || ''}
            message={confirmDialog?.message || ''}
            danger={confirmDialog?.danger || false}
            confirmLabel={confirmDialog?.confirmLabel}
            onConfirm={confirmDialog?.onConfirm}
            onCancel={() => setConfirmDialog(null)}
        />
        </>
    )
}
