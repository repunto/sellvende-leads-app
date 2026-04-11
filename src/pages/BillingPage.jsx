import { useState } from 'react'
import { usePlan } from '../hooks/usePlan'
import { useAuth } from '../context/AuthContext'
import { CreditCard, Zap, Shield, Clock, CheckCircle, AlertTriangle, Crown, Rocket, Star } from 'lucide-react'

export default function BillingPage() {
    const { agencia } = useAuth()
    const { suscripcion, plan, isActive, isTrial, isExpired, daysRemaining, planName, precio, loading } = usePlan()
    const [processingPayment, setProcessingPayment] = useState(null)

    const handleCheckout = async (provider) => {
        setProcessingPayment(provider)
        try {
            // TODO: Connect to Edge Function create-checkout
            // const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
            //     method: 'POST',
            //     headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ provider, agencia_id: agencia.id })
            // })
            // const { url } = await response.json()
            // window.location.href = url

            alert(`🚧 Checkout con ${provider} se conectará pronto.\n\nNecesitas configurar las API keys como Supabase Secrets:\n• STRIPE_SECRET_KEY\n• PAYPAL_CLIENT_ID / PAYPAL_SECRET\n• MP_ACCESS_TOKEN`)
        } catch (err) {
            console.error(`Error creating ${provider} checkout:`, err)
        } finally {
            setProcessingPayment(null)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-secondary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12, animation: 'pulse 1.5s infinite' }}>💳</div>
                    <div>Cargando información de tu plan...</div>
                </div>
            </div>
        )
    }

    const statusConfig = {
        trial: {
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
            border: 'rgba(245,158,11,0.2)',
            icon: <Clock size={20} />,
            label: 'Período de Prueba',
            sublabel: `${daysRemaining} días restantes`,
        },
        activa: {
            color: '#10b981',
            bg: 'rgba(16,185,129,0.1)',
            border: 'rgba(16,185,129,0.2)',
            icon: <CheckCircle size={20} />,
            label: 'Plan Activo',
            sublabel: 'Acceso completo',
        },
        expired: {
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.1)',
            border: 'rgba(239,68,68,0.2)',
            icon: <AlertTriangle size={20} />,
            label: 'Plan Vencido',
            sublabel: 'Modo solo lectura — activa tu plan para continuar',
        },
    }

    const currentStatus = isExpired ? 'expired' : isTrial ? 'trial' : 'activa'
    const status = statusConfig[currentStatus]

    const features = [
        { icon: <Zap size={18} />, text: 'Captura automática de leads desde Meta Ads', included: true },
        { icon: <Star size={18} />, text: 'Secuencias de email automatizadas (drip engine)', included: true },
        { icon: <Shield size={18} />, text: 'Multi-tenant con datos 100% aislados', included: true },
        { icon: <Rocket size={18} />, text: 'Dashboard Kanban de ventas', included: true },
        { icon: <Crown size={18} />, text: 'Conecta TU Gmail o Resend (sin costos extra)', included: true },
        { icon: <CreditCard size={18} />, text: 'Panel de finanzas y ROAS', included: true },
    ]

    return (
        <div>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                .billing-card {
                    background: var(--color-bg-card);
                    border: 1px solid var(--color-border);
                    border-radius: 20px;
                    padding: 32px;
                    transition: all 0.3s ease;
                }
                .billing-card:hover {
                    border-color: rgba(99,102,241,0.3);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                }
                .payment-btn {
                    width: 100%;
                    padding: 16px 24px;
                    border-radius: 14px;
                    border: 1px solid var(--color-border);
                    background: var(--color-bg-elevated);
                    color: var(--color-text);
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }
                .payment-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
                }
                .payment-btn:disabled {
                    opacity: 0.6;
                    cursor: wait;
                }
                .payment-btn.stripe {
                    background: linear-gradient(135deg, #635bff 0%, #7c3aed 100%);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 16px rgba(99,91,255,0.3);
                }
                .payment-btn.stripe:hover:not(:disabled) {
                    box-shadow: 0 8px 24px rgba(99,91,255,0.4);
                }
                .payment-btn.paypal {
                    background: linear-gradient(135deg, #003087 0%, #009cde 100%);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 16px rgba(0,48,135,0.3);
                }
                .payment-btn.paypal:hover:not(:disabled) {
                    box-shadow: 0 8px 24px rgba(0,48,135,0.4);
                }
                .payment-btn.mercadopago {
                    background: linear-gradient(135deg, #009ee3 0%, #00b1ea 100%);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 16px rgba(0,158,227,0.3);
                }
                .payment-btn.mercadopago:hover:not(:disabled) {
                    box-shadow: 0 8px 24px rgba(0,158,227,0.4);
                }
                .feature-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                    font-size: 14px;
                    color: var(--color-text-secondary);
                }
                .feature-item .icon {
                    color: #10b981;
                    flex-shrink: 0;
                }
            `}</style>

            {/* Page Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Crown size={28} style={{ color: '#f59e0b' }} />
                    Plan y Facturación
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.95rem' }}>
                    Gestiona tu suscripción y método de pago
                </p>
            </div>

            {/* Status Banner */}
            <div style={{
                background: status.bg,
                border: `1px solid ${status.border}`,
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 28,
            }}>
                <div style={{ color: status.color, flexShrink: 0 }}>{status.icon}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: status.color, fontSize: '1rem' }}>{status.label}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{status.sublabel}</div>
                </div>
                {isTrial && daysRemaining > 0 && (
                    <div style={{
                        background: 'rgba(245,158,11,0.15)',
                        borderRadius: 12,
                        padding: '10px 18px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{daysRemaining}</div>
                        <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>días</div>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Plan Card */}
                <div className="billing-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{
                            width: 48, height: 48,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderRadius: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                        }}>
                            <Rocket size={24} color="white" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Plan {planName}</h2>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                {agencia?.nombre || 'Tu Agencia'}
                            </div>
                        </div>
                    </div>

                    {/* Price */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--color-text)', lineHeight: 1 }}>${precio}</span>
                            <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>USD/mes</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                            Sin costos extra por email · Sin límite de leads
                        </div>
                    </div>

                    {/* Features */}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                            Incluye todo:
                        </div>
                        {features.map((f, i) => (
                            <div key={i} className="feature-item">
                                <span className="icon">{f.icon}</span>
                                <span>{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment Methods Card */}
                <div className="billing-card">
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CreditCard size={22} style={{ color: '#6366f1' }} />
                        {isActive && !isTrial ? 'Gestionar Pago' : 'Activar Plan'}
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: '0 0 28px' }}>
                        Elige tu método de pago preferido. Tu suscripción se activa al instante.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Stripe */}
                        <button
                            className="payment-btn stripe"
                            onClick={() => handleCheckout('stripe')}
                            disabled={!!processingPayment}
                        >
                            {processingPayment === 'stripe' ? (
                                <span style={{ animation: 'pulse 1s infinite' }}>Procesando...</span>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                                    </svg>
                                    Pagar con Stripe
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>Tarjeta de crédito/débito</span>
                                </>
                            )}
                        </button>

                        {/* PayPal */}
                        <button
                            className="payment-btn paypal"
                            onClick={() => handleCheckout('paypal')}
                            disabled={!!processingPayment}
                        >
                            {processingPayment === 'paypal' ? (
                                <span style={{ animation: 'pulse 1s infinite' }}>Procesando...</span>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                                    </svg>
                                    Pagar con PayPal
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>Cuenta PayPal o tarjeta</span>
                                </>
                            )}
                        </button>

                        {/* MercadoPago */}
                        <button
                            className="payment-btn mercadopago"
                            onClick={() => handleCheckout('mercadopago')}
                            disabled={!!processingPayment}
                        >
                            {processingPayment === 'mercadopago' ? (
                                <span style={{ animation: 'pulse 1s infinite' }}>Procesando...</span>
                            ) : (
                                <>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                    Pagar con MercadoPago
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>Tarjeta, transferencia o efectivo</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Security note */}
                    <div style={{
                        marginTop: 24,
                        padding: '12px 16px',
                        background: 'var(--color-bg-elevated)',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                    }}>
                        <Shield size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                        Pagos procesados de forma segura. No almacenamos datos de tarjeta.
                    </div>
                </div>
            </div>

            {/* Subscription Details */}
            {suscripcion && (
                <div className="billing-card" style={{ marginTop: 24 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📋 Detalles de Suscripción
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        {[
                            { label: 'Estado', value: suscripcion.estado?.toUpperCase(), color: status.color },
                            { label: 'Inicio', value: new Date(suscripcion.fecha_inicio).toLocaleDateString('es') },
                            { label: 'Método de Pago', value: suscripcion.metodo_pago?.toUpperCase() || 'Sin definir' },
                            { label: 'Fin Trial', value: suscripcion.trial_ends_at ? new Date(suscripcion.trial_ends_at).toLocaleDateString('es') : '—' },
                        ].map((item, i) => (
                            <div key={i}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: item.color || 'var(--color-text)' }}>{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
