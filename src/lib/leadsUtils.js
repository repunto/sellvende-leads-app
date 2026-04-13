export function getColdLevel(lead) {
    if (lead.estado !== 'nuevo') return null
    const ref = lead.ultimo_contacto ? new Date(lead.ultimo_contacto) : new Date(lead.created_at)
    const hoursAgo = (Date.now() - ref.getTime()) / 3600000
    if (hoursAgo >= 72) return { level: 3, icon: '🔴', label: '72h+', color: '#ef4444' }
    if (hoursAgo >= 48) return { level: 2, icon: '🟠', label: '48h+', color: '#f97316' }
    if (hoursAgo >= 24) return { level: 1, icon: '🟡', label: '24h+', color: '#eab308' }
    return null
}

export function formatTemporada(t) {
    if (!t) return 'sus próximas vacaciones'
    const str = t.toLowerCase()
    if (str.includes('lluvia') || str.includes('baja') || str.includes('octubre') || str.includes('marzo')) {
        return 'octubre - marzo'
    }
    return 'abril - setiembre'
}

export const mesesArray = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const mesAgotado = mesesArray[(new Date().getMonth() + 2) % 12]

export function getLeadScore(lead) {
    let score = 0
    // Data completeness (max 2 pts)
    if (lead.email) score += 0.5
    if (lead.telefono) score += 0.5
    if (lead.producto_interes) score += 0.5
    if (lead.personas) score += 0.5
    // Engagement (max 2 pts)
    if (lead.estado === 'contactado') score += 1
    if (lead.estado === 'cotizado') score += 1.5
    if (lead.estado === 'cliente') score += 2
    if (lead.ultimo_contacto) score += 0.5
    // Recency (max 1 pt)
    const daysAgo = (Date.now() - new Date(lead.created_at).getTime()) / 86400000
    if (daysAgo <= 1) score += 1
    else if (daysAgo <= 7) score += 0.5
    return Math.min(5, Math.max(1, Math.round(score)))
}
