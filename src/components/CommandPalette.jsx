import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Search, User, LayoutDashboard, Ticket, CalendarDays, Settings, X, Activity, TrendingUp } from 'lucide-react'

const STATIC_ACTIONS = [
    { id: 'nav-dashboard', type: 'navegacion', title: 'Ir al Dashboard', icon: <LayoutDashboard size={18} />, path: '/' },
    { id: 'nav-leads', type: 'navegacion', title: 'Ir a Leads', icon: <User size={18} />, path: '/leads' },
    { id: 'nav-ventas', type: 'navegacion', title: 'Ir a Ventas', icon: <Ticket size={18} />, path: '/ventas' },
    { id: 'nav-calendario', type: 'navegacion', title: 'Ir a Calendario', icon: <CalendarDays size={18} />, path: '/calendario' },
    { id: 'nav-marketing', type: 'navegacion', title: 'Ir a Marketing ROI', icon: <TrendingUp size={18} />, path: '/marketing' },
    { id: 'nav-actividad', type: 'navegacion', title: 'Ir a Actividad', icon: <Activity size={18} />, path: '/actividad' },
    { id: 'nav-configuracion', type: 'navegacion', title: 'Configuración', icon: <Settings size={18} />, path: '/configuracion' }
]

export default function CommandPalette() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState(STATIC_ACTIONS)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [searching, setSearching] = useState(false)
    const inputRef = useRef(null)
    const navigate = useNavigate()
    const { agencia } = useAuth()

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setOpen(true)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        if (open) {
            setQuery('')
            setResults(STATIC_ACTIONS)
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        
        const fetchResults = async () => {
            if (!query.trim()) {
                setResults(STATIC_ACTIONS)
                setSearching(false)
                return
            }

            setSearching(true)
            const lowerQuery = query.toLowerCase()
            const filteredActions = STATIC_ACTIONS.filter(a => a.title.toLowerCase().includes(lowerQuery))

            if (!agencia?.id) {
                setResults(filteredActions)
                setSearching(false)
                return
            }

            const { data } = await supabase
                .from('leads')
                .select('id, nombre, email')
                .eq('agencia_id', agencia.id)
                .ilike('nombre', `%${query}%`)
                .limit(5)

            const leadActions = (data || []).map(lead => ({
                id: `lead-${lead.id}`,
                type: 'lead',
                title: lead.nombre || 'Lead sin nombre',
                subtitle: lead.email,
                icon: <User size={18} />,
                path: `/leads?search=${encodeURIComponent(lead.nombre)}`
            }))

            setResults([...filteredActions, ...leadActions])
            setSelectedIndex(0)
            setSearching(false)
        }

        const debounce = setTimeout(fetchResults, 300)
        return () => clearTimeout(debounce)
    }, [query, open, agencia])

    const handleSelect = (item) => {
        setOpen(false)
        if (item.path) {
            navigate(item.path)
        }
    }

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(curr => (curr + 1) % results.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(curr => (curr - 1 + results.length) % results.length)
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            e.preventDefault()
            handleSelect(results[selectedIndex])
        }
    }

    if (!open) return null

    return (
        <div className="cmd-backdrop" onClick={() => setOpen(false)}>
            <div className="cmd-palette" onClick={e => e.stopPropagation()}>
                <div className="cmd-header">
                    <Search className="cmd-search-icon" size={20} />
                    <input
                        ref={inputRef}
                        className="cmd-input"
                        placeholder="Buscar leads o navegar... (Ej. Juan Perez)"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    {searching && <span className="cmd-spinner"></span>}
                    <button className="cmd-close" onClick={() => setOpen(false)}>
                        <X size={20} />
                    </button>
                </div>
                
                <div className="cmd-results">
                    {results.length === 0 && !searching && (
                        <div className="cmd-empty">No se encontraron resultados para "{query}"</div>
                    )}
                    
                    {results.map((item, index) => (
                        <div
                            key={item.id}
                            className={`cmd-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            <div className="cmd-item-icon">{item.icon}</div>
                            <div className="cmd-item-content">
                                <div className="cmd-item-title">{item.title}</div>
                                {item.subtitle && <div className="cmd-item-subtitle">{item.subtitle}</div>}
                            </div>
                            <div className="cmd-item-type">{item.type}</div>
                        </div>
                    ))}
                </div>
                
                <div className="cmd-footer">
                    <span><kbd>↑</kbd> <kbd>↓</kbd> para navegar</span>
                    <span><kbd>Enter</kbd> para seleccionar</span>
                    <span><kbd>Esc</kbd> para salir</span>
                </div>
            </div>
            
            <style>{`
                .cmd-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(8px);
                    z-index: 9999;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    padding-top: 10vh;
                    animation: fadeIn 0.2s ease-out;
                }
                .cmd-palette {
                    width: 100%;
                    max-width: 600px;
                    background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    overflow: hidden;
                    animation: slideDown 0.2s ease-out;
                }
                .cmd-header {
                    display: flex;
                    align-items: center;
                    padding: 0 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .cmd-search-icon {
                    color: #94a3b8;
                }
                .cmd-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 16px;
                    font-size: 1.1rem;
                    outline: none;
                }
                .cmd-input::placeholder {
                    color: #64748b;
                }
                .cmd-close {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: #64748b;
                    padding: 8px;
                }
                .cmd-close:hover {
                    color: white;
                }
                .cmd-results {
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 8px;
                }
                .cmd-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    cursor: pointer;
                    border-radius: 8px;
                    color: #cbd5e1;
                    transition: background 0.1s;
                }
                .cmd-item.selected {
                    background: #334155;
                    color: white;
                }
                .cmd-item-icon {
                    margin-right: 16px;
                    color: #94a3b8;
                    display: flex;
                }
                .cmd-item.selected .cmd-item-icon {
                    color: #38bdf8;
                }
                .cmd-item-content {
                    flex: 1;
                }
                .cmd-item-title {
                    font-weight: 500;
                }
                .cmd-item-subtitle {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-top: 2px;
                }
                .cmd-item-type {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #94a3b8;
                }
                .cmd-empty {
                    padding: 32px;
                    text-align: center;
                    color: #64748b;
                }
                .cmd-footer {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 16px;
                    padding: 12px 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(0, 0, 0, 0.2);
                    font-size: 0.8rem;
                    color: #64748b;
                }
                .cmd-footer kbd {
                    background: #334155;
                    padding: 2px 6px;
                    border-radius: 4px;
                    border-bottom: 2px solid #0f172a;
                    font-family: inherit;
                }
                @keyframes slideDown {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .cmd-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid #334155;
                    border-top-color: #38bdf8;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 12px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
