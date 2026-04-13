/**
 * useLeadEmail — Custom hook for all email-related operations.
 * Encapsulates: sendIndividualEmail, sendBulkEmail, modal state, template selection.
 * Extracted from LeadsPage.jsx (Phase 2 refactor)
 */
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { wrapEmailTemplate } from '../lib/emailTemplate'
import { formatTemporada, mesAgotado } from '../lib/leadsUtils'

// Static social proof snippets (non-sensitive, can live in frontend)
const SOCIAL_PROOF_EMAIL = {
    EN: '<div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0; border-left:4px solid #1a73e8;"><p style="margin:0; font-size:14px; color:#555;">⭐ <b>Over 1,500 happy customers trust us.</b><br>Read their real stories on <a href="{url_resenas}" style="color:#1a73e8; font-weight:bold; text-decoration:none;">our reviews page &rarr;</a></p></div>',
    ES: '<div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0; border-left:4px solid #1a73e8;"><p style="margin:0; font-size:14px; color:#555;">⭐ <b>Más de 1,500 clientes felices confían en nosotros.</b><br>Mira sus historias reales en <a href="{url_resenas}" style="color:#1a73e8; font-weight:bold; text-decoration:none;">nuestra página de reseñas &rarr;</a></p></div>',
}

/** Build personalized body and subject from raw template + lead context */
function buildEmailContent({ rawHtml, rawSubject, lead, config, agencyName, senderName, tplOrigen }) {
    const isEN = (lead.idioma || '').toUpperCase() === 'EN'
    const socialProof = isEN ? SOCIAL_PROOF_EMAIL.EN : SOCIAL_PROOF_EMAIL.ES
    const fromEmail = config['email_remitente'] || ''
    const activeProductoName = tplOrigen || lead.producto_interes || lead.form_name || 'nuestro producto'

    const body = rawHtml
        .replace(/{nombre}/gi, lead.nombre || '')
        .replace(/{producto}/gi, activeProductoName)
        .replace(/{email}/gi, fromEmail)
        .replace(/{telefono}/gi, config['telefono_agencia'] || config['whatsapp'] || '')
        .replace(/{agencia}/gi, agencyName)
        .replace(/{remitente}/gi, senderName || agencyName)
        .replace(/\{(fechaviaje|fecha_entrega)\}/gi, formatTemporada(lead.temporada))
        .replace(/{fecha}/gi, formatTemporada(lead.temporada))
        .replace(/{mesagotado}/gi, mesAgotado)
        .replace(/{social_proof}/gi, socialProof)

    const subject = rawSubject
        .replace(/{nombre}/gi, lead.nombre || '')
        .replace(/{producto}/gi, activeProductoName)
        .replace(/\{(fechaviaje|fecha_entrega)\}/gi, formatTemporada(lead.temporada))
        .replace(/{fecha}/gi, formatTemporada(lead.temporada))
        .replace(/{mesagotado}/gi, mesAgotado)
        .replace(/{agencia}/gi, agencyName)
        .replace(/{remitente}/gi, senderName || agencyName)

    return { body, subject }
}

/** Load display config from DB (credentials stay server-side) */
async function loadEmailConfig() {
    const { data: configData } = await supabase.from('configuracion').select('clave, valor')
        .in('clave', ['email_remitente', 'nombre_visible', 'nombre_remitente', 'proveedor_email',
                      'email_preheader', 'url_web', 'telefono_agencia', 'whatsapp', 'logo_url', 'color_marca'])
    const config = {}
    configData?.forEach(r => { config[r.clave] = r.valor })
    return config
}

export function useLeadEmail({
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
    clearSelection,
}) {
    // ── Modal state ──
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [showIndividualEmailModal, setShowIndividualEmailModal] = useState(false)
    const [emailSending, setEmailSending] = useState(false)
    const [emailSuccessAnim, setEmailSuccessAnim] = useState(false)
    const [emailProgress, setEmailProgress] = useState('')
    const [emailPreviewMode, setEmailPreviewMode] = useState(false)
    const [emailMode, setEmailMode] = useState('single') // 'single' | 'sequence'
    const [individualEmailLead, setIndividualEmailLead] = useState(null)
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')
    const [selectedEmailTemplate, setSelectedEmailTemplate] = useState('')
    const [selectedSequenceId, setSelectedSequenceId] = useState('')

    // ── Template auto-detection ──
    const getEmailTemplateForLead = useCallback((lead) => {
        let tipoBuscado = 'Agradecimiento / Bienvenida'
        if (lead.estado === 'contactado') tipoBuscado = 'Seguimiento'
        if (lead.estado === 'cotizado') tipoBuscado = 'Cotización'
        if (lead.estado === 'cliente') tipoBuscado = 'Itinerario / Voucher'
        const idiomaLead = lead.idioma === 'EN' ? 'EN' : 'ES'
        let template = null
        if (lead.producto_interes) {
            template = emailTemplates.find(t =>
                t.tipo === tipoBuscado && t.idioma === idiomaLead &&
                t.nombre?.toLowerCase().includes(lead.producto_interes.toLowerCase())
            )
        }
        if (!template) template = emailTemplates.find(t => t.tipo === tipoBuscado && t.idioma === idiomaLead)
        if (!template) template = emailTemplates.find(t => t.tipo === tipoBuscado)
        if (!template) template = emailTemplates[0]
        return template
    }, [emailTemplates])

    // ── Open individual email modal ──
    const handleIndividualEmailClick = useCallback((lead, preselectedTemplateId) => {
        if (!lead.email) {
            showToast('Este lead no tiene un correo electrónico registrado.', 'error')
            return
        }
        setIndividualEmailLead(lead)
        const templateObj = preselectedTemplateId
            ? emailTemplates.find(t => t.id === preselectedTemplateId)
            : getEmailTemplateForLead(lead)
        if (templateObj) {
            setSelectedEmailTemplate(templateObj.id)
            setEmailSubject(templateObj.asunto || '')
            setEmailBody(templateObj.contenido_html || '')
        } else {
            setSelectedEmailTemplate('')
            setEmailSubject('')
            setEmailBody('')
        }
        setDetailLead(null)
        setEmailMode('single')
        setSelectedSequenceId('')
        setEmailSuccessAnim(false)
        setEmailPreviewMode(false)
        setShowIndividualEmailModal(true)
    }, [emailTemplates, getEmailTemplateForLead, showToast, setDetailLead])

    // ── Close individual email modal ──
    const closeIndividualEmailModal = useCallback(() => {
        setShowIndividualEmailModal(false)
        setIndividualEmailLead(null)
        setSelectedEmailTemplate('')
        setEmailSubject('')
        setEmailBody('')
        setEmailMode('single')
        setSelectedSequenceId('')
    }, [])

    // ── Template dropdown change inside modal ──
    const handleTemplateDropdownChange = useCallback((templateId, allTemplates) => {
        setSelectedEmailTemplate(templateId)
        const t = allTemplates.find(x => x.id === templateId)
        if (t) {
            setEmailSubject(t.asunto || '')
            setEmailBody(t.contenido_html || '')
        }
    }, [])

    // ── Open bulk email modal ──
    const openEmailModal = useCallback((leads, selectedLeads) => {
        const selected = leads.filter(l => selectedLeads.has(l.id) && l.email)
        if (selected.length === 0) {
            showToast('Selecciona leads con email primero', 'error')
            return
        }
        const tpl = emailTemplates[0]
        if (tpl) {
            setSelectedEmailTemplate(tpl.id)
            setEmailSubject(tpl.asunto || '')
            setEmailBody(tpl.contenido_html || '')
        } else {
            setSelectedEmailTemplate('')
            setEmailSubject('')
            setEmailBody('')
        }
        setEmailProgress('')
        setEmailSending(false)
        setEmailSuccessAnim(false)
        setShowEmailModal(true)
    }, [emailTemplates, showToast])

    // ── Send individual email ──
    const sendIndividualEmail = useCallback(async () => {
        if (!individualEmailLead?.email) return
        if (!agencia?.id) {
            showToast('Error: No se pudo identificar la agencia. Recarga la página.', 'error')
            return
        }
        setEmailSending(true)
        try {
            const config = await loadEmailConfig()
            const fromEmail = config['email_remitente'] || ''
            const agencyName = config['nombre_visible'] || agencia?.nombre || 'Sellvende Leads'
            const senderName = config['nombre_remitente'] || agencyName

            if (!fromEmail) {
                showToast('Configura el correo remitente en Configuración → Motor de Correos.', 'error')
                setEmailSending(false)
                return
            }

            const template = emailTemplates.find(t => t.id === selectedEmailTemplate)
            const tplOrigen = template?.origen || ''

            const lead = individualEmailLead
            const { body, subject } = buildEmailContent({
                rawHtml: emailBody || '',
                rawSubject: emailSubject,
                lead, config, agencyName, senderName, tplOrigen
            })

            const { data: result, error: invokeError } = await supabase.functions.invoke('resend-email', {
                body: {
                    agencia_id: agencia.id,
                    from: `${senderName} <${fromEmail}>`,
                    to: [lead.email],
                    subject,
                    html: wrapEmailTemplate({
                        body, agencyName,
                        agencyUrl: config['url_web'] || '',
                        agencyEmail: fromEmail,
                        agencyPhone: config['telefono_agencia'] || config['whatsapp'] || '',
                        logoUrl: config['logo_url'] || '',
                        previewText: config['email_preheader'] || '',
                        primaryColor: config['color_marca'] || '#1a73e8'
                    })
                }
            })

            const edgeError = invokeError?.message || result?.error || result?.message || null
            const isSuccess = !edgeError && result?.success !== false

            await supabase.from('email_log').insert([{
                agencia_id: agencia.id,
                lead_id: lead.id,
                tipo: 'individual',
                asunto: subject,
                cuerpo: body,
                estado: isSuccess ? 'enviado' : 'fallido',
                resend_id: result?.id || result?.messageId || null
            }])

            if (isSuccess) {
                const updateFields = { ultimo_contacto: new Date().toISOString() }
                if (lead.estado === 'nuevo') updateFields.estado = 'contactado'
                await supabase.from('leads').update(updateFields).eq('id', lead.id)
                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updateFields } : l))
                showToast(`📧 Email enviado a ${lead.email}`)
                setEmailSuccessAnim(true)
                setTimeout(() => { closeIndividualEmailModal() }, 2000)
            } else {
                throw new Error(edgeError || 'Error desconocido al enviar el correo')
            }
        } catch (err) {
            console.error('sendIndividualEmail error:', err)
            showToast(`❌ ${err.message}`, 'error')
        } finally {
            setEmailSending(false)
        }
    }, [individualEmailLead, agencia, emailBody, emailSubject, setLeads, showToast, closeIndividualEmailModal])

    // ── Start drip sequence from individual email modal ──
    const startDripSequenceFromModal = useCallback(async () => {
        if (!individualEmailLead || !selectedSequenceId) return
        setEmailSending(true)
        try {
            const payload = {
                lead_id: individualEmailLead.id,
                secuencia_id: selectedSequenceId,
                estado: 'en_progreso',
                ultimo_paso_ejecutado: 0
            }

            const { error: upsertErr } = await supabase.from('leads_secuencias')
                .upsert(payload, { onConflict: 'lead_id,secuencia_id' })
            if (upsertErr) {
                await supabase.from('leads_secuencias').delete().eq('lead_id', individualEmailLead.id)
                const { error: insErr } = await supabase.from('leads_secuencias').insert([payload])
                if (insErr) throw insErr
            }

            await supabase.functions.invoke('process-drips')

            const updateFields = { ultimo_contacto: new Date().toISOString() }
            if (individualEmailLead.estado === 'nuevo') updateFields.estado = 'contactado'
            await supabase.from('leads').update(updateFields).eq('id', individualEmailLead.id)
            setLeads(prev => prev.map(l => l.id === individualEmailLead.id ? { ...l, ...updateFields } : l))

            setSequenceEnrollments(prev => ({
                ...prev,
                [individualEmailLead.id]: {
                    lead_id: individualEmailLead.id,
                    secuencia_id: selectedSequenceId,
                    estado: 'en_progreso',
                    ultimo_paso_ejecutado: 0,
                    secuencias_marketing: { nombre: secuencias.find(s => s.id === selectedSequenceId)?.nombre || 'Playbook' }
                }
            }))

            showToast('🚀 Secuencia iniciada exitosamente y primer paso procesado.')
            setEmailSuccessAnim(true)

            if (detailLead && detailLead.id === individualEmailLead.id) {
                setDetailLead({ ...detailLead, ...updateFields })
                const { data } = await supabase.from('leads_secuencias').select('*').eq('lead_id', detailLead.id).maybeSingle()
                setLeadSecuencia(data)
                const { data: logData } = await supabase.from('email_log').select('*').eq('lead_id', detailLead.id).order('created_at', { ascending: false }).limit(20)
                if (logData) setDetailEmails(logData)
            }

            setEmailCounts(prev => ({
                ...prev,
                [individualEmailLead.id]: (prev[individualEmailLead.id] || 0) + 1
            }))

            setTimeout(() => {
                closeIndividualEmailModal()
                setEmailSuccessAnim(false)
            }, 2000)
        } catch (error) {
            console.error(error)
            showToast('Error al iniciar la secuencia: ' + error.message, 'error')
        } finally {
            setEmailSending(false)
        }
    }, [
        individualEmailLead, selectedSequenceId, agencia, secuencias,
        detailLead, setLeads, setSequenceEnrollments, setEmailCounts,
        setDetailLead, setLeadSecuencia, setDetailEmails,
        showToast, closeIndividualEmailModal
    ])

    // ── Send bulk email ──
    const sendBulkEmail = useCallback(async (leads, selectedLeads) => {
        const selected = leads.filter(l => selectedLeads.has(l.id) && l.email)
        if (selected.length === 0) return

        setConfirmDialog({
            title: 'Confirmar Envío Masivo',
            message: `¿Enviar email a ${selected.length} leads seleccionados? Esta acción no se puede deshacer.`,
            danger: false,
            confirmLabel: `✉️ Enviar a ${selected.length} leads`,
            onConfirm: () => {
                setConfirmDialog(null)
                _doSendBulkEmail(selected)
            }
        })
    }, [setConfirmDialog]) // eslint-disable-line

    const _doSendBulkEmail = useCallback(async (selected) => {
        setEmailSending(true)
        setEmailProgress(`Encolando envío de ${selected.length} correos...`)

        try {
            const config = await loadEmailConfig()
            const fromEmail = config['email_remitente'] || ''
            const agencyName = config['nombre_visible'] || agencia?.nombre || 'Sellvende Leads'
            const senderName = config['nombre_remitente'] || agencyName

            if (!fromEmail) {
                showToast('Configura el correo remitente en Configuración → Motor de Correos.', 'error')
                setEmailSending(false)
                setEmailProgress('')
                return
            }

            const queueInserts = []

            for (let i = 0; i < selected.length; i++) {
                const lead = selected[i]
                const template = emailTemplates.find(t => t.id === selectedEmailTemplate)
                const tplOrigen = template?.origen || ''

                const { body, subject } = buildEmailContent({
                    rawHtml: emailBody || '',
                    rawSubject: emailSubject,
                    lead, config, agencyName, senderName, tplOrigen
                })

                const finalHtml = wrapEmailTemplate({
                    body, agencyName,
                    agencyUrl: config['url_web'] || '',
                    agencyEmail: fromEmail,
                    agencyPhone: config['telefono_agencia'] || config['whatsapp'] || '',
                    logoUrl: config['logo_url'] || '',
                    previewText: config['email_preheader'] || '',
                    primaryColor: config['color_marca'] || '#1a73e8'
                })

                queueInserts.push({
                    agencia_id: agencia?.id,
                    lead_id: lead.id,
                    email_destinatario: lead.email,
                    asunto: subject,
                    cuerpo_html: finalHtml,
                    template_id: template?.id || null,
                    estado: 'pendiente',
                    intentos: 0
                })
            }

            const chunkSize = 100
            for (let i = 0; i < queueInserts.length; i += chunkSize) {
                const chunk = queueInserts.slice(i, i + chunkSize)
                const { error: queueErr } = await supabase.from('email_queue').insert(chunk)
                if (queueErr) throw queueErr
            }

            // Opcional: Despertar de inmediato a la Queue Function sin esperar 1 minuto
            supabase.functions.invoke('process-queue').catch(e => console.warn('process-queue wakeup failed', e))

            showToast(`🚀 ${selected.length} emails encolados para envío en segundo plano.`)
            setShowEmailModal(false)
            if (clearSelection) clearSelection()
        } catch (err) {
            showToast('Error preparando envíos: ' + err.message, 'error')
        } finally {
            setEmailSending(false)
            setEmailProgress('')
        }
    }, [agencia, emailBody, emailSubject, emailTemplates, selectedEmailTemplate, clearSelection, showToast])

    return {
        // Modal state
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
        // Handlers
        handleIndividualEmailClick,
        closeIndividualEmailModal,
        handleTemplateDropdownChange,
        openEmailModal,
        sendIndividualEmail,
        startDripSequenceFromModal,
        sendBulkEmail,
    }
}
