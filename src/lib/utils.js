export function timeAgo(date) {
    if (!date) return ''
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const mins = Math.floor((Date.now() - dateObj.getTime()) / 60000)
    if (mins <= 0) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    return `hace ${Math.floor(mins / 60)}h ${mins % 60}m`
}
