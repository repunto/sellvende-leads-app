import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CommandPalette from './CommandPalette'

import { LayoutDashboard, Users, Ticket, CalendarDays, Map, Package, Tag, TrendingUp, Users as UsersIcon, Settings, LogOut, Activity } from 'lucide-react'

const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} strokeWidth={2.5} />, label: 'Dashboard' },
    { path: '/leads', icon: <Users size={20} strokeWidth={2.5} />, label: 'Leads' },
    { path: '/reservas', icon: <Ticket size={20} strokeWidth={2.5} />, label: 'Reservas' },
    { path: '/calendario', icon: <CalendarDays size={20} strokeWidth={2.5} />, label: 'Calendario' },
    { path: '/actividad', icon: <Activity size={20} strokeWidth={2.5} />, label: 'Radar' },
]

const configItems = [
    { path: '/tours', icon: <Map size={20} strokeWidth={2.5} />, label: 'Tours' },
    { path: '/opcionales', icon: <Package size={20} strokeWidth={2.5} />, label: 'Opcionales' },
    { path: '/descuentos', icon: <Tag size={20} strokeWidth={2.5} />, label: 'Descuentos' },
    { path: '/marketing', icon: <TrendingUp size={20} strokeWidth={2.5} />, label: 'Marketing ROI' },
    { path: '/operadores', icon: <UsersIcon size={20} strokeWidth={2.5} />, label: 'Operadores' },
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
                    <div className="sidebar-brand-icon">{agencia?.nombre ? agencia.nombre.charAt(0).toUpperCase() : 'Q'}</div>
                    <div className="sidebar-brand-text">{agencia?.nombre || 'Sellvende'}</div>
                </div>
                <button className="hamburger" onClick={toggleSidebar}>
                    {isSidebarOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* Overlay for mobile */}
            <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={closeSidebar}></div>

            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon">{agencia?.nombre ? agencia.nombre.charAt(0).toUpperCase() : 'Q'}</div>
                    <div className="sidebar-brand-text">
                        {agencia?.nombre || 'Sellvende Leads'}
                    </div>
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
