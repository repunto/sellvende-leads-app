import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function IntegracionesTab({ showToast, agencia }) {
    const [config, setConfig] = useState({})
    const [originalConfig, setOriginalConfig] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (agencia?.id) {
            fetchConfig()
        }
    }, [agencia])

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

            <div className="card" style={{ padding: '24px' }}>
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
