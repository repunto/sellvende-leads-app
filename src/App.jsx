import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Component } from 'react'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import VentasPage from './pages/VentasPage'
import CalendarioPage from './pages/CalendarioPage'
import ProductosPage from './pages/ProductosPage'
import ExtrasPage from './pages/ExtrasPage'
import DescuentosPage from './pages/DescuentosPage'
import OperadoresPage from './pages/OperadoresPage'
import ActivityPage from './pages/ActivityPage'
import MarketingPage from './pages/MarketingPage'
import FinanzasPage from './pages/FinanzasPage'
import ConfiguracionPage from './pages/ConfiguracionPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0f172a', color: '#f1f5f9', padding: 40, fontFamily: 'monospace'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>💥</div>
          <h2 style={{ color: '#ef4444', marginBottom: 8 }}>Error en la aplicación</h2>
          <pre style={{
            background: '#1e293b', padding: 20, borderRadius: 8,
            maxWidth: 800, overflow: 'auto', fontSize: '0.85rem',
            color: '#fca5a5', border: '1px solid #ef444440'
          }}>
            {this.state.error?.toString()}{'\n'}{this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 20, padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1rem' }}
          >
            🔄 Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--color-text-secondary)'
      }}>
        Cargando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
            {/* Nuevas rutas con glosario universal */}
            <Route path="/ventas" element={<ProtectedRoute><VentasPage /></ProtectedRoute>} />
            <Route path="/productos" element={<ProtectedRoute><ProductosPage /></ProtectedRoute>} />
            <Route path="/extras" element={<ProtectedRoute><ExtrasPage /></ProtectedRoute>} />
            <Route path="/finanzas" element={<ProtectedRoute><FinanzasPage /></ProtectedRoute>} />
            {/* Alias de compatibilidad — rutas viejas redirigen a las nuevas */}
            <Route path="/reservas" element={<Navigate to="/ventas" replace />} />
            <Route path="/tours" element={<Navigate to="/productos" replace />} />
            <Route path="/opcionales" element={<Navigate to="/extras" replace />} />
            {/* Rutas que mantienen su nombre */}
            <Route path="/calendario" element={<ProtectedRoute><CalendarioPage /></ProtectedRoute>} />
            <Route path="/actividad" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
            <Route path="/descuentos" element={<ProtectedRoute><DescuentosPage /></ProtectedRoute>} />
            <Route path="/operadores" element={<ProtectedRoute><OperadoresPage /></ProtectedRoute>} />
            <Route path="/marketing" element={<ProtectedRoute><MarketingPage /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute><ConfiguracionPage /></ProtectedRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
