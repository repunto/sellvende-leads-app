import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * usePlan() — Hook centralizado para el estado de suscripción SaaS.
 * 
 * Retorna:
 * - suscripcion: datos raw de la suscripción
 * - plan: datos del plan (nombre, precio, features)
 * - isActive: true si trial vigente O suscripción activa
 * - isTrial: true si está en período de prueba
 * - isExpired: true si trial venció o suscripción cancelada/vencida
 * - daysRemaining: días restantes de trial o suscripción
 * - canAccess(feature): verifica si el plan incluye un feature
 * - isReadOnly: true si la suscripción venció (modo lectura)
 * - loading: true mientras carga los datos
 * - refresh: función para recargar manualmente
 */
export function usePlan() {
    const { agencia } = useAuth()
    const [suscripcion, setSuscripcion] = useState(null)
    const [plan, setPlan] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchSubscription = useCallback(async () => {
        if (!agencia?.id) {
            setLoading(false)
            return
        }

        try {
            const { data, error } = await supabase
                .from('suscripciones')
                .select('*, plan:planes(*)')
                .eq('agencia_id', agencia.id)
                .single()

            if (error && error.code === 'PGRST116') {
                // No subscription found — will be created by AuthContext on signup
                setSuscripcion(null)
                setPlan(null)
            } else if (!error && data) {
                setSuscripcion(data)
                setPlan(data.plan)
            }
        } catch (e) {
            console.error('[usePlan] Error fetching subscription:', e)
        } finally {
            setLoading(false)
        }
    }, [agencia?.id])

    useEffect(() => {
        fetchSubscription()
    }, [fetchSubscription])

    // Computed values
    const now = new Date()

    const isTrial = suscripcion?.estado === 'trial'
    const isActiva = suscripcion?.estado === 'activa'

    const trialEndsAt = suscripcion?.trial_ends_at ? new Date(suscripcion.trial_ends_at) : null
    const fechaFin = suscripcion?.fecha_fin ? new Date(suscripcion.fecha_fin) : null

    const trialExpired = isTrial && trialEndsAt && now > trialEndsAt
    const subscriptionExpired = suscripcion?.estado === 'vencida' || suscripcion?.estado === 'cancelada'

    const isActive = (isTrial && !trialExpired) || isActiva
    const isExpired = trialExpired || subscriptionExpired || !suscripcion

    // Days remaining calculation
    let daysRemaining = 0
    if (isTrial && trialEndsAt) {
        daysRemaining = Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)))
    } else if (isActiva && fechaFin) {
        daysRemaining = Math.max(0, Math.ceil((fechaFin - now) / (1000 * 60 * 60 * 24)))
    } else if (isActiva) {
        daysRemaining = 999 // Active with no end date = unlimited
    }

    // Feature gate
    const canAccess = (feature) => {
        if (!plan?.features) return false
        return !!plan.features[feature]
    }

    // Read-only mode: if expired, user can view but not create/edit
    const isReadOnly = isExpired && !loading

    return {
        suscripcion,
        plan,
        isActive,
        isTrial,
        isExpired,
        isReadOnly,
        daysRemaining,
        canAccess,
        loading,
        refresh: fetchSubscription,
        planName: plan?.nombre || 'Sin Plan',
        precio: plan?.precio_mensual || 0,
    }
}
