import React, { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const PdfVoucher = forwardRef(({ venta, agencia }, ref) => {
    if (!venta) return null

    const lead = venta.lead || {}
    const agenciaNombre = agencia?.nombre || 'Travel Agency'
    const agenciaTelefono = agencia?.whatsapp || ''

    // Compute saldo_pendiente since it's not a DB column
    const saldoPendiente = Number(venta.total_venta || venta.precio_venta || 0) - Number(venta.adelanto || 0)
    
    // Generar link de WhatsApp para soporte
    const waLink = agenciaTelefono ? `https://wa.me/${agenciaTelefono.replace(/\D/g, '')}?text=Hola, tengo una consulta sobre mi venta #${venta.id ? venta.id.substring(0,8).toUpperCase() : 'Temp'}` : 'https://wa.me/'

    // Formatear fechas
    const fechaVenta = new Date(venta.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    const fechaProducto = venta.fecha_servicio ? new Date(venta.fecha_servicio).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Por definir'

    return (
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '800px' }}>
            {/* Este contenedor será renderizado a Canvas/PDF por html2pdf... */}
            <div ref={ref} id="pdf-voucher-container" style={{
                width: '800px',
                backgroundColor: '#ffffff',
                fontFamily: '"Outfit", "Inter", sans-serif',
                color: '#1e293b',
                position: 'relative',
                padding: '0',
                margin: '0',
                overflow: 'hidden'
            }}>
                {/* Accent Backdrop (Subtle) */}
                <div style={{
                    position: 'absolute',
                    top: '-150px',
                    right: '-150px',
                    width: '400px',
                    height: '400px',
                    backgroundColor: 'rgba(99, 102, 241, 0.03)',
                    borderRadius: '50%',
                    zIndex: 0
                }}></div>

                {/* Header / Hero */}
                <div style={{
                    backgroundColor: '#030712', // Rich black/navy
                    color: 'white',
                    padding: '60px 60px 40px 60px',
                    borderBottom: '6px solid #fbbf24', // Golden accent
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            {agencia?.logo_url ? (
                                <img src={agencia.logo_url} alt="Logo" style={{ maxHeight: 70, marginBottom: 20, filter: 'brightness(0) invert(1)' }} crossOrigin="anonymous" />
                            ) : (
                                <h1 style={{ fontSize: '30px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-1px', color: '#fbbf24' }}>
                                    {agenciaNombre.toUpperCase()}
                                </h1>
                            )}
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>
                                Luxury Travel Confirmation
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                                Booking Reference
                            </div>
                            <div style={{ fontSize: '42px', fontWeight: 900, color: '#ffffff', marginBottom: 8, letterSpacing: '-1px' }}>
                                {venta.id ? venta.id.substring(0,8).toUpperCase() : 'Temp'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                                Issued on: {fechaVenta}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Body */}
                <div style={{ padding: '60px', position: 'relative', zIndex: 1 }}>
                    
                    {/* Welcome Section */}
                    <div style={{ marginBottom: '50px' }}>
                        <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px 0', color: '#111827', letterSpacing: '-0.5px' }}>
                            Prepare for your adventure, {lead.nombre || 'Traveler'}
                        </h2>
                        <p style={{ fontSize: '18px', color: '#4b5563', margin: 0, fontWeight: 400, lineHeight: 1.6 }}>
                            Your journey with <strong>{agenciaNombre}</strong> has been meticulously planned. Below are your official confirmation details.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', marginBottom: '50px' }}>
                        {/* Left column: Experience Details */}
                        <div style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '16px', borderLeft: '4px solid #fbbf24' }}>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 800, letterSpacing: '1.5px', marginBottom: '20px' }}>Experience Details</h3>
                            
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>PRIVATE TOUR</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{venta.producto?.nombre || lead.producto_interes || 'Exclusive Experience'}</div>
                            </div>
                            
                            <div style={{ marginBottom: '24px', display: 'flex', gap: '30px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>DEPARTURE DATE</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>{fechaProducto}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>GUESTS</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>{venta.pax || lead.personas || 1} Und.</div>
                                </div>
                            </div>
                        </div>

                        {/* Right column: Contact Details */}
                        <div style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 800, letterSpacing: '1.5px', marginBottom: '20px' }}>Passenger of Record</h3>
                            
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>FULL NAME</div>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{lead.nombre || venta.cliente_nombre || 'Guest'}</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>CONTACT EMAIL</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', wordBreak: 'break-all' }}>{lead.email || venta.cliente_email || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>PHONE</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{lead.telefono || venta.cliente_telefono || '—'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary - Modern Table Style */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '20px', overflow: 'hidden', marginBottom: '50px' }}>
                        <div style={{ backgroundColor: '#f9fafb', padding: '15px 30px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Financial Statement</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>All prices in USD</span>
                        </div>
                        <div style={{ padding: '30px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <span style={{ color: '#4b5563', fontSize: '16px' }}>Total Package Value</span>
                                <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>${Number(venta.total_venta || venta.precio_venta || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <span style={{ color: '#4b5563', fontSize: '16px' }}>Deposit Received</span>
                                <span style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>- ${Number(venta.adelanto || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                            
                            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e5e7eb, transparent)', margin: '20px 0' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827' }}>Balance Payable</div>
                                    <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>To be settled upon arrival</div>
                                </div>
                                <div style={{ fontSize: '36px', fontWeight: 900, color: '#ef4444' }}>
                                    ${saldoPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Support Section - Elite Concierge Style */}
                    <div style={{ display: 'flex', gap: '40px', alignItems: 'center', backgroundColor: '#0f172a', padding: '35px', borderRadius: '24px', color: 'white' }}>
                        <div style={{ background: 'white', padding: '12px', borderRadius: '16px' }}>
                            <QRCodeSVG value={waLink} size={120} level="H" includeMargin={true} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>24/7 Premium Support</span>
                            </div>
                            <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px', color: '#ffffff' }}>Your Concierge is Ready</h3>
                            <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 15px 0', lineHeight: '1.6', fontWeight: 400 }}>
                                Scan this code with your phone to instantly connect with our elite support team via WhatsApp. We are here to ensure your trip is perfect.
                            </p>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24' }}>
                                WhatsApp Support: {agenciaTelefono}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{ padding: '30px 60px', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', letterSpacing: '0.5px', lineHeight: 1.8 }}>
                        This is an official travel confirmation issued by <strong>{agenciaNombre}</strong>. <br/>
                        Terms and conditions apply. Please present this document during your check-in. <br/>
                        © {new Date().getFullYear()} {agenciaNombre} Luxury Travel Agency.
                    </div>
                </div>

            </div>
        </div>
    )
})

PdfVoucher.displayName = 'PdfVoucher'
export default PdfVoucher
