import React from 'react';

export default function SkeletonTable({ rows = 5, columns = 5 }) {
    return (
        <div className="table-container" style={{ overflowX: 'auto', paddingBottom: 20 }}>
            <table className="data-table" style={{ width: '100%', minWidth: 800 }}>
                <thead>
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i}>
                                <div style={{ 
                                    height: 16, 
                                    borderRadius: 4, 
                                    background: 'var(--color-bg-hover)',
                                    width: i === 0 ? '60%' : '80%'
                                }} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr key={r}>
                            {Array.from({ length: columns }).map((_, c) => (
                                <td key={c}>
                                    <div style={{
                                        height: 20,
                                        borderRadius: 4,
                                        background: 'rgba(255,255,255,0.03)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        width: c === 0 ? '90%' : c === columns - 1 ? '50%' : '75%'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0, left: 0, right: 0, bottom: 0,
                                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.6s infinite linear'
                                        }} />
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <style>{`
                @keyframes shimmer { to { background-position: -200% 0; } }
            `}</style>
        </div>
    );
}
