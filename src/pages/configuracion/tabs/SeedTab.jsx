import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import ConfirmModal from '../../../components/leads/modals/ConfirmModal';
import { seedAllData } from '../../../lib/seedData';
export default function SeedTab({ showToast }) {
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState(null)
    const [confirmDialog, setConfirmDialog] = useState(null)

    async function handleSeed() {
        setConfirmDialog({
            title: 'Cargar Datos Iniciales (G-Sheet)',
            message: '¿Cargar datos iniciales del Google Sheet?\n\nEsto insertará productos, asesores, leads y ventas de ejemplo. Si ya existen datos, se agregarán registros adicionales.',
            danger: true,
            confirmLabel: '📥 Cargar',
            onConfirm: async () => {
                setConfirmDialog(null)
                setLoading(true)
                try {
                    const res = await seedAllData()
                    setResults(res)
                    if (res.errors.length === 0) {
                        showToast(`✅ Cargados: ${res.productos} productos, ${res.asesores} ops, ${res.leads} leads, ${res.ventas} revs, ${res.plantillas_email} tpls email, ${res.plantillas_wa} tpls wa`)
                    } else {
                        showToast('Algunos datos se cargaron con advertencias', 'error')
                    }
                } catch (err) {
                    console.error(err)
                    showToast('Error en la carga: ' + err.message, 'error')
                } finally {
                    setLoading(false)
                }
            }
        })
    }

    return (
        <div className="card" style={{ maxWidth: 600 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>📥 Cargar Datos del Google Sheet</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>
                Este botón inserta automáticamente los datos base de tu operación:<br />
                <strong>14 productos</strong> (Salkantay, Inka Jungle, Inca Trail, Valle Sagrado, etc.),<br />
                <strong>6 asesores</strong>, <strong>10 leads de ejemplo</strong>, <strong>6 ventas</strong>,<br />
                y <strong>12 plantillas</strong> (Email y WhatsApp para Cotización, Confirmación y Recordatorio).<br />
                Toda la información proviene de tu Google Sheet original.
            </p>
            <button
                className="btn btn-primary"
                onClick={handleSeed}
                disabled={loading}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
            >
                {loading ? '⏳ Insertando datos...' : '🚀 Cargar Todos los Datos Iniciales'}
            </button>

            {results && (
                <div style={{ marginTop: 20, padding: 16, background: 'var(--color-bg-elevated)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: 'var(--color-success)' }}>Resultado de la carga:</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div style={{ padding: 10, background: 'var(--color-bg-card)', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{results.productos}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Productos</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--color-bg-card)', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{results.asesores}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Asesores</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--color-bg-card)', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{results.leads}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Leads</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--color-bg-card)', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{results.ventas}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Ventas</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--color-bg-card)', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{results.plantillas_email || 0}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Plantillas Email</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--color-bg-card)', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{results.plantillas_wa || 0}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Plantillas WA</div>
                        </div>
                    </div>
                    {results.errors.length > 0 && (
                        <div style={{ marginTop: 12, padding: 10, background: 'var(--color-danger-soft)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                            <strong>Errores:</strong><br />
                            {results.errors.map((e, i) => <div key={i}>• {e}</div>)}
                        </div>
                    )}
                </div>
            )}

            <ConfirmModal 
                isOpen={!!confirmDialog}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                danger={confirmDialog?.danger}
                confirmLabel={confirmDialog?.confirmLabel}
                onConfirm={confirmDialog?.onConfirm}
                onClose={() => setConfirmDialog(null)}
            />
        </div>
    )
}

/* ==========================================
   TAB 5: Backup & Respaldo a Google Drive
   ========================================== */
