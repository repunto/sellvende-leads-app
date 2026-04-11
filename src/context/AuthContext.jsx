import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [agencia, setAgencia] = useState(null)
    const [rol, setRol] = useState(null)
    const [loading, setLoading] = useState(true)

    async function fetchUserProfile(userId) {
        if (!userId) {
            setAgencia(null)
            setRol(null)
            return
        }
        try {
            let { data, error } = await supabase
                .from('usuarios_agencia')
                .select('rol, agencia:agencias(id, nombre, plan)')
                .eq('usuario_id', userId)
                .single()

            // RECOVERY MECHANISM: If user has no agency record, create a new isolated one
            // IMPORTANT: we do NOT link to an existing agency (multi-tenant security risk)
            if (error && error.code === 'PGRST116') {
                console.log("No agency link found for user. Creating new isolated agency...")

                // Create a brand-new agency specific to this user — never reuse existing ones
                const { data: newAgencia, error: agenciaErr } = await supabase
                    .from('agencias')
                    .insert({ nombre: 'Mi Agencia', plan: 'trial' })
                    .select('id')
                    .single()

                if (!agenciaErr && newAgencia) {
                    const { data: newLink, error: linkErr } = await supabase
                        .from('usuarios_agencia')
                        .insert({ usuario_id: userId, agencia_id: newAgencia.id, rol: 'admin' })
                        .select('rol, agencia:agencias(id, nombre, plan)')
                        .single()

                    if (!linkErr && newLink) {
                        data = newLink
                        error = null
                    }

                    // Auto-create trial subscription (14 days)
                    try {
                        const { data: planData } = await supabase
                            .from('planes')
                            .select('id')
                            .eq('nombre', 'Profesional')
                            .single()

                        if (planData) {
                            await supabase.from('suscripciones').insert({
                                agencia_id: newAgencia.id,
                                plan_id: planData.id,
                                estado: 'trial',
                                fecha_inicio: new Date().toISOString(),
                                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                            })
                            console.log('Trial subscription created for new agency')
                        }
                    } catch (subErr) {
                        console.warn('Could not create trial subscription:', subErr)
                    }
                }
            }

            if (!error && data) {
                setRol(data.rol)
                setAgencia(data.agencia) // { id, nombre, plan }
            } else {
                setRol(null)
                setAgencia(null)
            }
        } catch (e) {
            console.error('Error fetching user profile:', e)
            setRol(null)
            setAgencia(null)
        }
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser) {
                fetchUserProfile(currentUser.id).finally(() => setLoading(false))
            } else {
                setLoading(false)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser) fetchUserProfile(currentUser.id)
            else fetchUserProfile(null)
        })

        return () => subscription.unsubscribe()
    }, [])

    // --- Auth Methods ---

    const signIn = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
    }

    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin + '/login'
            }
        })
        if (error) throw error
        return data
    }

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        })
        if (error) throw error
    }

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password'
        })
        if (error) throw error
    }

    const updatePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{
            user, agencia, rol, loading,
            signIn, signUp, signInWithGoogle, resetPassword, updatePassword, signOut
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
