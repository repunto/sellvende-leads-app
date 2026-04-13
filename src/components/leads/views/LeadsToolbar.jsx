import React, { useMemo } from 'react'
const ESTADOS = ['nuevo', 'contactado', 'cotizado', 'cliente']

const LeadsToolbar = React.memo(({
    search, setSearch, 
    filtroEstado, setFiltroEstado, 
    filtroFormulario, setFiltroFormulario, 
    leads, globalForms, syncMetaLeads, syncing, deleteAllMetaLeads, openForm, 
    dateFrom, setDateFrom, 
    dateTo, setDateTo, 
    selectedLeads, filtered, 
    openEmailModal, setShowMassSequenceModal, 
    viewMode, setViewMode
}) => {

    const formsList = globalForms && globalForms.length > 0 ? globalForms : useMemo(() => {
        const uniqueForms = new Set(leads.map(l => {
            let f = l.form_name || l.producto_interes || '';
            if (f.includes(' - ')) f = f.split(' - ')[0].trim();
            return f;
        }).filter(Boolean));
        return [...uniqueForms].sort()
    }, [leads, globalForms]);

    return (
        <>
            <div className="toolbar">
                <div className="toolbar-left">
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="toolbar-search"
                            placeholder="Buscar por nombre, email, producto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ paddingRight: 28 }}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                style={{
                                    position: 'absolute', right: 8, background: 'transparent', border: 'none',
                                    cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Limpiar búsqueda"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <select
                        className="toolbar-filter"
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                        <option value="">Todos los estados</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                        <option value="frios">⚠️ Fríos (sin contactar)</option>
                        <option value="dado_de_baja">🚫 Dado de baja (unsubscribed)</option>
                    </select>
                    <select
                        className="toolbar-filter"
                        value={filtroFormulario}
                        onChange={(e) => setFiltroFormulario(e.target.value)}
                        style={{ marginLeft: 8 }}
                    >
                        <option value="">Todos los formularios</option>
                        {formsList.map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => syncMetaLeads(false)}
                        disabled={syncing}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {syncing ? '⏳' : '🔄'} {syncing ? 'Sincronizando...' : 'Sincronizar Meta'}
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={deleteAllMetaLeads}
                        style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}
                        title="Eliminar todos los leads de Meta Ads"
                    >
                        🗑 Borrar Meta
                    </button>
                    <button className="btn btn-primary" onClick={() => openForm(null)}>
                        + Nuevo Lead
                    </button>
                </div>
            </div>
            {/* Toolbar Row 2: Date filters + View toggle + Email */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Desde:</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)', fontSize: '0.82rem' }} />
                    <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Hasta:</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)', fontSize: '0.82rem' }} />
                    {(dateFrom || dateTo) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo('') }} style={{ fontSize: '0.75rem' }}>✕ Limpiar</button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {selectedLeads.size > 0 && (
                        (() => {
                            const totalEmailLeads = filtered.filter(l => l.email).length;
                            const isAllSelected = selectedLeads.size >= totalEmailLeads && totalEmailLeads > 0;
                            return (
                                <>
                                    <button className="btn btn-primary btn-sm" onClick={openEmailModal}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        📧 Email ({selectedLeads.size})
                                    </button>
                                    <button className="btn btn-sm" onClick={() => setShowMassSequenceModal(true)}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: 6, 
                                            background: isAllSelected ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--color-primary-soft)', 
                                            color: isAllSelected ? '#fff' : 'var(--color-primary)', 
                                            border: isAllSelected ? 'none' : '1px solid var(--color-primary)', 
                                            fontWeight: 800,
                                            boxShadow: isAllSelected ? '0 4px 12px rgba(245, 158, 11, 0.4)' : 'none',
                                            padding: '6px 16px',
                                            transition: 'all 0.2s ease',
                                            animation: isAllSelected ? 'pulse 2s infinite' : 'none',
                                            transform: isAllSelected ? 'scale(1.02)' : 'none'
                                        }}>
                                        {isAllSelected ? `🚀 ENROLAR A TODOS (${selectedLeads.size})` : `🚀 Secuencia Masiva (${selectedLeads.size})`}
                                    </button>
                                </>
                            )
                        })()
                    )}
                    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                        <button
                            onClick={() => setViewMode('table')}
                            style={{
                                padding: '5px 12px', fontSize: '0.8rem', border: 'none', cursor: 'pointer',
                                background: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-bg-card)',
                                color: viewMode === 'table' ? 'white' : 'var(--color-text)'
                            }}>📋 Tabla</button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            style={{
                                padding: '5px 12px', fontSize: '0.8rem', border: 'none', cursor: 'pointer',
                                background: viewMode === 'kanban' ? 'var(--color-primary)' : 'var(--color-bg-card)',
                                color: viewMode === 'kanban' ? 'white' : 'var(--color-text)'
                            }}>🏷️ Kanban</button>
                    </div>
                </div>
            </div>
        </>
    )
})

export default LeadsToolbar
