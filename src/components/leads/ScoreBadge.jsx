import React from 'react';

export default function ScoreBadge({ score }) {
    const colors = { 1: '#6b7280', 2: '#eab308', 3: '#f97316', 4: '#3b82f6', 5: '#10b981' }
    return (
        <span title={`Lead Score: ${score}/5`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: '0.7rem', padding: '1px 5px', borderRadius: 8,
            background: (colors[score] || '#6b7280') + '18',
            color: colors[score] || '#6b7280', fontWeight: 700
        }}>{'⭐'.repeat(score)}</span>
    )
}
