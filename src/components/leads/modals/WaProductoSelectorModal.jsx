export default function WaProductoSelectorModal({ waModal, setWaModal, finishWaClick }) {
    if (!waModal) return null;

    return (
        <div className="modal-overlay" onClick={() => setWaModal(null)} style={{ zIndex: 99999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Seleccionar Producto para WhatsApp
                        </h3>
                        <button onClick={() => setWaModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'rgba(255,255,255,0.8)' }}>✕</button>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.85 }}>Elige la variante del producto para incluir el precio correcto</p>
                </div>
                <div style={{ padding: 20 }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                        Enviando a <strong>{waModal.lead.nombre}</strong>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                        {(waModal.matchingProductos || []).map(producto => (
                            <button key={producto.id}
                                onClick={() => finishWaClick(waModal.lead, waModal.baseMsg, producto)}
                                style={{
                                    padding: '10px 14px', border: '1px solid var(--color-border)',
                                    borderRadius: 8, background: 'var(--color-bg-hover)',
                                    cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)'
                                }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{producto.nombre}</div>
                                <div style={{ fontSize: '0.8rem', color: '#25D366', marginTop: 2 }}>
                                    ${producto.precio_usd} USD · {producto.duracion_dias} días
                                </div>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => finishWaClick(waModal.lead, waModal.baseMsg, null)}
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: 12, fontSize: '0.85rem' }}>
                        Enviar sin especificar precio
                    </button>
                </div>
            </div>
        </div>
    )
}
