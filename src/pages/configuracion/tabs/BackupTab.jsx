import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
export default function BackupTab({ showToast, agencia }) {
    const [webhook, setWebhook] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [backingUp, setBackingUp] = useState(false)

    useEffect(() => { loadWebhook() }, [])

    async function loadWebhook() {
        setLoading(true)
        const { data } = await supabase.from('configuracion').select('valor').eq('clave', 'backup_webhook_url').single()
        if (data && data.valor) setWebhook(data.valor)
        setLoading(false)
    }

    async function handleSaveWebhook() {
        if (!agencia) return
        setSaving(true)
        try {
            const { error } = await supabase.from('configuracion')
                .upsert({ agencia_id: agencia.id, clave: 'backup_webhook_url', valor: webhook }, { onConflict: 'agencia_id,clave' })
            if (error) throw error
            showToast('Webhook guardado exitosamente')
        } catch (err) {
            showToast('Error al guardar: ' + err.message, 'error')
        }
        setSaving(false)
    }

    async function handleRunBackup() {
        if (!webhook) {
            showToast('⚠️ Primero debes pegar tu Enlace Webhook en la caja de arriba.', 'error')
            return
        }
        setBackingUp(true)
        showToast('Extrayendo toda la base de datos... Por favor espera.')
        try {
            // 1. Extraer todas las tablas críticas
            const [leads, ventas, productos, opciones] = await Promise.all([
                supabase.from('leads').select('*').order('created_at', { ascending: false }),
                supabase.from('ventas').select('*').order('created_at', { ascending: false }),
                supabase.from('productos').select('*').order('created_at', { ascending: false }),
                supabase.from('extras').select('*').order('created_at', { ascending: false })
            ])

            if (leads.error) throw leads.error
            if (ventas.error) throw ventas.error
            if (productos.error) throw productos.error
            if (opciones.error) throw opciones.error

            const payload = {
                leads: leads.data || [],
                ventas: ventas.data || [],
                productos: productos.data || [],
                extras: opciones.data || []
            }

            // 2. Disparar a Google Drive
            showToast('Subiendo información maestra a tu Google Drive...')
            const response = await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }, // CORS bypass
                body: JSON.stringify(payload)
            })

            const result = await response.json()
            if (result && result.status === 'success') {
                showToast('✅ ¡Respaldo completado! Revisa tu Google Drive.', 'success')
            } else {
                showToast('❌ Error devuelto por Google: ' + (result?.message || 'Desconocido. Revisa si actualizaste tu enlace.'), 'error')
            }
        } catch (err) {
            console.error('Backup error:', err)
            showToast('Ocurrió un error (¿Seguro que el webhook está bien configurado?): ' + err.message, 'error')
        }
        setBackingUp(false)
    }

    if (loading) return <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Cargando módulo de respaldo…</div>

    return (
        <div className="card" style={{ maxWidth: 900, borderRadius: 24, padding: 32 }}>
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.8rem' }}>☁️</span> Copias de Seguridad en la Nube
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginTop: 8 }}>
                    Conecta tu sistema Sellvende Leads con Google Drive. Genera Documentos de Excel (Google Sheets) masivos con un solo click que contendrán
                    todos tus <strong>Leads, Ventas, Productos y extras.</strong>
                </p>
            </div>

            <div style={{ background: 'var(--color-bg-secondary)', padding: 24, borderRadius: 16, marginBottom: 32, border: '1px solid var(--color-border)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Paso 1: Tu enlace puente (Webhook de Google)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                    Pega aquí la URL secreta generada desde Google Apps Script. Este enlace le da permiso al sistema
                    de inyectar los datos en formato de tabla dentro de tu Google Drive propio de forma libre y gratuita.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                    <input 
                        type="url" 
                        className="form-input" 
                        value={webhook} 
                        onChange={(e) => setWebhook(e.target.value)} 
                        placeholder="https://script.google.com/macros/s/AKfycb..."
                        style={{ flex: 1, margin: 0 }}
                    />
                    <button className="btn btn-secondary" onClick={handleSaveWebhook} disabled={saving}>
                        {saving ? 'Guardando...' : '💾 Guardar Enlace'}
                    </button>
                </div>
            </div>

            <div style={{ background: '#f0fdf4', padding: 24, borderRadius: 16, border: '1px solid #bbf7d0', display: 'flex', gap: 24, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, color: '#166534' }}>Paso 2: Disparar Respaldo Maestro</h3>
                    <p style={{ fontSize: '0.85rem', color: '#15803d', marginBottom: 0 }}>
                        Al hacer click, juntaremos cientos de registros de información desde tu Base de Datos Supabase oficial y en segundos crearemos un nuevo archivo Google Sheet original llamado "Backup_SellvendeLeads" directo en tu unidad.
                    </p>
                </div>
                <button 
                    className="btn btn-primary" 
                    style={{ background: '#16a34a', borderColor: '#16a34a', padding: '16px 24px', fontSize: '1.1rem', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.4)', borderRadius: 12 }}
                    onClick={handleRunBackup}
                    disabled={backingUp}
                >
                    {backingUp ? '⏳ Volcando Datos...' : '🚀 Ejecutar Respaldo Total'}
                </button>
            </div>
        </div>
    )
}
