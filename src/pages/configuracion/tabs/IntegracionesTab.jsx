import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export default function IntegracionesTab({ showToast, agencia }) {
    const [config, setConfig] = useState({})
    const [originalConfig, setOriginalConfig] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Meta Token Validation State
    const [metaValidating, setMetaValidating] = useState(false)
    const [metaResult, setMetaResult] = useState(null) // { valid, page, token_info, integration }
    const [metaTokenInput, setMetaTokenInput] = useState('')
    const [showMetaGuide, setShowMetaGuide] = useState(false)

    useEffect(() => {
        if (agencia?.id) {
            fetchConfig()
        }
    }, [agencia])

    // Meta SDK Initialization for App Review
    useEffect(() => {
        window.fbAsyncInit = function() {
            window.FB.init({
                appId            : '1267272824797352',
                autoLogAppEvents : true,
                xfbml            : true,
                version          : 'v19.0'
            });
        };
        (function(d, s, id){
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {return;}
            js = d.createElement(s); js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    }, []);

    // Auto-validate existing token on load
    useEffect(() => {
        if (config.meta_page_access_token && config.meta_page_access_token.startsWith('EAA')) {
            setMetaTokenInput(config.meta_page_access_token)
        }
    }, [config.meta_page_access_token])

    const validateMetaToken = useCallback(async (tokenToValidate) => {
        const token = (tokenToValidate || metaTokenInput || '').trim()
        if (!token || token.length < 20) {
            showToast('Pega un token de página válido (comienza con EAAO...)', 'error')
            return
        }

        setMetaValidating(true)
        setMetaResult(null)

        try {
            const { data, error } = await supabase.functions.invoke('validate-meta-token', {
                body: { page_access_token: token }
            })

            if (error) {
                showToast('Error de conexión con el servidor. Intenta de nuevo.', 'error')
                console.error('[Meta Validate] Server error:', error)
                setMetaValidating(false)
                return
            }

            setMetaResult(data)

            if (data.valid) {
                // Auto-save token + page ID to config
                const pageId = data.page?.id
                if (pageId) {
                    await supabase.from('configuracion').upsert([
                        { agencia_id: agencia.id, clave: 'meta_page_id', valor: pageId },
                        { agencia_id: agencia.id, clave: 'meta_page_access_token', valor: token }
                    ], { onConflict: 'agencia_id,clave' })
                    setConfig(prev => ({ ...prev, meta_page_id: pageId, meta_page_access_token: token }))
                    showToast(`✅ ¡Página "${data.page.name}" conectada exitosamente!`, 'success')
                }
            } else {
                showToast(data.error || 'Token inválido', 'error')
            }
        } catch (err) {
            console.error('[Meta Validate] Unexpected:', err)
            showToast('Error inesperado al validar. Revisa tu conexión.', 'error')
        } finally {
            setMetaValidating(false)
        }
    }, [metaTokenInput, agencia?.id, showToast])

    const disconnectMeta = async () => {
        try {
            await supabase.from('configuracion').upsert([
                { agencia_id: agencia.id, clave: 'meta_page_id', valor: '' },
                { agencia_id: agencia.id, clave: 'meta_page_access_token', valor: '' }
            ], { onConflict: 'agencia_id,clave' })
            setConfig(prev => ({ ...prev, meta_page_id: '', meta_page_access_token: '' }))
            setMetaResult(null)
            setMetaTokenInput('')
            showToast('Página de Meta desconectada.')
        } catch {
            showToast('Error al desconectar', 'error')
        }
    }

    const handleOAuthLogin = () => {
        if (!window.FB) {
            showToast('El SDK de Facebook aún no carga. Espera un segundo.', 'error');
            return;
        }
        setMetaValidating(true);
        window.FB.login(function(response) {
            if (response.authResponse) {
                const short_lived_token = response.authResponse.accessToken;
                // Exchange the token via edge function
                supabase.functions.invoke('meta-oauth', {
                    body: { short_lived_token }
                }).then(({ data, error }) => {
                    setMetaValidating(false);
                    if (error) {
                        console.error("OAuth Error:", error);
                        showToast('Error validando token. Usa el panel manual.', 'error');
                    } else if (data && data.pages && data.pages.error) {
                        showToast('Error de Meta: ' + data.pages.error.message, 'error');
                    } else if (data && data.pages && data.pages.data && data.pages.data.length > 0) {
                        // Agarramos la primera página que devuelva (para simplificar la review)
                        const firstPage = data.pages.data[0];
                        validateMetaToken(firstPage.access_token);
                    } else {
                        showToast('No se encontraron páginas en esta cuenta.', 'error');
                    }
                });
            } else {
                setMetaValidating(false);
                showToast('Login cancelado.', 'error');
            }
        }, {scope: 'pages_show_list,pages_manage_ads,leads_retrieval,pages_read_engagement,business_management'});
    }

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('configuracion')
                .select('clave, valor')
                .eq('agencia_id', agencia.id)

            if (error) throw error

            const configMap = {}
            data.forEach(item => {
                configMap[item.clave] = item.valor
            })
            setConfig(configMap)
            setOriginalConfig(configMap)
        } catch (err) {
            console.error('Error fetching config:', err)
            showToast('Error cargando configuraciones', 'error')
        } finally {
            setLoading(false)
        }
    }

    const hasPendingChanges = () => {
        const keysToCheck = ['meta_pixel_id', 'meta_capi_token']
        for (const k of keysToCheck) {
            if ((config[k] || '') !== (originalConfig[k] || '')) return true
        }
        return false
    }

    const handleChange = (e) => {
        setConfig(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const keysToSync = ['meta_pixel_id', 'meta_capi_token']
            
            const checksAndUpserts = keysToSync.map(async clave => {
                const isNew = originalConfig[clave] === undefined
                const val = config[clave] || ''
                
                if (isNew && val) {
                    return supabase.from('configuracion').insert({
                        agencia_id: agencia.id,
                        clave: clave,
                        valor: val
                    })
                } else if (!isNew && val !== originalConfig[clave]) {
                    if (!val) {
                         return supabase.from('configuracion').delete().eq('agencia_id', agencia.id).eq('clave', clave)
                    } else {
                        return supabase.from('configuracion').update({ valor: val }).eq('agencia_id', agencia.id).eq('clave', clave)
                    }
                }
            })

            await Promise.all(checksAndUpserts)

            setOriginalConfig({...config})
            showToast('Integraciones guardadas exitosamente')
        } catch (err) {
            console.error('Error:', err)
            showToast('Error al guardar integraciones', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Cargando integraciones...</div>

    const isConnected = !!(config.meta_page_id && config.meta_page_access_token)

    return (
        <div style={{ maxWidth: 800 }}>
            <h2 className="mb-4" style={{ fontSize: '1.2rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.5rem' }}>🎯</span> Meta Conversions API (CAPI)
            </h2>
            <div style={{ background: 'var(--color-bg-hover)', borderRadius: 8, padding: 16, marginBottom: 20, fontSize: '0.9rem', color: 'var(--color-text-secondary)', borderLeft: '4px solid #1a73e8' }}>
                <p style={{ margin: 0 }}>
                    <strong>¿Qué es Meta CAPI?</strong> La API de conversiones de Meta permite enviar datos de leads calificados y ventas cerradas directamente desde el servidor de Sellvende, mejorando drásticamente el rendimiento de tus campañas, ya que puentea el bloqueo de cookies de iOS14 y los AdBlockers.
                </p>
            </div>

            {/* ============================================================
                   META LEADS INTEGRATION — ENTERPRISE TOKEN VALIDATION
                   ============================================================ */}
                <div style={{ marginTop: 40 }}>
                    {/* Section Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12, 
                            background: 'linear-gradient(135deg, #1877F2, #0053b0)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(24, 119, 242, 0.3)'
                        }}>
                            <span style={{ fontSize: 20 }}>📡</span>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
                                Integración Meta Lead Ads
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                Recibe leads de Facebook e Instagram en tiempo real y activa secuencias automáticas.
                            </p>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                                letterSpacing: '0.3px',
                                background: isConnected ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                color: isConnected ? '#10b981' : '#ef4444',
                                border: `1px solid ${isConnected ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`
                            }}>
                                <span style={{ 
                                    width: 8, height: 8, borderRadius: '50%', 
                                    background: isConnected ? '#10b981' : '#ef4444',
                                    animation: isConnected ? 'none' : undefined
                                }}></span>
                                {isConnected ? 'CONECTADO' : 'SIN CONECTAR'}
                            </span>
                        </div>
                    </div>

                    {/* Main Integration Card */}
                    <div style={{
                        background: 'var(--color-bg-elevated)', 
                        borderRadius: 20, 
                        border: `1px solid ${isConnected ? 'rgba(52, 211, 153, 0.3)' : 'var(--color-border)'}`,
                        overflow: 'hidden',
                        transition: 'border-color 0.3s ease'
                    }}>
                        {/* Connected State — Page Info Card */}
                        {isConnected && (
                            <div style={{ 
                                padding: '24px 28px',
                                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.06), rgba(16, 185, 129, 0.02))',
                                borderBottom: '1px solid rgba(52, 211, 153, 0.15)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {metaResult?.page?.picture_url ? (
                                        <img 
                                            src={metaResult.page.picture_url} 
                                            alt="Page" 
                                            style={{ 
                                                width: 56, height: 56, borderRadius: 14, 
                                                objectFit: 'cover', border: '2px solid rgba(52, 211, 153, 0.4)',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }} 
                                        />
                                    ) : (
                                        <div style={{ 
                                            width: 56, height: 56, borderRadius: 14, 
                                            background: 'linear-gradient(135deg, #1877F2, #0053b0)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 24, color: '#fff'
                                        }}>📄</div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                                            {metaResult?.page?.name || 'Página Conectada'}
                                        </div>
                                        <div style={{ 
                                            display: 'flex', alignItems: 'center', gap: 12, 
                                            fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 
                                        }}>
                                            <span>ID: {config.meta_page_id}</span>
                                            {metaResult?.page?.category && <span>• {metaResult.page.category}</span>}
                                            {metaResult?.page?.fan_count > 0 && <span>• {metaResult.page.fan_count.toLocaleString()} seguidores</span>}
                                        </div>
                                        {metaResult?.token_info && (
                                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                                                    background: metaResult.token_info.is_permanent ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                    color: metaResult.token_info.is_permanent ? '#059669' : '#d97706',
                                                }}>
                                                    {metaResult.token_info.is_permanent ? '∞ Token Permanente' : `⏱ Expira: ${metaResult.token_info.expires}`}
                                                </span>
                                                {metaResult.integration?.webhook_subscribed && (
                                                    <span style={{
                                                        padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                                                        background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1'
                                                    }}>⚡ Webhook Activo</span>
                                                )}
                                                {metaResult.integration?.has_lead_access && (
                                                    <span style={{
                                                        padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                                                        background: 'rgba(52, 211, 153, 0.12)', color: '#059669'
                                                    }}>✓ Lead Access</span>
                                                )}
                                                {metaResult.integration?.lead_forms_count > 0 && (
                                                    <span style={{
                                                        padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                                                        background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6'
                                                    }}>📋 {metaResult.integration.lead_forms_count} formulario(s)</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button 
                                            type="button" 
                                            onClick={() => validateMetaToken(config.meta_page_access_token)}
                                            disabled={metaValidating}
                                            style={{
                                                background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)',
                                                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                                                fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {metaValidating ? '...' : '🔄 Verificar'}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={disconnectMeta}
                                            style={{
                                                background: 'none', border: '1px solid rgba(239, 68, 68, 0.3)',
                                                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                                                fontSize: '0.8rem', fontWeight: 600, color: '#ef4444',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            ✕ Desconectar
                                        </button>
                                    </div>
                                </div>

                                {/* Warning badges for missing scopes */}
                                {metaResult?.integration?.missing_scopes?.length > 0 && (
                                    <div style={{
                                        marginTop: 12, padding: '10px 14px', borderRadius: 10,
                                        background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
                                        fontSize: '0.82rem', color: '#b45309'
                                    }}>
                                        ⚠️ <strong>Permisos faltantes:</strong> {metaResult.integration.missing_scopes.join(', ')}. 
                                        Regenera el token con los permisos correctos.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Token Input Section */}
                        <div style={{ padding: '24px 28px' }}>
                            {/* OAUTH BUTTON PARA REVISOR META */}
                            {!isConnected && (
                                <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
                                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 10, color: 'var(--color-text)' }}>
                                        Conexión Automática con Facebook (Recomendado)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleOAuthLogin}
                                        disabled={metaValidating}
                                        style={{
                                            width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                                            background: '#1877F2', color: '#fff', fontWeight: 700, fontSize: '1rem',
                                            cursor: metaValidating ? 'wait' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                            boxShadow: '0 4px 16px rgba(24, 119, 242, 0.3)', transition: 'all 0.3s ease'
                                        }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                        </svg>
                                        {metaValidating ? 'Conectando...' : 'Conectar con Facebook'}
                                    </button>
                                </div>
                            )}

                            <label style={{ 
                                display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 10,
                                color: 'var(--color-text)'
                            }}>
                                {isConnected ? 'Actualizar Token de Página' : 'Conexión Manual / Enterprise Token'}
                            </label>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <input
                                    type="password"
                                    placeholder="EAAO..."
                                    value={metaTokenInput}
                                    onChange={(e) => setMetaTokenInput(e.target.value)}
                                    onPaste={(e) => {
                                        setTimeout(() => {
                                            const pasted = e.target.value.trim()
                                            if (pasted.length > 50) validateMetaToken(pasted)
                                        }, 100)
                                    }}
                                    style={{
                                        flex: 1, borderRadius: 12, padding: '14px 16px',
                                        border: metaResult?.valid ? '2px solid #34d399' : metaResult?.valid === false ? '2px solid #ef4444' : '1px solid var(--color-border)',
                                        fontSize: '0.95rem', fontFamily: 'monospace',
                                        background: 'var(--color-bg-hover)',
                                        transition: 'border-color 0.3s ease'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => validateMetaToken()}
                                    disabled={metaValidating || !metaTokenInput}
                                    style={{
                                        padding: '14px 24px', borderRadius: 12, border: 'none',
                                        background: metaValidating ? '#94a3b8' : 'linear-gradient(135deg, #1877F2, #0053b0)',
                                        color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                        cursor: metaValidating ? 'wait' : 'pointer',
                                        minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        boxShadow: metaValidating ? 'none' : '0 4px 16px rgba(24, 119, 242, 0.3)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    {metaValidating ? (
                                        <><span style={{ 
                                            display: 'inline-block', width: 16, height: 16, 
                                            border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                                            borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                                        }}></span> Validando...</>
                                    ) : '🔗 Conectar'}
                                </button>
                            </div>

                            {/* Validation Error */}
                            {metaResult && !metaResult.valid && (
                                <div style={{
                                    marginTop: 12, padding: '12px 16px', borderRadius: 10,
                                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                    fontSize: '0.85rem', color: '#dc2626', fontWeight: 500
                                }}>
                                    ❌ {metaResult.error}
                                </div>
                            )}

                            {/* Auto-paste hint */}
                            <p style={{ 
                                margin: '10px 0 0', fontSize: '0.78rem', 
                                color: 'var(--color-text-secondary)', fontStyle: 'italic' 
                            }}>
                                💡 Al pegar un token largo se valida automáticamente. Sin popups, sin logins externos.
                            </p>
                        </div>

                        {/* Step-by-Step Guide (Collapsible) */}
                        <div style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button
                                type="button"
                                onClick={() => setShowMetaGuide(!showMetaGuide)}
                                style={{
                                    width: '100%', padding: '16px 28px', background: 'none', border: 'none',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                onMouseOut={e => e.currentTarget.style.background = 'none'}
                            >
                                <span>📖 ¿Cómo obtengo mi Page Access Token?</span>
                                <span style={{ 
                                    transform: showMetaGuide ? 'rotate(180deg)' : 'rotate(0deg)', 
                                    transition: 'transform 0.3s ease',
                                    fontSize: '1.2rem'
                                }}>▾</span>
                            </button>

                            {showMetaGuide && (
                                <div style={{ 
                                    padding: '0 28px 28px', 
                                    animation: 'fadeIn 0.3s ease'
                                }}>
                                    <div style={{
                                        display: 'grid', gap: 16
                                    }}>
                                        {/* Step 1 */}
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                background: 'linear-gradient(135deg, #1877F2, #0053b0)',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 800, fontSize: '0.9rem'
                                            }}>1</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4 }}>
                                                    Abre Meta Business Suite
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                                    Ve a <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" 
                                                    style={{ color: '#1877F2', fontWeight: 600, textDecoration: 'none' }}>
                                                        business.facebook.com → Configuración → Usuarios del sistema
                                                    </a>.
                                                    Si no tienes un Usuario del Sistema, créalo (ej: "CRM Bot").
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2 */}
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 800, fontSize: '0.9rem'
                                            }}>2</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4 }}>
                                                    Asigna tu Página al Usuario del Sistema
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                                    Haz clic en <strong>"Agregar activos"</strong>, selecciona <strong>"Páginas"</strong>, 
                                                    elige tu Fanpage y otorga acceso completo (todos los permisos).
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 3 */}
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 800, fontSize: '0.9rem'
                                            }}>3</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4 }}>
                                                    Genera el Token Permanente
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                                    Haz clic en <strong>"Generar token"</strong>, selecciona tu App, 
                                                    marca los permisos <code style={{ background: 'var(--color-bg-hover)', padding: '1px 6px', borderRadius: 4, fontSize: '0.78rem' }}>pages_show_list</code>, <code style={{ background: 'var(--color-bg-hover)', padding: '1px 6px', borderRadius: 4, fontSize: '0.78rem' }}>pages_read_engagement</code>, y <code style={{ background: 'var(--color-bg-hover)', padding: '1px 6px', borderRadius: 4, fontSize: '0.78rem' }}>leads_retrieval</code>. 
                                                    Copia el token generado y pégalo aquí arriba.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Alternative: Quick Token from Graph Explorer */}
                                        <div style={{ 
                                            padding: '16px 20px', borderRadius: 12, marginTop: 4,
                                            background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)'
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 6, color: '#b45309' }}>
                                                ⚡ Alternativa rápida (Token temporal de prueba)
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                                Para probar rápido, ve al <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" 
                                                style={{ color: '#1877F2', fontWeight: 600, textDecoration: 'none' }}>
                                                    Graph API Explorer
                                                </a>, selecciona tu App y tu Página, marca <strong>pages_show_list + leads_retrieval</strong>, 
                                                dale "Generate Access Token", y pégalo aquí. Durará ~60 días.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            <div className="card" style={{ padding: '24px', marginTop: 40 }}>
                <div style={{ display: 'grid', gap: '20px' }}>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Meta Pixel ID (o Dataset ID)
                            {originalConfig.meta_pixel_id && (
                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '12px', fontWeight: 'bold' }}>
                                    ✓ Configurado
                                </span>
                            )}
                        </label>
                        <input
                            type="text"
                            name="meta_pixel_id"
                            className="form-input"
                            value={config.meta_pixel_id || ''}
                            onChange={handleChange}
                            placeholder="Ej: 139589345091212"
                            autoComplete="off"
                            style={{ fontFamily: 'monospace' }}
                        />
                        <small className="help-text">El identificador numérico de tu Píxel o Dataset de Meta.</small>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Access Token (Conversions API)
                            {originalConfig.meta_capi_token && (
                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '12px', fontWeight: 'bold' }}>
                                    ✓ Token Seguro y Activo
                                </span>
                            )}
                        </label>
                        <input
                            type="password"
                            name="meta_capi_token"
                            className="form-input"
                            value={config.meta_capi_token || ''}
                            onChange={handleChange}
                            placeholder={originalConfig.meta_capi_token ? "••••••••••••••••••••••••••••••••••••" : "Ej: EAAGm0PX...3FwZDZD"}
                            autoComplete="off"
                            style={{ fontFamily: 'monospace' }}
                        />
                        <small className="help-text">Token de acceso generado en el Administrador de Eventos de Meta. Se oculta automáticamente por seguridad.</small>
                    </div>

                    {/* Submit */}
                    <div style={{ paddingTop: '10px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleSave} 
                            disabled={saving || !hasPendingChanges()}
                        >
                            {saving ? 'Guardando...' : 'Guardar Integración CAPI ✅'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
