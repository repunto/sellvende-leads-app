import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

export default function ResetPasswordPage() {
    const { updatePassword } = useAuth()
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleSubmit = async (e) => {
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
            await updatePassword(password)
            setSuccess('¡Contraseña actualizada! Redirigiendo...')
            setTimeout(() => navigate('/'), 2000)
        } catch (err) {
            setError(err.message)
        } finally {
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
            {/* Decorative elements */}
            <div style={{
                position: 'absolute', top: '-20%', right: '-10%',
                width: '600px', height: '600px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
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
                    }}>🔑</div>
                    <h1 style={{
                        fontSize: '24px', fontWeight: 800,
                        color: 'white', margin: '0 0 8px 0',
                        letterSpacing: '-0.5px'
                    }}>
                        Nueva Contraseña
                    </h1>
                    <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                        Ingresa tu nueva contraseña para recuperar tu acceso
                    </p>
                </div>

                {/* Messages */}
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

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                            Nueva Contraseña <span style={{ color: '#64748b', fontWeight: 400 }}>(mín. 8 caracteres)</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password} required autoFocus
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                minLength={8}
                                autoComplete="new-password"
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
                    <div style={{ marginBottom: 28 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                            Confirmar Contraseña
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword} required
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            minLength={8}
                            autoComplete="new-password"
                            style={inputStyle}
                        />
                    </div>
                    <button type="submit" disabled={loading} style={{
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: 14,
                        border: 'none',
                        background: loading
                            ? 'rgba(99,102,241,0.3)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 200ms ease',
                        boxShadow: loading ? 'none' : '0 8px 20px rgba(99,102,241,0.3)'
                    }}>
                        {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <Link to="/login" style={{ color: '#818cf8', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
                        ← Volver al login
                    </Link>
                </div>
            </div>
        </div>
    )
}

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
