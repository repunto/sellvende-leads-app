/**
 * MetaCalculator — Calculadora de Metas de Negocio
 *
 * Dado:
 *   Meta mensual de ingresos  ($)
 *   Ticket promedio por venta ($)
 *   Tasa de cierre             (%)
 *
 * Calcula:
 *   Ventas necesarias  = Meta / Ticket
 *   Leads necesarios   = Ventas / (Cierre / 100)
 *   Leads diarios      = Leads / 30
 *   Inversion max CPL  = Meta / Leads  (para no perder)
 */

import { useState } from 'react'

function StatBox({ icon, label, value, sub, color, highlight }) {
    return (
        <div style={{
            flex: 1, padding: '20px 16px', borderRadius: 16, textAlign: 'center',
            background: highlight
                ? `linear-gradient(135deg, ${color}22, ${color}10)`
                : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${highlight ? color + '44' : 'rgba(255,255,255,0.07)'}`,
            position: 'relative', overflow: 'hidden'
        }}>
            {highlight && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: `linear-gradient(90deg, ${color}, ${color}88)`
                }} />
            )}
            <div style={{ fontSize: '1.6rem', marginBottom: 8, lineHeight: 1 }}>{icon}</div>
            <div style={{
                fontSize: highlight ? '2.2rem' : '1.8rem',
                fontWeight: 900, color: color,
                letterSpacing: '-1px', lineHeight: 1, marginBottom: 8
            }}>
                {value}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 3 }}>
                {label}
            </div>
            {sub && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {sub}
                </div>
            )}
        </div>
    )
}

function CalcInput({ label, value, onChange, prefix, suffix, placeholder }) {
    return (
        <div style={{ flex: 1 }}>
            <label style={{
                display: 'block', fontSize: '0.7rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.9px',
                color: 'var(--color-text-secondary)', marginBottom: 8
            }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                {prefix && (
                    <span style={{
                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                        fontWeight: 900, fontSize: '1.1rem', color: 'var(--color-text-secondary)', pointerEvents: 'none'
                    }}>{prefix}</span>
                )}
                <input
                    type="number"
                    min="0"
                    step="any"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || '0'}
                    style={{
                        width: '100%',
                        padding: `14px ${suffix ? '36px' : '14px'} 14px ${prefix ? '30px' : '14px'}`,
                        borderRadius: 12, boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1.5px solid var(--color-border)',
                        color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 700,
                        outline: 'none'
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                />
                {suffix && (
                    <span style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        fontWeight: 900, fontSize: '1.1rem', color: 'var(--color-text-secondary)', pointerEvents: 'none'
                    }}>{suffix}</span>
                )}
            </div>
        </div>
    )
}

export default function MetaCalculator({ calc, setCalc }) {
    const [open, setOpen] = useState(true)

    const meta    = parseFloat(calc.meta)    || 0
    const ticket  = parseFloat(calc.ticket)  || 0
    const cierre  = parseFloat(calc.cierre)  || 0

    const ventasNec  = ticket  > 0 ? Math.ceil(meta / ticket)           : 0
    const leadsNec   = cierre  > 0 ? Math.ceil(ventasNec / (cierre / 100)) : 0
    const leadsDay   = leadsNec > 0 ? Math.ceil(leadsNec / 30)          : 0
    const cplMax     = leadsNec > 0 ? (meta / leadsNec).toFixed(2)      : '—'
    const cpaMax     = ventasNec > 0 ? (meta / ventasNec).toFixed(2)    : '—'

    const isReady = meta > 0 && ticket > 0 && cierre > 0

    return (
        <div className="card" style={{
            marginBottom: 24, borderRadius: 18, overflow: 'hidden',
            border: '1px solid rgba(168,85,247,0.2)'
        }}>
            {/* Header */}
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    padding: '18px 22px',
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(59,130,246,0.08))',
                    borderBottom: open ? '1px solid rgba(168,85,247,0.15)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: 'rgba(168,85,247,0.18)',
                        border: '1px solid rgba(168,85,247,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem'
                    }}>
                        🧮
                    </div>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--color-text)' }}>
                            Calculadora de Metas de Negocio
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            ¿Cuántos leads necesitas para alcanzar tu meta de ventas?
                        </div>
                    </div>
                </div>
                <span style={{
                    color: 'var(--color-text-secondary)', fontSize: '0.85rem',
                    transition: 'transform 0.2s', display: 'inline-block',
                    transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                    ▼
                </span>
            </div>

            {open && (
                <div style={{ padding: '24px 22px' }}>

                    {/* ── Inputs row ── */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                        <CalcInput
                            label="🎯 Meta mensual de ingresos"
                            value={calc.meta}
                            onChange={v => setCalc(c => ({ ...c, meta: v }))}
                            prefix="$"
                            placeholder="5000"
                        />
                        <CalcInput
                            label="💰 Ticket promedio por venta"
                            value={calc.ticket}
                            onChange={v => setCalc(c => ({ ...c, ticket: v }))}
                            prefix="$"
                            placeholder="200"
                        />
                        <CalcInput
                            label="📈 Tasa de cierre"
                            value={calc.cierre}
                            onChange={v => setCalc(c => ({ ...c, cierre: v }))}
                            suffix="%"
                            placeholder="5"
                        />
                    </div>

                    {/* ── Results ── */}
                    {isReady ? (
                        <>
                            {/* Primary results */}
                            <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                                <StatBox
                                    icon="🏆"
                                    label="Ventas necesarias"
                                    value={ventasNec.toLocaleString()}
                                    sub={`Para generar $${meta.toLocaleString('en-US')} con ticket de $${ticket}`}
                                    color="#10b981"
                                    highlight
                                />
                                <StatBox
                                    icon="🎯"
                                    label="Leads necesarios"
                                    value={leadsNec.toLocaleString()}
                                    sub={`Con ${cierre}% de tasa de cierre`}
                                    color="#3b82f6"
                                    highlight
                                />
                                <StatBox
                                    icon="📅"
                                    label="Leads diarios"
                                    value={leadsDay.toLocaleString()}
                                    sub="Distribuidos en 30 días"
                                    color="#f59e0b"
                                    highlight
                                />
                            </div>

                            {/* Secondary derived metrics */}
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                <StatBox
                                    icon="📊"
                                    label="CPL máximo rentable"
                                    value={`$${cplMax}`}
                                    sub="Si gastas más por lead, pierdes dinero"
                                    color="#ec4899"
                                />
                                <StatBox
                                    icon="👤"
                                    label="CAC máximo rentable"
                                    value={`$${cpaMax}`}
                                    sub="Costo máximo por cliente adquirido"
                                    color="#8b5cf6"
                                />
                                <div style={{
                                    flex: 1, padding: '20px 16px', borderRadius: 16,
                                    background: 'rgba(249,115,22,0.06)',
                                    border: '1.5px solid rgba(249,115,22,0.2)'
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#f97316', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                        📋 Resumen ejecutivo
                                    </div>
                                    <div style={{ fontSize: '0.83rem', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                                        Para generar <strong style={{ color: 'var(--color-text)' }}>${meta.toLocaleString('en-US')}/mes</strong> vendiendo a <strong style={{ color: 'var(--color-text)' }}>${ticket}</strong> c/u con un cierre del <strong style={{ color: 'var(--color-text)' }}>{cierre}%</strong>, necesitas:
                                        <br />
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ {ventasNec} ventas cerradas</span> &nbsp;|&nbsp;
                                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>✓ {leadsNec} leads totales</span> &nbsp;|&nbsp;
                                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>✓ ~{leadsDay} leads/día</span>
                                        <br />
                                        Tu CPL debe ser <span style={{ color: '#ec4899', fontWeight: 700 }}>menor a ${cplMax}</span> para que la campaña sea rentable.
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{
                            textAlign: 'center', padding: '30px 20px',
                            background: 'rgba(255,255,255,0.02)', borderRadius: 14,
                            border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: 0.4 }}>🧮</div>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0 }}>
                                Rellena los 3 campos de arriba para ver tu proyección de leads y ventas.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
