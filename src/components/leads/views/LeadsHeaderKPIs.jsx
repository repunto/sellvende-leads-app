import React from 'react'
import { timeAgo } from '../../../lib/utils'

/**
 * LeadsHeaderKPIs — Server-Data Edition (Sprint H)
 * 
 * KPI data now comes from the `get_leads_kpis` RPC (pre-aggregated in DB).
 * No more local Array.filter() over thousands of leads.
 * 
 * Props:
 *  - kpis        : { total, nuevo, contactado, cotizado, reservado, frios, dado_de_baja }
 *  - lastSync    : Date | null
 *  - setFiltroEstado : (estado: string) => void
 */
const LeadsHeaderKPIs = React.memo(({ kpis = {}, lastSync, setFiltroEstado }) => {
    const {
        total       = 0,
        nuevo       = 0,
        reservado   = 0,
        frios       = 0,
    } = kpis

    const tasaConversion = total > 0 ? ((reservado / total) * 100).toFixed(1) : '0'

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Leads</h1>
                <p className="page-subtitle">
                    Gestiona tus leads y prospectos
                    {lastSync && (
                        <span style={{ marginLeft: 12, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                            🟢 Última sync: {timeAgo(lastSync)}
                        </span>
                    )}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
                {[
                    { label: 'Total Leads', value: total, icon: '👥', color: 'var(--color-accent)', bgColor: 'var(--color-accent-soft)', onClick: () => setFiltroEstado('') },
                    { label: 'Sin Contactar', value: nuevo, icon: '✨', color: 'var(--color-info)', bgColor: 'var(--color-info-soft)', onClick: () => setFiltroEstado('nuevo') },
                    { label: 'Conversión', value: `${tasaConversion}%`, icon: '🎯', color: 'var(--color-success)', bgColor: 'var(--color-success-soft)', onClick: () => setFiltroEstado('reservado') },
                    { label: 'Leads Fríos', value: frios, icon: '🧊', color: 'var(--color-warning)', bgColor: 'var(--color-warning-soft)', onClick: () => setFiltroEstado('frios') },
                ].map((kpi, i) => (
                    <div
                        key={i}
                        className="kpi-card"
                        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: kpi.onClick ? 'pointer' : 'default' }}
                        onClick={kpi.onClick}
                    >
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: kpi.bgColor, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'
                        }}>{kpi.icon}</div>
                        <div>
                            <div className="kpi-card-label" style={{ marginBottom: 2 }}>
                                {kpi.label}
                            </div>
                            <div className="kpi-card-value" style={{ fontSize: '1.4rem' }}>
                                {kpi.value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Cold Leads Alert Panel */}
            {frios > 0 && (
                <div style={{
                    background: frios > 5 ? '#ef444410' : '#eab30810',
                    border: `1px solid ${frios > 5 ? '#ef444430' : '#eab30830'}`,
                    borderRadius: 8, padding: '10px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.1rem' }}>{frios > 5 ? '🔴' : '🟡'}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            ⚠️ {frios} lead{frios !== 1 ? 's' : ''} sin contactar (7d+)
                        </span>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setFiltroEstado('frios')}
                        style={{ fontSize: '0.78rem', color: '#ef4444' }}
                    >Ver todos →</button>
                </div>
            )}
        </>
    )
})

export default LeadsHeaderKPIs
