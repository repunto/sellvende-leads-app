import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, CheckCircle2, XCircle, Bot, MailCheck, Activity, AlertTriangle, Upload } from 'lucide-react';
import '../styles/ActivityPage.css';

export default function ActivityPage() {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [failedLogs, setFailedLogs] = useState([]);
    const [activePilots, setActivePilots] = useState(0);
    const [totalPilots, setTotalPilots] = useState(0);
    const [stats, setStats] = useState({ sent: 0, failed: 0, auto: 0 });
    const [selectedLog, setSelectedLog] = useState(null);
    const [breakdown, setBreakdown] = useState({});
    const [isLive, setIsLive] = useState(false);

    // ── Mass Bounce Import Tool ──────────────────────────────
    const [showBounceImport, setShowBounceImport] = useState(false);
    const [bounceEmails, setBounceEmails] = useState('');
    const [importingBounces, setImportingBounces] = useState(false);
    const [importResult, setImportResult] = useState(null);

    useEffect(() => {
        loadDashboardData();

        const channel = supabase
            .channel('radar-email-logs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'email_log' }, () => {
                loadDashboardData(true);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsLive(true);
                else setIsLive(false);
            });

        return () => { supabase.removeChannel(channel); };
    }, []);

    const loadDashboardData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Fetch ALL logs for breakdown (up to 1000)
            const { data: logData, error: logErr } = await supabase
                .from('email_log')
                .select(`
                    id, created_at, tipo, estado, email_enviado, mensaje_error,
                    lead_id, asunto,
                    lead:leads(nombre, email, tour_nombre, form_name, unsubscribed)
                `)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (logErr) throw logErr;

            // Build desglose by tour+step
            const bd = {};
            (logData || []).forEach(log => {
                if (log.estado !== 'enviado') return;
                let tour = log.lead?.tour_nombre || log.lead?.form_name || 'Sin Tour';
                if (tour.includes(' - ')) tour = tour.split(' - ')[0].trim();
                if (tour.toLowerCase().includes('inka jungle')) tour = 'Inka Jungle';
                else if (tour.toLowerCase().includes('salkantay')) tour = 'Salkantay';
                else tour = tour.charAt(0).toUpperCase() + tour.slice(1).toLowerCase();

                let stepName = log.asunto || 'Paso Regular';
                if (stepName.includes('aventura de tu vida')) stepName = 'Email 1: Bienvenida e Itinerario';
                if (stepName.includes('Cotización')) stepName = 'Secuencia Original Salkantay (Manual/Antigua)';

                if (!bd[tour]) bd[tour] = { total: 0, steps: {} };
                bd[tour].total += 1;
                bd[tour].steps[stepName] = (bd[tour].steps[stepName] || 0) + 1;
            });
            setBreakdown(bd);

            // Separate: recent feed (success) + failed logs
            const allFailed = (logData || []).filter(l => l.estado === 'fallido' || l.estado === 'rebotado');
            setFailedLogs(allFailed.slice(0, 100));
            setLogs((logData || []).filter(l => l.estado === 'enviado').slice(0, 50));

            // Autopilot counts
            const { data: pilots } = await supabase.from('leads_secuencias').select('id, estado');
            const actPilots = pilots?.filter(p => p.estado === 'en_progreso' || p.estado === 'nuevo').length || 0;
            setActivePilots(actPilots);
            setTotalPilots(pilots?.length || 0);

            // Real counts from DB
            const [resSent, resFailed, resAuto] = await Promise.all([
                supabase.from('email_log').select('*', { count: 'exact', head: true }).eq('estado', 'enviado'),
                supabase.from('email_log').select('*', { count: 'exact', head: true }).in('estado', ['fallido', 'rebotado']),
                supabase.from('email_log').select('*', { count: 'exact', head: true }).neq('tipo', 'manual'),
            ]);

            setStats({
                sent: resSent.count || 0,
                failed: resFailed.count || 0,
                auto: resAuto.count || 0,
            });

        } catch (e) {
            console.error('Error fetching activity:', e);
        } finally {
            setLoading(false);
        }
    };

    // ── Mass Bounce Import Handler ───────────────────────────
    const handleBounceImport = useCallback(async () => {
        const emails = bounceEmails
            .split(/[\n,;]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e.includes('@') && e.length > 4);

        if (emails.length === 0) {
            setImportResult({ error: 'No se encontraron emails válidos en el texto ingresado.' });
            return;
        }

        setImportingBounces(true);
        setImportResult(null);

        try {
            // 1. Find leads matching these emails
            const { data: matchedLeads, error: findErr } = await supabase
                .from('leads')
                .select('id, email, nombre, agencia_id')
                .in('email', emails);

            if (findErr) throw findErr;

            if (!matchedLeads || matchedLeads.length === 0) {
                setImportResult({ error: 'Ninguno de los emails ingresados coincide con leads en la base de datos.' });
                return;
            }

            const leadIds = matchedLeads.map(l => l.id);

            // 2. Mark them all as bounced + log
            const [updateRes, seqRes] = await Promise.allSettled([
                supabase.from('leads').update({
                    email_rebotado: true,
                    estado: 'correo_falso',
                    motivo_rebote: 'Hard Bounce Gmail (importado manualmente desde inbox)',
                    fecha_rebote: new Date().toISOString(),
                }).in('id', leadIds),
                supabase.from('leads_secuencias')
                    .update({ estado: 'cancelada' })
                    .in('lead_id', leadIds)
                    .in('estado', ['en_progreso', 'pausado']),
            ]);

            // 3. Batch insert email_log entries for traceability
            const logEntries = matchedLeads.map(lead => ({
                agencia_id: lead.agencia_id,
                lead_id: lead.id,
                tipo: 'bounce',
                email_enviado: lead.email,
                asunto: '[REBOTE MANUAL] Hard Bounce Gmail — importado desde bandeja',
                estado: 'rebotado',
                mensaje_error: 'Importación masiva de rebotes detectados en bandeja Gmail del remitente.',
            }));

            await supabase.from('email_log').insert(logEntries);

            const notFound = emails.filter(e => !matchedLeads.find(l => l.email === e));
            setImportResult({
                success: true,
                marked: matchedLeads.length,
                notFound,
            });

            // Refresh data
            setTimeout(() => loadDashboardData(true), 1000);

        } catch (err) {
            setImportResult({ error: err.message });
        } finally {
            setImportingBounces(false);
        }
    }, [bounceEmails]);

    const errorTypeLabel = (log) => {
        const body = (log.mensaje_error || '').toLowerCase();
        if (/550|5\.1\.[12]|nosuchuser|does not exist|no such/.test(body)) return { label: '🔴 Hard Bounce (550)', color: '#ef4444' };
        if (/spam|complaint/.test(body)) return { label: '🚫 Complaint (Spam)', color: '#f97316' };
        if (/timeout|connection|network/.test(body)) return { label: '⏱ Timeout SMTP', color: '#a78bfa' };
        if (/rebotado|bounce/.test(log.estado)) return { label: '⛔ Rebote Resend', color: '#ef4444' };
        return { label: '⚠️ Error de Envío', color: '#eab308' };
    };

    return (
        <div className="activity-page dashboard-pwa-container fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title"><Activity className="icon-emerald glow-icon" size={28} /> Radar Elite</h1>
                    <p className="page-subtitle">Comando central de operaciones de marketing y correos</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {isLive && (
                        <div className="live-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: '600', fontSize: '0.9rem', padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}></div>
                            EN VIVO
                        </div>
                    )}
                    <button
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderColor: stats.failed > 0 ? '#ef4444' : undefined, color: stats.failed > 0 ? '#ef4444' : undefined }}
                        onClick={() => setShowBounceImport(true)}
                    >
                        <Upload size={14} /> Importar Rebotes Gmail
                    </button>
                </div>
            </header>

            {/* KPIs */}
            <div className="kpi-grid">
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-emerald"><MailCheck size={24} /></div>
                    <div className="kpi-content">
                        <h3>{stats.sent}</h3>
                        <p>Total Enviados</p>
                    </div>
                </div>
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-blue"><Bot size={24} /></div>
                    <div className="kpi-content">
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <h3>{activePilots}</h3>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>/ {totalPilots} enrolados</span>
                        </div>
                        <p>Leads en Autopilot (Activos)</p>
                    </div>
                </div>
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-primary"><Mail size={24} /></div>
                    <div className="kpi-content">
                        <h3>{stats.auto}</h3>
                        <p>Impactos Secuencia</p>
                    </div>
                </div>
                <div className="kpi-card glass-card" style={{ cursor: stats.failed > 0 ? 'pointer' : 'default' }} onClick={() => stats.failed > 0 && document.getElementById('fallos-panel')?.scrollIntoView({ behavior: 'smooth' })}>
                    <div className="kpi-icon-wrapper bg-red"><XCircle size={24} /></div>
                    <div className="kpi-content">
                        <h3 style={{ color: stats.failed > 0 ? '#ef4444' : undefined }}>{stats.failed}</h3>
                        <p>Errores o Rebotes {stats.failed > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>▼ ver</span>}</p>
                    </div>
                </div>
            </div>

            {/* Desglose por tour */}
            <div className="timeline-container glass-card" style={{ marginBottom: '24px' }}>
                <div className="timeline-header">
                    <h2>Desglose de Envíos Exactos (Por Tour y Paso)</h2>
                </div>
                <div className="timeline-content" style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                        {Object.keys(breakdown).map(tour => (
                            <div key={tour} style={{ background: 'var(--color-bg-hover)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.1rem' }}>{tour}</span>
                                    <span style={{ fontSize: '0.85rem', background: 'var(--color-accent)', padding: '4px 10px', borderRadius: '20px', color: '#fff' }}>{breakdown[tour].total} enviados total</span>
                                </h3>
                                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {Object.keys(breakdown[tour].steps).map(step => (
                                        <li key={step} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={step}>{step}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-bg)', padding: '4px 10px', borderRadius: '6px' }}>{breakdown[tour].steps[step]} envíos</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {Object.keys(breakdown).length === 0 && !loading && (
                            <div style={{ color: 'var(--color-text-secondary)' }}>No hay envíos registrados para desglosar.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Panel de Fallos de Entrega ────────────────────── */}
            <div id="fallos-panel" className="timeline-container glass-card" style={{ marginBottom: '24px', border: failedLogs.length > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--color-border)' }}>
                <div className="timeline-header" style={{ background: failedLogs.length > 0 ? 'rgba(239,68,68,0.07)' : undefined }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                        Fallos de Entrega
                        {failedLogs.length > 0 && (
                            <span style={{ fontSize: '0.8rem', background: '#ef4444', color: '#fff', padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>{stats.failed} total</span>
                        )}
                    </h2>
                    <button className="btn btn-outline" style={{ fontSize: '0.82rem' }} onClick={() => loadDashboardData(true)}>Actualizar</button>
                </div>
                <div className="timeline-content" style={{ padding: '0' }}>
                    {loading ? (
                        <div className="loading-pulse" style={{ padding: '20px' }}>Escaneando fallos...</div>
                    ) : failedLogs.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                            ✅ Sin fallos detectados automáticamente.
                            <div style={{ marginTop: '8px', fontSize: '0.82rem', opacity: 0.7 }}>Los fallos futuros de SMTP y Resend aparecerán aquí en tiempo real.</div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-hover)' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Lead / Email</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Tipo de Error</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Detalle</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Fecha</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Acc.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {failedLogs.map(log => {
                                    const errType = errorTypeLabel(log);
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{log.lead?.nombre || '—'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{log.email_enviado || log.lead?.email}</div>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: errType.color }}>{errType.label}</span>
                                            </td>
                                            <td style={{ padding: '10px 16px', maxWidth: '260px' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.mensaje_error || log.asunto}>
                                                    {log.mensaje_error || log.asunto || '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                {new Date(log.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                <button className="btn-xray" onClick={() => setSelectedLog(log)}>X-Ray</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Live Feed — Enviados */}
            <div className="timeline-container glass-card">
                <div className="timeline-header">
                    <h2>Live Feed (Enviados Recientes)</h2>
                    <button className="btn btn-outline" onClick={loadDashboardData}>Actualizar Radar</button>
                </div>
                <div className="timeline-content">
                    {loading ? (
                        <div className="loading-pulse">Escaneando logs globales...</div>
                    ) : logs.length === 0 ? (
                        <div className="empty-state">No se ha registrado ninguna matriz de envíos recientemente.</div>
                    ) : (
                        <div className="feed-list">
                            {logs.map((log) => (
                                <div key={log.id} className="feed-item state-success">
                                    <div className="feed-icon"><CheckCircle2 size={20} className="text-emerald" /></div>
                                    <div className="feed-details">
                                        <div className="feed-title">
                                            <strong style={{ textTransform: 'capitalize' }}>{log.lead?.nombre || 'Lead Desconocido'}</strong>
                                            <span className="feed-tour"> ({log.lead?.tour_nombre || 'Sin tour'})</span>
                                            {log.lead?.unsubscribed && <span className="feed-badge-unsub">🚫 Unsub</span>}
                                        </div>
                                        <div className="feed-meta">
                                            {log.tipo === 'manual' ? (
                                                <span className="pill pill-manual"><Mail size={12} /> Manual</span>
                                            ) : (
                                                <span className="pill pill-auto"><Bot size={12} /> Autopilot</span>
                                            )}
                                            <span className="feed-time">{new Date(log.created_at).toLocaleString()}</span>
                                            <span className="feed-email">{log.lead?.email || log.email_enviado}</span>
                                        </div>
                                    </div>
                                    <div className="feed-action">
                                        <button className="btn-xray" onClick={() => setSelectedLog(log)}>X-Ray</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal: Importar Rebotes de Gmail ─────────────── */}
            {showBounceImport && (
                <div className="xray-modal-overlay fade-in" onClick={() => { setShowBounceImport(false); setImportResult(null); setBounceEmails(''); }}>
                    <div className="xray-modal-content slide-up" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                        <div className="xray-modal-header">
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Upload size={20} style={{ color: '#ef4444' }} /> Importar Rebotes de Gmail</h2>
                                <p className="xray-meta">Pega los emails que viste como "Delivery Failure" en tu bandeja de Gmail. El sistema los marcará como <strong>correo_falso</strong> y cancelará sus secuencias.</p>
                            </div>
                            <button className="xray-close-btn" onClick={() => { setShowBounceImport(false); setImportResult(null); setBounceEmails(''); }}>✕</button>
                        </div>
                        <div className="xray-modal-body">
                            <textarea
                                value={bounceEmails}
                                onChange={e => { setBounceEmails(e.target.value); setImportResult(null); }}
                                placeholder={`orellaleyton@gmail.com\nmuozdalma@yahoo.com\nfsnny.mvalenzuela@gmail.com\nkevinfp17@glail.com\n...`}
                                style={{
                                    width: '100%', minHeight: '180px', padding: '12px', borderRadius: '10px',
                                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                    color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '0.875rem',
                                    resize: 'vertical', boxSizing: 'border-box', outline: 'none',
                                }}
                            />
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '8px 0 16px' }}>
                                💡 Puedes pegar uno por línea, o separados por comas o punto y coma.
                            </div>

                            {importResult && (
                                <div style={{
                                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
                                    background: importResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                    border: `1px solid ${importResult.error ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                                    fontSize: '0.875rem',
                                }}>
                                    {importResult.error ? (
                                        <span style={{ color: '#ef4444' }}>❌ {importResult.error}</span>
                                    ) : (
                                        <div>
                                            <div style={{ color: '#22c55e', fontWeight: 600 }}>✅ {importResult.marked} leads marcados como rebotados y secuencias canceladas.</div>
                                            {importResult.notFound?.length > 0 && (
                                                <div style={{ color: 'var(--color-text-secondary)', marginTop: '8px', fontSize: '0.8rem' }}>
                                                    ⚠️ {importResult.notFound.length} email(s) no encontrados en el sistema: {importResult.notFound.slice(0, 5).join(', ')}{importResult.notFound.length > 5 ? ` y ${importResult.notFound.length - 5} más...` : ''}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline" onClick={() => { setShowBounceImport(false); setImportResult(null); setBounceEmails(''); }}>
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    disabled={importingBounces || !bounceEmails.trim()}
                                    onClick={handleBounceImport}
                                    style={{ background: '#ef4444', borderColor: '#ef4444' }}
                                >
                                    {importingBounces ? '⏳ Procesando...' : `🚫 Marcar Rebotes`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* X-Ray Inspector Modal */}
            {selectedLog && (
                <div className="xray-modal-overlay fade-in" onClick={() => setSelectedLog(null)}>
                    <div className="xray-modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="xray-modal-header">
                            <div>
                                <h2>Inspección de Impacto (X-Ray)</h2>
                                <p className="xray-meta">Registro ID: {selectedLog.id} • {new Date(selectedLog.created_at).toLocaleString()}</p>
                            </div>
                            <button className="xray-close-btn" onClick={() => setSelectedLog(null)}>✕</button>
                        </div>
                        <div className="xray-modal-body">
                            <div className="xray-grid">
                                <div className="xray-box">
                                    <span className="xray-label">Destinatario</span>
                                    <strong>{selectedLog.lead?.nombre} &lt;{selectedLog.lead?.email || selectedLog.email_enviado}&gt;</strong>
                                </div>
                                <div className="xray-box">
                                    <span className="xray-label">Tour</span>
                                    <strong>{selectedLog.lead?.tour_nombre || 'N/A'}</strong>
                                </div>
                                <div className="xray-box">
                                    <span className="xray-label">Canal del Servidor</span>
                                    <strong>SMTP <span style={{ color: '#a78bfa' }}>(Gmail)</span></strong>
                                </div>
                                <div className="xray-box">
                                    <span className="xray-label">Estado</span>
                                    {selectedLog.estado === 'fallido' || selectedLog.estado === 'rebotado' ?
                                        <div className="pill pill-failed">❌ {selectedLog.estado.toUpperCase()}</div>
                                        : <div className="pill pill-success">✅ {selectedLog.estado.toUpperCase()}</div>
                                    }
                                </div>
                            </div>
                            {(selectedLog.estado === 'fallido' || selectedLog.estado === 'rebotado') && (
                                <div className="xray-error-container">
                                    <h3>Server Error Trace</h3>
                                    <pre className="xray-error-code">{selectedLog.mensaje_error || selectedLog.asunto || 'Sin detalles de error disponibles.'}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
