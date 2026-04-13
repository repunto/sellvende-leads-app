import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CONFIG_KEYS, EMAIL_CONFIG_KEYS, TIPOS_PLANTILLA, TIPOS_MARKETING } from '../constants';

export default function AgenciaTab({ showToast, agencia }) {
    const [config, setConfig] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isMetaLoading, setIsMetaLoading] = useState(false)
    const [fbPages, setFbPages] = useState([])
    const [revealedFields, setRevealedFields] = useState({})

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if(agencia?.id) loadConfig() }, [agencia?.id])

    useEffect(() => {
        if (!window.FB) {
            window.fbAsyncInit = function() {
                window.FB.init({
                    appId      : import.meta.env.VITE_META_APP_ID || '',
                    cookie     : true,
                    xfbml      : true,
                    version    : 'v19.0'
                });
            };
            (function(d, s, id){
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) {return;}
                js = d.createElement(s); js.id = id;
                js.src = "https://connect.facebook.net/es_LA/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
        }
    }, [])

    const handleMetaLogin = () => {
        if (!window.FB) return showToast('Cargando Facebook SDK...', 'error')
        if (!import.meta.env.VITE_META_APP_ID) return showToast('Falta configurar VITE_META_APP_ID en el archivo .env principal del servidor', 'error')
        
        setIsMetaLoading(true)
        window.FB.login((response) => {
            if (response.authResponse) {
                supabase.functions.invoke('meta-oauth', {
                    body: { short_lived_token: response.authResponse.accessToken }
                }).then(({ data, error }) => {
                    setIsMetaLoading(false)
                    if (error) {
                        console.error('Meta OAuth Runtime Error:', error);
                        return showToast('Error del servidor: ' + (error.message || 'Revisa los Secrets en Supabase'), 'error')
                    }
                    if (!data || data.error) {
                        console.error('Meta OAuth Data Error:', data);
                        return showToast(data?.error || data?.message || 'Error interno de Meta. Revisa los logs.', 'error')
                    }
                    const pages = data.pages || []
                    if (pages.length === 0) {
                        return showToast('Conexión OK, pero tu cuenta no tiene Fanpages disponibles o faltan permisos en la App Meta. Revisa que "leads_retrieval" está activo.', 'error')
                    }
                    showToast(`Conexión exitosa — ${pages.length} página(s) encontrada(s). Selecciona la tuya.`, 'success')
                    setFbPages(pages)
                }).catch((err) => {
                    setIsMetaLoading(false)
                    showToast('Error de red al conectar con Supabase', 'error')
                    console.error(err)
                })
            } else {
                setIsMetaLoading(false)
                showToast('Inicio de sesión cancelado o rechazado por Facebook.', 'error')
            }
        }, { scope: 'pages_show_list,pages_manage_ads,leads_retrieval', auth_type: 'rerequest' })
    }

    const selectFbPage = async (page) => {
        try {
            // Auto-Subscribe Webhooks for Leadgen
            try {
                await fetch(`https://graph.facebook.com/v19.0/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${page.access_token}`, { method: 'POST' })
            } catch(e) { console.warn('No se pudo auto-suscribir el webhook', e) }

            await supabase.from('configuracion').upsert([
                { agencia_id: agencia.id, clave: 'meta_page_id', valor: page.id },
                { agencia_id: agencia.id, clave: 'meta_page_access_token', valor: page.access_token }
            ], { onConflict: 'agencia_id,clave' })
            setConfig(prev => ({ ...prev, meta_page_id: page.id, meta_page_access_token: page.access_token }))
            setFbPages([])
            showToast(`¡Página ${page.name} vinculada exitosamente!`)
        } catch {
            showToast('Error al guardar la página selecta', 'error')
        }
    }

    async function loadConfig() {
        setLoading(true)
        const { data, error } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .eq('agencia_id', agencia.id);

        if (!error && data) {
            const map = {}
            data.forEach(row => { map[row.clave] = row.valor })

            setConfig(map)
        }
        setLoading(false)
    }

    async function handleSave(e) {
        e.preventDefault()
        if (!agencia) {
            showToast('Cargando datos de usuario. Intente nuevamente en un segundo.', 'error')
            return
        }

        // --- VALIDACIONES ESTRICTAS DE MOTOR DE CORREOS ---
        if (config.proveedor_email === 'gmail') {
            const pwd = (config.gmail_app_password || '').trim().replace(/\s+/g, '');
            if (!pwd) {
                showToast('Alto! Falta tu Contraseña de Aplicación de Gmail.', 'error')
                return
            }
            if (pwd.length !== 16) {
                showToast(`Error: La Contraseña de App Gmail debe tener exactamente 16 letras. Tiene ${pwd.length}.`, 'error')
                return
            }
            if (!config.email_remitente) {
                showToast('Error: Debes ingresar tu Email Remitente (ej. tu@gmail.com).', 'error')
                return
            }
            // Asegurar que guardamos sin espacios para la Edge Function
            config.gmail_app_password = pwd;
        } else if (config.proveedor_email === 'resend') {
            if (!config.resend_api_key) {
                showToast('Error: Falta la API Key de Resend.', 'error')
                return
            }
            if (!config.email_remitente) {
                showToast('Error: Falta el Email Remitente para Resend.', 'error')
                return
            }
        }

        setSaving(true)
        try {
            // Upsert each key (normal + email config keys)
            const allKeys = [...CONFIG_KEYS.map(k => k.clave), ...EMAIL_CONFIG_KEYS]
            const upserts = allKeys.map((clave) => ({
                agencia_id: agencia.id,
                clave,
                valor: config[clave] || '',
            }))

            for (const row of upserts) {
                const { error } = await supabase
                    .from('configuracion')
                    .upsert(row, { onConflict: 'agencia_id,clave' })

                if (error) throw error
            }

            showToast('Configuración guardada correctamente')
        } catch (err) {
            console.error(err)
            showToast('Error al guardar: ' + err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Cargando configuración…</div>
    }

    return (
        <div className="card" style={{ maxWidth: 900, borderRadius: 24, padding: 32 }}>
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Identidad y Conectividad</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Configura los pilares maestros de tu agencia y las integraciones de marketing de élite.</p>
            </div>

            <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px 32px' }}>
                    {CONFIG_KEYS.map(({ clave, label, placeholder, type }) => (
                        <div className="form-group" key={clave} style={{ 
                            gridColumn: type === 'textarea' || clave.includes('token') || clave.includes('key') ? '1 / -1' : 'span 1',
                            marginBottom: 0
                        }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', marginBottom: 8, display: 'block' }}>{label}</label>
                            {clave === 'logo_url' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{
                                        width: 80, height: 60, borderRadius: 8, border: '1px dashed var(--color-border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: config.logo_url ? '#fff' : 'var(--color-bg-secondary)',
                                        overflow: 'hidden', padding: 4, flexShrink: 0
                                    }}>
                                        {config.logo_url ? (
                                            <img src={config.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ fontSize: 24, opacity: 0.3 }}>🖼️</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Pega la URL de tu Logo (https://...)"
                                            value={config.logo_url || ''}
                                            onChange={(e) => setConfig(prev => ({ ...prev, logo_url: e.target.value }))}
                                            style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-border)', padding: '8px 12px', fontSize: '0.85rem' }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>O subir archivo:</span>
                                            <input 
                                                type="file" 
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    if (file.size > 1024 * 1024) return showToast('El logo pesa más de 1MB.', 'error');
                                                    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return showToast('Formato inválido. Usa PNG, JPG o WEBP.', 'error');
                                                    
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const img = new Image();
                                                        img.onload = () => {
                                                            const canvas = document.createElement('canvas');
                                                            let [w, h] = [img.width, img.height];
                                                            const MAX_W = 400, MAX_H = 150;
                                                            if (w > MAX_W) { h *= MAX_W/w; w = MAX_W; }
                                                            if (h > MAX_H) { w *= MAX_H/h; h = MAX_H; }
                                                            canvas.width = w; canvas.height = h;
                                                            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                                                            setConfig(prev => ({ ...prev, logo_url: canvas.toDataURL('image/webp', 0.9) }));
                                                        };
                                                        img.src = ev.target.result;
                                                    };
                                                    reader.readAsDataURL(file);
                                                }}
                                                style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : type === 'textarea' ? (
                                <textarea
                                    className="form-textarea"
                                    rows={4}
                                    placeholder={placeholder}
                                    value={config[clave] || ''}
                                    onChange={(e) => setConfig({ ...config, [clave]: e.target.value })}
                                    style={{ borderRadius: 12, border: '1px solid var(--color-border)', padding: '12px 16px', fontSize: '0.95rem', width: '100%', resize: 'vertical' }}
                                />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <input
                                        className="form-input"
                                        type={type === 'password' ? (revealedFields[clave] ? 'text' : 'password') : type}
                                        placeholder={placeholder}
                                        value={config[clave] || (type === 'color' ? '#1a73e8' : '')}
                                        onChange={(e) => setConfig({ ...config, [clave]: e.target.value })}
                                        style={{ 
                                            borderRadius: 12, 
                                            border: '1px solid var(--color-border)', 
                                            padding: type === 'color' ? '4px 8px' : '12px 16px', 
                                            fontSize: '0.95rem', 
                                            width: type === 'color' ? '80px' : '100%',
                                            height: type === 'color' ? '48px' : 'auto',
                                            background: clave.includes('token') || clave.includes('key') ? 'var(--color-bg-hover)' : 'var(--color-bg-elevated)',
                                            fontFamily: clave.includes('token') || clave.includes('key') ? 'monospace' : 'inherit',
                                            cursor: type === 'color' ? 'pointer' : 'text'
                                        }}
                                    />
                                    {type === 'color' && (
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                            {config[clave] || '#1a73e8'}
                                        </span>
                                    )}
                                    {type === 'password' && (
                                        <button
                                            type="button"
                                            onClick={() => setRevealedFields(prev => ({ ...prev, [clave]: !prev[clave] }))}
                                            title={revealedFields[clave] ? 'Ocultar' : 'Revelar'}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--color-text-secondary)', fontSize: '1.1rem',
                                                padding: '4px 8px', borderRadius: 8, flexShrink: 0,
                                                transition: 'color 0.2s'
                                            }}
                                        >
                                            {revealedFields[clave] ? '🙈' : '👁️'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ============================================
                   ELITE META ADS INTEGRATION (OAuth 2.0)
                   ============================================ */}
                <div style={{ gridColumn: '1 / -1', marginTop: 32 }}>
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 4 }}>🔵 Integración Meta Ads (API Oficial)</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0 }}>Vincula tu cuenta para descargar leads de Facebook e Instagram y enviarlos automáticamente a las secuencias de seguimiento.</p>
                    </div>

                    <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 16, border: '1px solid var(--color-border)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700 }}>Autorización Segura (OAuth 2.0)</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Da acceso de solo lectura para conectar tus formularios.</p>
                            </div>
                            <button type="button" onClick={handleMetaLogin} disabled={isMetaLoading} style={{
                                background: '#1877F2', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                            }}>
                                {isMetaLoading ? 'Conectando...' : 'Conectar con Facebook'}
                            </button>
                        </div>
                        {config.meta_page_id && (
                            <div style={{ padding: '12px 16px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: 8, border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
                                ✅ Página activa conectada bajo el ID Numérico: {config.meta_page_id}
                            </div>
                        )}
                        
                        {/* Selector de Fanpages */}
                        {fbPages.length > 0 && (
                            <div style={{ marginTop: 16, padding: 16, border: '1px solid #1877F2', borderRadius: 12, background: 'rgba(24, 119, 242, 0.05)' }}>
                                <h5 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Selecciona tu Página Comercial (Fanpage):</h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {fbPages.map(p => (
                                        <button key={p.id} type="button" onClick={() => selectFbPage(p)} style={{
                                            padding: '12px 16px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontWeight: 600, transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between'
                                        }} onMouseOver={e => e.currentTarget.style.borderColor = '#1877F2'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                                            <span style={{color: '#000'}}>📄 {p.name}</span>
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{p.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================
                   ELITE EMAIL PROVIDER SELECTOR
                   ============================================ */}
                <div style={{ gridColumn: '1 / -1', marginTop: 32 }}>
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 4 }}>📧 Motor de Correos</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0 }}>Elige qué proveedor usará tu sistema para enviar emails manuales y automáticos.</p>
                    </div>

                    {/* Provider Toggle Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        {/* Gmail Card */}
                        <div
                            onClick={() => setConfig({ ...config, proveedor_email: 'gmail' })}
                            style={{
                                position: 'relative',
                                padding: '20px 24px',
                                borderRadius: 16,
                                cursor: 'pointer',
                                border: config.proveedor_email === 'gmail'
                                    ? '2px solid #34d399'
                                    : '2px solid var(--color-border)',
                                background: config.proveedor_email === 'gmail'
                                    ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.12), rgba(16, 185, 129, 0.06))'
                                    : 'var(--color-bg-elevated)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: config.proveedor_email === 'gmail' ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: config.proveedor_email === 'gmail'
                                    ? '0 8px 32px rgba(52, 211, 153, 0.2)'
                                    : '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                        >
                            {config.proveedor_email === 'gmail' && (
                                <div style={{
                                    position: 'absolute', top: 12, right: 14,
                                    background: '#34d399', color: '#fff', borderRadius: 20,
                                    padding: '3px 10px', fontSize: '0.7rem', fontWeight: 800,
                                    letterSpacing: '0.5px', textTransform: 'uppercase'
                                }}>✓ ACTIVO</div>
                            )}
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>Gmail SMTP</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                Usa tu cuenta de Gmail para enviar correos. Gratis, ideal para empezar. Requiere Contraseña de Aplicación.
                            </div>
                        </div>

                        {/* Resend Card */}
                        <div
                            onClick={() => setConfig({ ...config, proveedor_email: 'resend' })}
                            style={{
                                position: 'relative',
                                padding: '20px 24px',
                                borderRadius: 16,
                                cursor: 'pointer',
                                border: config.proveedor_email === 'resend'
                                    ? '2px solid #818cf8'
                                    : '2px solid var(--color-border)',
                                background: config.proveedor_email === 'resend'
                                    ? 'linear-gradient(135deg, rgba(129, 140, 248, 0.12), rgba(99, 102, 241, 0.06))'
                                    : 'var(--color-bg-elevated)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: config.proveedor_email === 'resend' ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: config.proveedor_email === 'resend'
                                    ? '0 8px 32px rgba(129, 140, 248, 0.2)'
                                    : '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                        >
                            {config.proveedor_email === 'resend' && (
                                <div style={{
                                    position: 'absolute', top: 12, right: 14,
                                    background: '#818cf8', color: '#fff', borderRadius: 20,
                                    padding: '3px 10px', fontSize: '0.7rem', fontWeight: 800,
                                    letterSpacing: '0.5px', textTransform: 'uppercase'
                                }}>✓ ACTIVO</div>
                            )}
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🚀</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>Resend API</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                Para dominios propios. Deliverability profesional. Requiere dominio verificado en resend.com.
                            </div>
                        </div>
                    </div>

                    {/* Credential Fields — Always Visible */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px',
                        padding: 24, borderRadius: 16,
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)'
                    }}>
                        {/* Gmail Credentials */}
                        <div style={{ opacity: config.proveedor_email === 'resend' ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                            <label className="form-label" style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                🗝️ Contraseña de App Google (Obligatorio)
                                {config.proveedor_email === 'gmail' && <span style={{ background: '#34d399', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 800 }}>REQUERIDO</span>}
                            </label>

                            {config.proveedor_email === 'gmail' && !config.gmail_app_password && (
                                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: '#1d4ed8', fontSize: '0.88rem', fontWeight: 800 }}>⚠️ No es tu clave normal de Gmail</h4>
                                    <p style={{ margin: '0 0 12px 0', color: 'var(--color-text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                        Google no nos permite entrar directo. Para que el Autopilot funcione, necesitas habilitar "Verificación en 2 pasos" y crear un código de 16 letras que nos autoriza a enviar correos silenciosamente por ti.
                                    </p>
                                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '8px 14px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}>
                                        Generar Contraseña en Google ➔
                                    </a>
                                </div>
                            )}
                            {config.proveedor_email === 'gmail' && config.gmail_app_password && (
                                <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', color: '#065f46', fontSize: '0.88rem', fontWeight: 800 }}>Credencial de Google Activa</h4>
                                        <p style={{ margin: 0, color: '#064e3b', fontSize: '0.8rem' }}>El Autopilot ya cuenta con una contraseña de aplicación configurada lista para usar. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{color: '#059669', textDecoration: 'underline'}}>Generar una diferente</a> si dejó de funcionar.</p>
                                    </div>
                                </div>
                            )}

                            <input
                                className="form-input"
                                type="password"
                                placeholder="Pega el código de 16 letras aquí..."
                                value={config.gmail_app_password || ''}
                                onChange={(e) => setConfig({ ...config, gmail_app_password: e.target.value })}
                                style={{ 
                                    borderRadius: 12, 
                                    border: config.gmail_app_password?.replace(/\s+/g, '').length === 16 ? '2px solid #34d399' : '2px solid #cbd5e1', 
                                    padding: '14px 16px', fontSize: '1.05rem', width: '100%', fontFamily: 'monospace', background: 'var(--color-bg-hover)' 
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>
                                Si falta esta clave, el sistema de Correos Automáticos NO se activará.
                            </p>
                        </div>

                        {/* Resend Credentials */}
                        <div style={{ opacity: config.proveedor_email === 'gmail' ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                🚀 Resend API Key
                                {config.proveedor_email === 'resend' && <span style={{ background: '#818cf8', color: '#fff', borderRadius: 12, padding: '1px 8px', fontSize: '0.65rem', fontWeight: 800 }}>EN USO</span>}
                            </label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="re_XXXXX..."
                                value={config.resend_api_key || ''}
                                onChange={(e) => setConfig({ ...config, resend_api_key: e.target.value })}
                                style={{ borderRadius: 12, border: '1px solid var(--color-border)', padding: '12px 16px', fontSize: '0.95rem', width: '100%', fontFamily: 'monospace', background: 'var(--color-bg-hover)' }}
                            />
                            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                                Obtén tu key en resend.com/api-keys
                            </p>
                        </div>

                        {/* Email Remitente — Full Width */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8, display: 'block' }}>
                                ✉️ Email Remitente {config.proveedor_email === 'gmail' ? '(tu cuenta Gmail, ej: tú@gmail.com)' : '(tu dominio verificado, ej: info@tudominio.com)'}
                            </label>
                            <input
                                className="form-input"
                                type="email"
                                placeholder={config.proveedor_email === 'gmail' ? 'tu@gmail.com' : 'ventas@tudominio.com'}
                                value={config.email_remitente || ''}
                                onChange={(e) => setConfig({ ...config, email_remitente: e.target.value })}
                                style={{ borderRadius: 12, border: '1px solid var(--color-border)', padding: '12px 16px', fontSize: '0.95rem', width: '100%', background: 'var(--color-bg-elevated)' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 24, padding: 16, background: 'var(--color-bg-hover)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>🔗 ¿Cómo usar el Webhook API Key para Leads Externos?</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                        Configura Zapier, Make o tu Chatbot para enviar una petición <strong>POST</strong> a tu base de datos y cruzar con tus Drip Campaigns.
                    </p>
                    <div style={{ background: '#1e1e1e', padding: 12, borderRadius: 6, color: '#d4d4d4', fontFamily: 'monospace', fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                        URL: (Tu URL de Supabase)/rest/v1/rpc/ingresar_lead_webhook{'\n'}
                        Headers:{'\n'}
                        Content-Type: application/json{'\n'}
                        apikey: (Tu Supabase Anon Key){'\n'}
                        {'\n'}
                        Body:{'\n'}
                        {'{'}{'\n'}
                        {"  \"p_agencia_id\": \"(Mismo ID en URL de Dashboard)\","}{'\n'}
                        {"  \"p_api_secret\": \"(Tu Webhook API Key Guardado)\","}{'\n'}
                        {"  \"p_nombre\": \"Nombre\","}{'\n'}
                        {"  \"p_email\": \"Email\","}{'\n'}
                        {"  \"p_telefono\": \"Teléfono\","}{'\n'}
                        {"  \"p_origen\": \"Ej: ManyChat, Facebook Leads\""}{'\n'}
                        {'}'}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar Configuración'}
                    </button>
                </div>
            </form>
        </div>
    )
}

/* ==========================================
   TAB 2: Plantillas de Email
   ========================================== */

