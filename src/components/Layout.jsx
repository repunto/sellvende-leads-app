import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CommandPalette from './CommandPalette'

import { LayoutDashboard, Users, ShoppingCart, CalendarDays, Package, Gift, Tag, BarChart2, Users as UsersIcon, Settings, LogOut, Activity, DollarSign } from 'lucide-react'

const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} strokeWidth={2.5} />, label: 'Dashboard' },
    { path: '/leads', icon: <Users size={20} strokeWidth={2.5} />, label: 'Leads' },
    { path: '/ventas', icon: <ShoppingCart size={20} strokeWidth={2.5} />, label: 'Ventas' },
    { path: '/calendario', icon: <CalendarDays size={20} strokeWidth={2.5} />, label: 'Calendario' },
    { path: '/actividad', icon: <Activity size={20} strokeWidth={2.5} />, label: 'Radar' },
]

const configItems = [
    { path: '/productos', icon: <Package size={20} strokeWidth={2.5} />, label: 'Productos' },
    { path: '/extras', icon: <Gift size={20} strokeWidth={2.5} />, label: 'Extras / Up-sells' },
    { path: '/descuentos', icon: <Tag size={20} strokeWidth={2.5} />, label: 'Descuentos' },
    { path: '/finanzas', icon: <DollarSign size={20} strokeWidth={2.5} />, label: 'Finanzas & ROAS' },
    { path: '/marketing', icon: <BarChart2 size={20} strokeWidth={2.5} />, label: 'Automatización Email' },
    { path: '/operadores', icon: <UsersIcon size={20} strokeWidth={2.5} />, label: 'Equipo Comercial' },
    { path: '/configuracion', icon: <Settings size={20} strokeWidth={2.5} />, label: 'Configuración' },
]

export default function Layout({ children }) {
    const { user, agencia, rol, signOut } = useAuth()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()

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
                    <div className="sidebar-brand-icon" style={{ background: 'var(--color-accent)' }}>S</div>
                    <div className="sidebar-brand-text">Sellvende</div>
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

                <div style={{ padding: '0 24px 20px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }}></div>
                    Espacio: <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agencia?.nombre || 'Cargando...'}</span>
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
                {children}
            </main>
            <CommandPalette />
        </div>
    )
}
