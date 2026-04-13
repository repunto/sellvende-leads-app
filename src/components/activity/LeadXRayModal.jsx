import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, ShieldAlert, CheckCircle2, AlertTriangle, Play, Pause, FastForward, Activity } from 'lucide-react';

export default function LeadXRayModal({ logItem, onClose }) {
    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState(null);
    const [secuencia, setSecuencia] = useState(null);
    const [emails, setEmails] = useState([]);
    const [error, setError] = useState(null);
    const [expandedEmail, setExpandedEmail] = useState(null);

    useEffect(() => {
        if (!logItem?.lead_id) return;
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logItem]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Lead (Full Info)
            const { data: leadData, error: leadErr } = await supabase
                .from('leads')
                .select('*')
                .eq('id', logItem.lead_id)
                .single();
            if (leadErr) throw leadErr;

            // 2. Fetch Active/Recent Sequence
            const { data: seqData } = await supabase
                .from('leads_secuencias')
                .select(`
                    id, estado, current_step, 
                    secuencias_marketing(nombre, pasos)
                `)
                .eq('lead_id', logItem.lead_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // 3. Fetch Full Email Log History
            const { data: emailsData, error: emailErr } = await supabase
                .from('email_log')
                .select('id, created_at, tipo, asunto, estado, mensaje_error')
                .eq('lead_id', logItem.lead_id)
                .order('created_at', { ascending: false });
            
            if (emailErr) throw emailErr;

            setLead(leadData);
            setSecuencia(seqData || null);
            setEmails(emailsData || []);
        } catch (err) {
            console.error('Error fetching X-Ray data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Build timeline blending System Events & Emails
    const events = [];
    
    if (lead) {
        events.push({
            id: 'evt-created',
            created_at: lead.created_at,
            tipo: 'sistema',
            asunto: `Lead ingresó al CRM`,
            bodyText: `Origen: ${lead.origen || 'Desconocido'} • Campaña: ${lead.utm_campaign || lead.form_name || 'Desconocido'}`,
            color: '#3b82f6'
        });

        if (lead.ultimo_contacto) {
            events.push({
                id: 'evt-contact',
                created_at: lead.ultimo_contacto,
                tipo: 'sistema',
                asunto: `Actualización de Estado`,
                bodyText: `El estado interno del lead se actualizó o registró un nuevo contacto. Estado actual: ${lead.estado.toUpperCase()}`,
                color: '#eab308'
            });
        }
    }

    if (emails) {
        emails.forEach(e => {
            events.push({ ...e, isEmail: true });
        });
    }

    // Sort Descending
    events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return (
        <div className="xray-modal-overlay fade-in" onClick={onClose} style={{ zIndex: 99999 }}>
            <div className="xray-modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', height: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden' }}>
                
                {/* ── HEADER ── */}
                <div style={{ padding: '20px 24px', background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, var(--color-accent) 0%, #c2410c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <Activity size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                X-RAY: {lead ? lead.nombre : logItem.lead?.nombre}
                                {lead?.email_rebotado && <span className="badge" style={{ background: '#ef444420', color: '#ef4444' }}>⛔ REBOTADO</span>}
                                {lead && !lead.email_rebotado && <span className="badge" style={{ background: '#10b98120', color: '#10b981' }}>✅ HEALTHY</span>}
                            </h2>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                {lead?.email || logItem.email_enviado || logItem.lead?.email} • {lead?.telefono || 'Sin Teléfono'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--color-text-secondary)', padding: '4px' }}>✕</button>
                </div>

                {/* ── CONTENT BODY ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {loading ? (
                        <div className="loading-pulse" style={{ padding: '40px', textAlign: 'center' }}>Extrayendo matriz de datos X-Ray...</div>
                    ) : error ? (
                        <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px' }}>
                            Error al cargar X-Ray: {error}
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                {/* ORIGEN UTM */}
                                <div className="card glass-card" style={{ padding: '16px' }}>
                                    <h3 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>🚀 Atribución / Origen</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Campaña:</span>
                                            <strong style={{ fontSize: '0.85rem' }}>{lead?.utm_campaign || lead?.form_name || 'Orgánico'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Source / Medium:</span>
                                            <strong style={{ fontSize: '0.85rem' }}>{lead?.utm_source || 'N/A'} / {lead?.utm_medium || 'N/A'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Producto:</span>
                                            <strong style={{ fontSize: '0.85rem', color: 'var(--color-accent)' }}>{lead?.producto_interes || 'Sin Producto'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* AUTOPILOT ENGINE */}
                                <div className="card glass-card" style={{ padding: '16px', border: secuencia && ['en_progreso', 'nuevo'].includes(secuencia.estado) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-border)' }}>
                                    <h3 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>⚙️ Estato de Autopilot</span>
                                        {secuencia && <span className={`badge badge-${secuencia.estado}`}>{secuencia.estado.replace('_', ' ').toUpperCase()}</span>}
                                    </h3>
                                    {secuencia ? (
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: '8px' }}>
                                                {secuencia.secuencias_marketing?.nombre || 'Secuencia Genérica'}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                                Progreso: <strong>{secuencia.current_step}</strong> / {secuencia.secuencias_marketing?.pasos?.length || '?'} pasos
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                            Ninguna secuencia vinculada.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TIMELINE */}
                            <div className="card glass-card" style={{ padding: '20px', flex: 1 }}>
                                <h3 style={{ fontSize: '0.95rem', marginBottom: '20px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={18} /> Timeline Universal
                                </h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                    {events.map((evt, index) => {
                                        const isLast = index === events.length - 1;
                                        
                                        if (!evt.isEmail) {
                                            // System Event Render
                                            return (
                                                <div key={evt.id} style={{ position: 'relative', paddingLeft: '28px', paddingBottom: isLast ? 0 : '24px' }}>
                                                    {!isLast && <div style={{ position: 'absolute', left: '7px', top: '24px', bottom: 0, width: '2px', background: 'var(--color-border)' }} />}
                                                    <div style={{ position: 'absolute', left: '0', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: evt.color, border: '3px solid var(--color-bg)', zIndex: 2 }} />
                                                    
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {new Date(evt.created_at).toLocaleString('es-PE')} • Evento de Sistema
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>{evt.asunto}</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{evt.bodyText}</div>
                                                </div>
                                            );
                                        }

                                        // Email Log Render
                                        const isExpanded = expandedEmail === evt.id;
                                        const isError = evt.estado === 'fallido' || evt.estado === 'rebotado';
                                        const markerColor = isError ? '#ef4444' : (evt.estado === 'enviado' ? '#10b981' : '#f59e0b');

                                        return (
                                            <div key={evt.id} style={{ position: 'relative', paddingLeft: '28px', paddingBottom: isLast ? 0 : '24px' }}>
                                                {!isLast && <div style={{ position: 'absolute', left: '7px', top: '24px', bottom: 0, width: '2px', background: 'var(--color-border)' }} />}
                                                <div style={{ position: 'absolute', left: '0', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: markerColor, border: '3px solid var(--color-bg)', zIndex: 2 }} />
                                                
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            {new Date(evt.created_at).toLocaleString('es-PE')} • {evt.tipo === 'secuencia' ? '🤖 Autopilot' : (evt.tipo === 'bounce' ? '🚫 Rebote' : '👤 Manual')}
                                                            {' • '}
                                                            <span style={{ color: markerColor, fontWeight: 700 }}>{evt.estado}</span>
                                                        </div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isError ? '#ef4444' : 'var(--color-text)' }}>
                                                            {evt.asunto || '(Sin Asunto)'}
                                                        </div>
                                                    </div>
                                                    {evt.cuerpo && evt.cuerpo.length > 20 && !isError && (
                                                        <button 
                                                            onClick={() => setExpandedEmail(isExpanded ? null : evt.id)}
                                                            className="btn-outline btn-sm"
                                                            style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                                                            {isExpanded ? 'Ocultar' : 'Ver Email'}
                                                        </button>
                                                    )}
                                                </div>

                                                {isError && evt.mensaje_error && (
                                                    <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', borderLeft: '3px solid #ef4444', fontFamily: 'monospace', fontSize: '0.8rem', color: '#fca5a5' }}>
                                                        {evt.mensaje_error}
                                                    </div>
                                                )}

                                                {isExpanded && evt.cuerpo && (
                                                    <div style={{ marginTop: '12px' }}>
                                                        <iframe
                                                            srcDoc={evt.cuerpo}
                                                            style={{ width: '100%', height: '300px', border: '1px solid var(--color-border)', borderRadius: '8px', background: '#fff' }}
                                                            sandbox="allow-same-origin"
                                                            title="Preview"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {events.length === 0 && (
                                        <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                                            No hay eventos registrados en la línea de tiempo.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
