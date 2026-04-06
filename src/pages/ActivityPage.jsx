import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, CheckCircle2, XCircle, Bot, MailCheck, Activity } from 'lucide-react';
import '../styles/ActivityPage.css';

export default function ActivityPage() {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [activePilots, setActivePilots] = useState(0);
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch logs (email_log table)
            const { data: logData, error: logErr } = await supabase
                .from('email_log')
                .select(`
                    id,
                    created_at,
                    tipo,
                    estado,
                    email_enviado,
                    mensaje_error,
                    lead_id,
                    lead:leads(nombre, email, tour_nombre, unsubscribed)
                `)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (logErr) throw logErr;

            // Fetch Auto-Pilots (leads_secuencias table)
            const { data: pilots, error: pErr } = await supabase
                .from('leads_secuencias')
                .select('id')
                .in('estado', ['en_progreso', 'nuevo']);
            
            if (pErr) throw pErr;

            setActivePilots(pilots?.length || 0);
            setLogs(logData || []);

        } catch (e) {
            console.error('Error fetching activity:', e);
        } finally {
            setLoading(false);
        }
    };

    // Calculate metrics
    const totalSent = logs.filter(l => l.estado === 'enviado').length;
    const totalFailed = logs.filter(l => l.estado === 'fallido').length;
    
    // Auto vs Manual based on the logs retrieved
    const totalAuto = logs.filter(l => l.tipo !== 'manual').length;

    return (
        <div className="activity-page dashboard-pwa-container fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title"><Activity className="icon-emerald glow-icon" size={28} /> Radar Elite</h1>
                    <p className="page-subtitle">Comando central de operaciones de marketing y correos</p>
                </div>
            </header>

            <div className="kpi-grid">
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-emerald">
                        <MailCheck size={24} />
                    </div>
                    <div className="kpi-content">
                        <h3>{totalSent}</h3>
                        <p>Enviados (recientes)</p>
                    </div>
                </div>
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-blue">
                        <Bot size={24} />
                    </div>
                    <div className="kpi-content">
                        <h3>{activePilots}</h3>
                        <p>Leads en Autopilot</p>
                    </div>
                </div>
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-primary">
                        <Mail size={24} />
                    </div>
                    <div className="kpi-content">
                        <h3>{totalAuto}</h3>
                        <p>Impactos Automáticos</p>
                    </div>
                </div>
                <div className="kpi-card glass-card">
                    <div className="kpi-icon-wrapper bg-red">
                        <XCircle size={24} />
                    </div>
                    <div className="kpi-content">
                        <h3>{totalFailed}</h3>
                        <p>Errores o Rebotes</p>
                    </div>
                </div>
            </div>

            <div className="timeline-container glass-card">
                <div className="timeline-header">
                    <h2>Live Feed (Timeline de Correos)</h2>
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
                                <div key={log.id} className={`feed-item ${log.estado === 'fallido' ? 'state-failed' : 'state-success'}`}>
                                    <div className="feed-icon">
                                        {log.estado === 'fallido' ? <XCircle size={20} className="text-red" /> : <CheckCircle2 size={20} className="text-emerald" />}
                                    </div>
                                    <div className="feed-details">
                                        <div className="feed-title">
                                            <strong style={{textTransform: 'capitalize'}}>{log.lead?.nombre || 'Lead Desconocido'}</strong> 
                                            <span className="feed-tour">({log.lead?.tour_nombre || 'Sin tour'})</span>
                                            {log.lead?.unsubscribed && <span className="feed-badge-unsub">🚫 Unsub</span>}
                                        </div>
                                        <div className="feed-meta">
                                            {log.tipo === 'manual' ? (
                                                <span className="pill pill-manual"><Mail size={12}/> Manual</span>
                                            ) : (
                                                <span className="pill pill-auto"><Bot size={12}/> Autopilot</span>
                                            )}
                                            <span className="feed-time">{new Date(log.created_at).toLocaleString()}</span>
                                            <span className="feed-email">{log.lead?.email || log.email_enviado}</span>
                                        </div>
                                        {log.estado === 'fallido' && (
                                            <div className="feed-error-log">
                                                <code>{log.mensaje_error}</code>
                                            </div>
                                        )}
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
                                    <strong>SMTP <span style={{color: '#a78bfa'}}>(Gmail / Principal)</span></strong>
                                </div>
                                <div className="xray-box">
                                    <span className="xray-label">Estado</span>
                                    {selectedLog.estado === 'fallido' ? 
                                        <div className="pill pill-failed">❌ {selectedLog.estado.toUpperCase()}</div>
                                        : <div className="pill pill-success">✅ {selectedLog.estado.toUpperCase()}</div>
                                    }
                                </div>
                            </div>

                            {selectedLog.estado === 'fallido' && (
                                <div className="xray-error-container">
                                    <h3>Server Error Trace</h3>
                                    <pre className="xray-error-code">{selectedLog.mensaje_error}</pre>
                                </div>
                            )}


                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
