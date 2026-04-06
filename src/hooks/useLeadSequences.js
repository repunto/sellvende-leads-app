/**
 * useLeadSequences — Custom hook for drip/sequence management.
 * Encapsulates: handleAssignSecuencia, forceNextDripStep, handleStopSequence,
 *               handleMassSequenceEnroll, _doMassSequenceEnroll
 * Extracted from LeadsPage.jsx (Phase 2 refactor)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useLeadSequences({
    detailLead,
    secuencias,
    setLeads,
    setDetailLead,
    setDetailEmails,
    showToast,
    setConfirmDialog,
}) {
    const [leadSecuencia, setLeadSecuencia] = useState(null)
    const [sequenceEnrollments, setSequenceEnrollments] = useState({})
    const [showMassSequenceModal, setShowMassSequenceModal] = useState(false)
    const [selectedMassSequenceId, setSelectedMassSequenceId] = useState('')
    const [enrollingSequence, setEnrollingSequence] = useState(false)

    // ── Load sequence for the currently open detail panel ──
    useEffect(() => {
        if (detailLead) {
            supabase.from('leads_secuencias')
                .select('*')
                .eq('lead_id', detailLead.id)
                .maybeSingle()
                .then(({ data }) => setLeadSecuencia(data))
        } else {
            setLeadSecuencia(null)
        }
    }, [detailLead])

    // ── Assign / Remove sequence from detail panel ──
    const handleAssignSecuencia = useCallback(async (secuenciaId) => {
        if (!detailLead) return
        try {
            if (!secuenciaId) {
                await supabase.from('leads_secuencias').delete().eq('lead_id', detailLead.id)
                setLeadSecuencia(null)
                showToast('Secuencia removida')
            } else {
                const payload = {
                    lead_id: detailLead.id,
                    secuencia_id: secuenciaId,
                    estado: 'en_progreso',
                    ultimo_paso_ejecutado: 0
                }
                const { data, error } = await supabase
                    .from('leads_secuencias')
                    .upsert(payload, { onConflict: 'lead_id,secuencia_id' })
                    .select().single()
                if (error) {
                    await supabase.from('leads_secuencias').delete().eq('lead_id', detailLead.id)
                    const { data: insData, error: insErr } = await supabase
                        .from('leads_secuencias').insert([payload]).select().single()
                    if (insErr) throw insErr
                    setLeadSecuencia(insData)
                } else {
                    setLeadSecuencia(data)
                }
                showToast('Secuencia asignada al lead')
            }
        } catch (error) {
            showToast('Error asignando secuencia: ' + error.message, 'error')
        }
    }, [detailLead, showToast])

    // ── Force the next drip step immediately ──
    const forceNextDripStep = useCallback(() => {
        if (!leadSecuencia || leadSecuencia.estado !== 'en_progreso') return

        const seqTemplate = secuencias.find(s => s.id === leadSecuencia.secuencia_id)
        if (!seqTemplate?.pasos) return

        const ult = leadSecuencia.ultimo_paso_ejecutado || 0
        const nextPasos = seqTemplate.pasos
            .filter(p => p.dia_envio > ult)
            .sort((a, b) => a.dia_envio - b.dia_envio)
        if (nextPasos.length === 0) return

        setConfirmDialog({
            title: '⚡ Forzar Siguiente Paso',
            message: `¿Enviar AHORA MISMO el siguiente correo de la secuencia (Paso del Día ${nextPasos[0].dia_envio}) a este lead? Esta acción es inmediata e irreversible.`,
            danger: false,
            confirmLabel: '⚡ Enviar Ahora',
            onConfirm: async () => {
                setConfirmDialog(null)
                const targetDay = nextPasos[0].dia_envio
                const targetDate = new Date()
                targetDate.setDate(targetDate.getDate() - (targetDay - 1))
                targetDate.setHours(targetDate.getHours() - 2)

                try {
                    showToast('Acelerando secuencia...', 'info')

                    // 1. Shift enrollment date to trigger the target day
                    const { error: updErr } = await supabase.from('leads_secuencias')
                        .update({ created_at: targetDate.toISOString() })
                        .eq('id', leadSecuencia.id)
                    if (updErr) throw updErr

                    // 2. Bypass anti-spam guard (12h window)
                    const fakeLastContact = new Date()
                    fakeLastContact.setHours(fakeLastContact.getHours() - 13)
                    await supabase.from('leads')
                        .update({ ultimo_contacto: fakeLastContact.toISOString() })
                        .eq('id', detailLead.id)

                    // 3. Fire the drip engine
                    const { data: fnData, error: fnErr } = await supabase.functions.invoke('process-drips')
                    if (fnErr) throw fnErr

                    if (fnData?.errors?.length > 0) {
                        const targetError = fnData.errors.find(e => e.includes(detailLead.email))
                        if (targetError) {
                            showToast('Error de Envío: ' + targetError, 'error')
                            return
                        }
                    }

                    showToast('✅ Siguiente paso enviado exitosamente.')

                    const { data: updatedSeq } = await supabase.from('leads_secuencias')
                        .select('*').eq('id', leadSecuencia.id).single()
                    if (updatedSeq) setLeadSecuencia(updatedSeq)

                    setDetailLead(prev => prev ? { ...prev, ultimo_contacto: fakeLastContact.toISOString() } : null)

                    const { data: logData } = await supabase.from('email_log')
                        .select('*').eq('lead_id', detailLead.id)
                        .order('created_at', { ascending: false }).limit(20)
                    if (logData) setDetailEmails(logData)

                } catch (e) {
                    console.error('Drip Full Error:', e)
                    let errMsg = e.message
                    if (e.context && typeof e.context.json === 'function') {
                        try {
                            const ctx = await e.context.json()
                            if (ctx?.error) errMsg = ctx.error
                        } catch { /* ignore parse error */ }
                    }
                    showToast('Error acelerando secuencia: ' + errMsg, 'error')
                }
            }
        })
    }, [leadSecuencia, secuencias, detailLead, showToast, setConfirmDialog, setDetailLead, setDetailEmails])

    // ── Stop a lead's active sequence ──
    const handleStopSequence = useCallback((leadId) => {
        setConfirmDialog({
            title: 'Detener Secuencia',
            message: '¿Deseas detener la secuencia de este lead? No se enviarán más correos automáticos.',
            danger: true,
            confirmLabel: '🛑 Detener',
            onConfirm: async () => {
                setConfirmDialog(null)
                showToast('Deteniendo secuencia...', 'info')
                const { error } = await supabase.from('leads_secuencias')
                    .update({ estado: 'cancelada' }).eq('lead_id', leadId)
                if (error) {
                    showToast('Error al detener secuencia: ' + error.message, 'error')
                } else {
                    setSequenceEnrollments(prev => {
                        const next = { ...prev }
                        if (next[leadId]) next[leadId].estado = 'cancelada'
                        return next
                    })
                    if (detailLead?.id === leadId) {
                        setLeadSecuencia(prev => prev ? { ...prev, estado: 'cancelada' } : null)
                    }
                    showToast('Secuencia detenida exitosamente', 'success')
                }
            }
        })
    }, [detailLead, showToast, setConfirmDialog])

    // ── Mass sequence enrollment (confirm wrapper) ──
    const handleMassSequenceEnroll = useCallback((selectedLeads) => {
        if (!selectedMassSequenceId) {
            showToast('Selecciona una secuencia primero.', 'error')
            return
        }
        setConfirmDialog({
            title: 'Enrolamiento Masivo',
            message: `¿Enrolar a ${selectedLeads.size} leads en esta secuencia? Recibirán el primer correo casi de inmediato si el Motor está activo.`,
            danger: false,
            confirmLabel: `🚀 Enrolar ${selectedLeads.size} leads`,
            onConfirm: () => {
                setConfirmDialog(null)
                _doMassSequenceEnroll(selectedLeads)
            }
        })
    }, [selectedMassSequenceId, showToast, setConfirmDialog]) // eslint-disable-line

    // ── Internal: perform the actual mass enrollment ──
    const _doMassSequenceEnroll = useCallback(async (selectedLeadIds) => {
        setEnrollingSequence(true)
        showToast(`Iniciando enrolamiento masivo de ${selectedLeadIds.size} leads...`, 'info')

        try {
            // We need the full leads list — caller must provide it via a ref or we re-fetch
            // Strategy: Send the IDs to the database RPC for atomic transaction
            const leadIdsArray = [...selectedLeadIds]
            
            if (leadIdsArray.length === 0) throw new Error('No hay leads seleccionados')

            const { error: rpcErr } = await supabase.rpc('mass_enroll_sequence', {
                p_lead_ids: leadIdsArray,
                p_sequence_id: selectedMassSequenceId
            })
            
            if (rpcErr) throw rpcErr

            // Update UI state locally after successful DB transaction
            const targetSeqInfo = secuencias.find(s => s.id === selectedMassSequenceId)
            setSequenceEnrollments(prev => {
                const next = { ...prev }
                leadIdsArray.forEach(id => {
                    next[id] = {
                        lead_id: id,
                        secuencia_id: selectedMassSequenceId,
                        estado: 'en_progreso',
                        ultimo_paso_ejecutado: 0,
                        secuencias_marketing: { nombre: targetSeqInfo?.nombre || 'Playbook' }
                    }
                })
                return next
            })

            // CRITICAL: Fire process-drips BEFORE the cron kicks in
            await supabase.functions.invoke('process-drips')
            
            // Update local Leads state so UI reflects contactado and latest changes
            const updateFields = { ultimo_contacto: new Date().toISOString() }
            setLeads(prev => prev.map(l => {
                if (!selectedLeadIds.has(l.id)) return l
                return l.estado === 'nuevo'
                    ? { ...l, ...updateFields, estado: 'contactado' }
                    : { ...l, ...updateFields }
            }))

            showToast(`✅ ${selectedLeadIds.size} leads enrolados y primer correo enviado.`, 'success')
            setShowMassSequenceModal(false)
        } catch (error) {
            console.error(error)
            showToast('Error en enrolamiento masivo: ' + error.message, 'error')
        } finally {
            setEnrollingSequence(false)
        }
    }, [selectedMassSequenceId, secuencias, setLeads, showToast])

    return {
        leadSecuencia, setLeadSecuencia,
        sequenceEnrollments, setSequenceEnrollments,
        showMassSequenceModal, setShowMassSequenceModal,
        selectedMassSequenceId, setSelectedMassSequenceId,
        enrollingSequence,
        handleAssignSecuencia,
        forceNextDripStep,
        handleStopSequence,
        handleMassSequenceEnroll,
    }
}
