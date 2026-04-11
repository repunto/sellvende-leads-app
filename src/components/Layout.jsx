import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CommandPalette from './CommandPalette'
import { supabase } from '../lib/supabase'

import { LayoutDashboard, Users, ShoppingCart, CalendarDays, Package, Gift, Tag, BarChart2, Users as UsersIcon, Settings, LogOut, Activity, DollarSign, CreditCard } from 'lucide-react'

const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} strokeWidth={2.5} />, label: 'Dashboard' },
    { path: '/leads', icon: <Users size={20} strokeWidth={2.5} />, label: 'Leads' },
    { path: '/ventas', icon: <ShoppingCart size={20} strokeWidth={2.5} />, label: 'Ventas' },
    { path: '/calendario', icon: <CalendarDays size={20} strokeWidth={2.5} />, label: 'Calendario' },
    { path: '/actividad', icon: <Activity size={20} strokeWidth={2.5} />, label: 'Radar' },
]

const configItems = [
    { path: '/analytics', icon: <BarChart2 size={20} strokeWidth={2.5} />, label: 'Analítica y ROI' },
    { path: '/finanzas', icon: <DollarSign size={20} strokeWidth={2.5} />, label: 'Finanzas & ROAS' },
    { path: '/productos', icon: <Package size={20} strokeWidth={2.5} />, label: 'Productos' },
    { path: '/extras', icon: <Gift size={20} strokeWidth={2.5} />, label: 'Extras / Up-sells' },
    { path: '/descuentos', icon: <Tag size={20} strokeWidth={2.5} />, label: 'Descuentos' },
    { path: '/marketing', icon: <Activity size={20} strokeWidth={2.5} />, label: 'Automatización Email' },
    { path: '/asesores', icon: <UsersIcon size={20} strokeWidth={2.5} />, label: 'Equipo Comercial' },
    { path: '/configuracion', icon: <Settings size={20} strokeWidth={2.5} />, label: 'Configuración' },
    { path: '/billing', icon: <CreditCard size={20} strokeWidth={2.5} />, label: 'Plan y Facturación' },
]

export default function Layout({ children }) {
    const { user, agencia, rol, signOut } = useAuth()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [nombreVisible, setNombreVisible] = useState('')
    const location = useLocation()

    useEffect(() => {
        if (!agencia?.id) return
        supabase.from('configuracion').select('valor').eq('agencia_id', agencia.id).eq('clave', 'nombre_visible').maybeSingle()
            .then(({ data }) => {
                if (data?.valor) setNombreVisible(data.valor)
            })
            .catch(() => { })
    }, [agencia?.id])

    const initials = user?.email
        ? user.email.substring(0, 2).toUpperCase()
        : '??'

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
    const closeSidebar = () => setIsSidebarOpen(false)

    // Cerrar sidebar al cambiar de ruta en mobile
    useEffect(() => {
        setTimeout(() => closeSidebar(), 0)
    }, [location])

    return (
        <div className="app-layout">
            {/* Mobile Header */}
            <header className="mobile-header">
                <div className="sidebar-brand" style={{ padding: 0, border: 'none' }}>
                    <div className="sidebar-brand-icon" style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #c2410c 100%)' }}>S</div>
                    <div className="sidebar-brand-text">Sellvende <span style={{ color: 'var(--color-accent)' }}>Leads</span></div>
                </div>
                <button className="hamburger" onClick={toggleSidebar}>
                    {isSidebarOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* Overlay for mobile */}
            <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={closeSidebar}></div>

            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon" style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #c2410c 100%)' }}>S</div>
                    <div className="sidebar-brand-text">
                        Sellvende <span style={{ color: 'var(--color-accent)' }}>Leads</span>
                    </div>
                </div>

                <div style={{ padding: '0 20px', marginBottom: '24px' }}>
                    <NavLink to="/" style={{ textDecoration: 'none', display: 'block' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 0',
                            }}
                        >
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)', flexShrink: 0 }}></div>
                            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {nombreVisible || agencia?.nombre || 'Cargando...'}
                            </span>
                        </div>
                    </NavLink>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Principal</div>
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            onClick={closeSidebar}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            style={({ isActive }) => isActive ? {
                                background: 'linear-gradient(90deg, var(--color-accent-soft) 0%, rgba(224, 122, 79, 0) 100%)',
                                borderLeft: '3px solid var(--color-accent)',
                                paddingLeft: '9px',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
                            } : { borderLeft: '3px solid transparent', paddingLeft: '9px' }}
                        >
                            <span className="sidebar-link-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}

                    <div className="sidebar-section-label">Administración</div>
                    {configItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={closeSidebar}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            style={({ isActive }) => isActive ? {
                                background: 'linear-gradient(90deg, var(--color-accent-soft) 0%, rgba(224, 122, 79, 0) 100%)',
                                borderLeft: '3px solid var(--color-accent)',
                                paddingLeft: '9px',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
                            } : { borderLeft: '3px solid transparent', paddingLeft: '9px' }}
                        >
                            <span className="sidebar-link-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name" style={{ textTransform: 'capitalize' }}>{rol || 'Admin'}</div>
                            <div className="sidebar-user-email">{user?.email}</div>
                        </div>
                        <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px' }}
                            onClick={() => { signOut(); closeSidebar(); }}
                            title="Cerrar sesión"
                        >
                            <LogOut size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                {/* Expired / Trial Warning Banner */}
                {isExpired && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 12,
                        padding: '14px 20px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.2rem' }}>🔒</span>
                            <div>
                                <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.9rem' }}>Tu plan ha vencido — Modo solo lectura</div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Activa tu suscripción para seguir creando leads y enviando emails.</div>
                            </div>
                        </div>
                        <NavLink to="/billing" style={{
                            padding: '8px 20px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white',
                            borderRadius: 10,
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                        }}>
                            Activar Plan 🚀
                        </NavLink>
                    </div>
                )}
                {children}
            </main>
            <CommandPalette />
        </div>
    )
}
