import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TABS } from './configuracion/constants'

// Tabs
import AgenciaTab from './configuracion/tabs/AgenciaTab'
import IntegracionesTab from './configuracion/tabs/IntegracionesTab'
import PlantillasTab from './configuracion/tabs/PlantillasTab'
import PlantillasWhatsAppTab from './configuracion/tabs/PlantillasWhatsAppTab'
import BackupTab from './configuracion/tabs/BackupTab'
import SeedTab from './configuracion/tabs/SeedTab'

export default function ConfiguracionPage() {
    const { agencia } = useAuth()
    const [activeTab, setActiveTab] = useState('agencia')
    const [toast, setToast] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    return (
        <>
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.msg}
                </div>
            )}

            <div className="page-header">
                <h1 className="page-title">Configuración</h1>
                <p className="page-subtitle">Ajustes generales de {agencia?.nombre || 'tu agencia'}</p>
            </div>

            <div className="page-body">
                {/* Tab Selector */}
                <div className="tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'agencia' && <AgenciaTab showToast={showToast} agencia={agencia} />}
                {activeTab === 'integraciones' && <IntegracionesTab showToast={showToast} agencia={agencia} />}
                {activeTab === 'plantillas' && <PlantillasTab showToast={showToast} agencia={agencia} />}
                {activeTab === 'whatsapp' && <PlantillasWhatsAppTab showToast={showToast} agencia={agencia} />}
                {activeTab === 'backup' && <BackupTab showToast={showToast} agencia={agencia} />}
                {activeTab === 'seed' && <SeedTab showToast={showToast} />}
            </div>
        </>
    )
}
