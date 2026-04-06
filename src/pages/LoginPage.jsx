import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
    const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [showPassword, setShowPassword] = useState(false)

    const intervalRef = useRef(null)

    // Clear interval on unmount to prevent memory leak
    useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

    const startCooldown = (seconds = 5) => {
        setCooldown(seconds)
        intervalRef.current = setInterval(() => {
            setCooldown(c => {
                if (c <= 1) { clearInterval(intervalRef.current); return 0 }
                return c - 1
            })
        }, 1000)
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setError(''); setSuccess('')
        setLoading(true)
        try {
            await signIn(email, password)
        } catch (err) {
            setError(err.message === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos.'
                : err.message
            )
            startCooldown(5)
        } finally {
            setLoading(false)
        }
    }

    const handleSignup = async (e) => {
        e.preventDefault()
        setError(''); setSuccess('')

        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.')
            return
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.')
            return
        }

        setLoading(true)
        try {
            await signUp(email, password)
            setSuccess('¡Cuenta creada! Revisa tu email para confirmar tu cuenta.')
            setMode('login')
            setPassword('')
            setConfirmPassword('')
        } catch (err) {
            setError(err.message.includes('already registered')
                ? 'Este email ya está registrado. Intenta iniciar sesión.'
                : err.message
            )
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async (e) => {
        e.preventDefault()
        setError(''); setSuccess('')
        if (!email) { setError('Ingresa tu email.'); return }
        setLoading(true)
        try {
            await resetPassword(email)
            setSuccess('Te enviamos un enlace para restablecer tu contraseña. Revisa tu email.')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setError(''); setSuccess('')
        setLoading(true)
        try {
            await signInWithGoogle()
            // No hacemos setLoading(false) aquí porque redirige el oauth
        } catch (err) {
            setError('Error al conectar con Google: ' + err.message)
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: '20px',
            fontFamily: '"Inter", "Outfit", system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <style>
                {`
                @keyframes spin-pulse {
                    0% { transform: rotate(0deg) scale(1); }
                    50% { transform: rotate(180deg) scale(1.2); }
                    100% { transform: rotate(360deg) scale(1); }
                }
                `}
            </style>
            {/* Decorative elements */}
            <div style={{
                position: 'absolute', top: '-20%', right: '-10%',
                width: '600px', height: '600px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute', bottom: '-15%', left: '-10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none'
            }} />

            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '28px',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '48px 40px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
                position: 'relative',
                zIndex: 1
            }}>
                {/* Brand */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 56, height: 56,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        borderRadius: 16,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '26px',
                        fontWeight: 900,
                        color: 'white',
                        marginBottom: 16,
                        boxShadow: '0 8px 24px rgba(99,102,241,0.3)'
                    }}>Q</div>
                    <h1 style={{
                        fontSize: '28px', fontWeight: 800,
                        color: 'white', margin: '0 0 6px 0',
                        letterSpacing: '-0.5px'
                    }}>
                        Quipu <span style={{ color: '#a5b4fc' }}>Reservas</span>
                    </h1>
                    <p style={{
                        fontSize: '14px', color: '#94a3b8', margin: 0, fontWeight: 400
                    }}>
                        {mode === 'login' && 'Accede a tu sistema de gestión'}
                        {mode === 'signup' && 'Crea tu cuenta en segundos'}
                        {mode === 'forgot' && 'Recupera tu acceso'}
                    </p>
                </div>

                {/* Google Login Button */}
                {mode !== 'forgot' && (
                    <>
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '13px 20px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 14,
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontSize: '15px',
                                fontWeight: 600,
                                cursor: loading ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                transition: 'all 200ms ease',
                                fontFamily: 'inherit',
                                marginBottom: 24,
                                opacity: loading ? 0.7 : 1
                            }}
                            onMouseOver={(e) => { if(!loading){ e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'} }}
                            onMouseOut={(e) => { if(!loading){ e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'} }}
                        >
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '1.2rem', animation: 'spin-pulse 1.5s infinite linear' }}>⏳</span>
                                    <span>Conectando con Google...</span>
                                </div>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Continuar con Google
                                </>
                            )}
                        </button>

                        {/* Divider */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            marginBottom: 24
                        }}>
                            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                o con email
                            </span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                        </div>
                    </>
                )}

                {/* Error / Success Messages */}
                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#fca5a5', fontSize: '13px',
                        marginBottom: 16, fontWeight: 500
                    }}>
                        ⚠️ {error}
                    </div>
                )}
                {success && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        color: '#86efac', fontSize: '13px',
                        marginBottom: 16, fontWeight: 500
                    }}>
                        ✅ {success}
                    </div>
                )}

                {/* LOGIN FORM */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>Email</label>
                            <input
                                type="email" value={email} required autoFocus
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                autoComplete="email"
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'} value={password} required
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    style={inputStyle}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                    style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', padding: 4
                                }}>
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: 20 }}>
                            <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} style={{
                                background: 'none', border: 'none', color: '#818cf8', fontSize: '13px',
                                cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit'
                            }}>
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                        <button type="submit" disabled={loading || cooldown > 0} style={btnPrimaryStyle(loading || cooldown > 0)}>
                            {loading ? 'Ingresando...' : cooldown > 0 ? `Espera ${cooldown}s` : 'Iniciar Sesión'}
                        </button>
                    </form>
                )}

                {/* SIGNUP FORM */}
                {mode === 'signup' && (
                    <form onSubmit={handleSignup}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>Email</label>
                            <input
                                type="email" value={email} required autoFocus
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                                Contraseña <span style={{ color: '#64748b', fontWeight: 400 }}>(mín. 8 caracteres)</span>
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'} value={password} required
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                minLength={8}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>Confirmar Contraseña</label>
                            <input
                                type={showPassword ? 'text' : 'password'} value={confirmPassword} required
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                minLength={8}
                                style={inputStyle}
                            />
                        </div>
                        <button type="submit" disabled={loading} style={btnPrimaryStyle(loading)}>
                            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                        </button>
                    </form>
                )}

                {/* FORGOT PASSWORD FORM */}
                {mode === 'forgot' && (
                    <form onSubmit={handleForgotPassword}>
                        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: 20, lineHeight: 1.6 }}>
                            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
                        </p>
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>Email</label>
                            <input
                                type="email" value={email} required autoFocus
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                style={inputStyle}
                            />
                        </div>
                        <button type="submit" disabled={loading} style={btnPrimaryStyle(loading)}>
                            {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
                        </button>
                    </form>
                )}

                {/* Mode Switcher */}
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    {mode === 'login' && (
                        <span style={{ color: '#64748b', fontSize: '14px' }}>
                            ¿No tienes cuenta?{' '}
                            <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); setEmail(''); setPassword(''); setConfirmPassword('') }} style={linkBtnStyle}>
                                Crear cuenta
                            </button>
                        </span>
                    )}
                    {mode === 'signup' && (
                        <span style={{ color: '#64748b', fontSize: '14px' }}>
                            ¿Ya tienes cuenta?{' '}
                            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); setEmail(''); setPassword(''); setConfirmPassword('') }} style={linkBtnStyle}>
                                Iniciar sesión
                            </button>
                        </span>
                    )}
                    {mode === 'forgot' && (
                        <button onClick={() => { setMode('login'); setError(''); setSuccess(''); setEmail(''); setPassword('') }} style={linkBtnStyle}>
                            ← Volver al login
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// --- Shared Styles ---

const inputStyle = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 200ms ease',
    boxSizing: 'border-box'
}

const btnPrimaryStyle = (disabled) => ({
    width: '100%',
    padding: '14px 20px',
    borderRadius: 14,
    border: 'none',
    background: disabled
        ? 'rgba(99,102,241,0.3)'
        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    fontSize: '15px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    transition: 'all 200ms ease',
    boxShadow: disabled ? 'none' : '0 8px 20px rgba(99,102,241,0.3)',
    letterSpacing: '0.3px'
})

const linkBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#818cf8',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    textDecoration: 'none',
    padding: 0
}
