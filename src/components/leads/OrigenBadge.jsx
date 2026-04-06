import React from 'react';

const ORIGEN_CONFIG = {
    'Facebook Ads':    { icon: '📘', color: '#1877F2', label: 'Facebook' },
    'Instagram Ads':   { icon: '📷', color: '#E4405F', label: 'Instagram' },
    'Meta Ads':        { icon: '📘', color: '#1877F2', label: 'Meta' },
    'TikTok':          { icon: '🎵', color: '#010101', label: 'TikTok' },
    'Web':             { icon: '🌐', color: '#10b981', label: 'Web' },
    'Referido':        { icon: '👥', color: '#8b5cf6', label: 'Referido' },
    'Orgánico / Manual': { icon: '✍️', color: '#6b7280', label: 'Manual' },
}

export default function OrigenBadge({ origen, formName }) {
    const cfg = ORIGEN_CONFIG[origen] || ORIGEN_CONFIG['Orgánico / Manual']
    const tooltip = formName ? `${cfg.label} — ${formName}` : cfg.label
    return (
        <span title={tooltip} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: cfg.color + '15', color: cfg.color,
            padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
            border: `1px solid ${cfg.color}30`, cursor: 'default', whiteSpace: 'nowrap'
        }}>
            {cfg.icon} {cfg.label}
        </span>
    )
}
