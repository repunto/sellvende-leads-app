# 📊 Plan de Implementación: Elite Email & Automation Dashboard

Este plan define la construcción de un Centro de Control de Vanguardia ("Elite Dashboard") para auditar, visualizar y controlar toda la actividad del motor de correos (manuales y automáticos por `process-drips`), así como el sistema de Bajas (Unsubscribe).

## 🚀 Concepto y Diseño (Aesthetic Vanguardista)
El diseño estará alineado a la temática "Elite" que hemos implementado: Dark Mode profundo con acentos neón (esmeralda para éxito, violeta para secuencias, rojo para errores). Uso de **Glassmorphism**, paneles flotantes y micro-animaciones en tiempo real para dar la sensación de estar frente a un centro de comando de clase mundial.

## 📌 Componentes Necesarios

### 1. Panel de Métricas Rápidas (KPIs Top)
Una botonera superior (Grid) con gráficos minimalistas o tarjetas de impacto:
- **📨 Enviados (Hoy / Semana):** Total de correos procesados exitosamente.
- **🤖 Piloto Automático:** Cantidad de leads activos actualmente en el "loop" de secuencias.
- **🚫 Rendimiento de Bajas:** Tasa de leads que han cancelado suscripción (Unsubscribed).
- **⚠️ Tasa de Fallos:** Correos rebotados o errores de SMTP/Resend.

### 2. Timeline de Actividad en Tiempo Real (Live Feed)
En lugar de una simple tabla aburrida, se construirá un **Live Feed** que parezca una terminal de notificaciones en tiempo real:
- Identificadores visuales: 🤖 (Autopilot), 👤 (Mensaje Manual), ❌ (Fallo).
- Animación de entrada suave (fade-in/slide) para los nuevos registros.
- Búsqueda en vivo (Live Search) ultra-rápida.

### 3. Inspector de Correos (X-Ray Preview)
Al dar clic a un registro en el Timeline, un panel lateral (Slide-out panel) se deslizará suavemente desde la derecha:
- Mostrará los **metadatos técnicos**: SMTP usado (Resend vs Gmail), Fecha exacta, Lead ID, Tour Cotizado.
- **Renderizado Visual:** Un iframe simulado o área de previsualización que muestra exactamente cómo se vio el correo enviado al cliente (con la firma, el HTML y el CTA de baja).
- **Registro de Error Detallado:** Si el estado es "fallido", se muestra la respuesta literal del servidor (ej: *Invalid App Password* o *Bounce*) en formato código para resolución inmediata.

### 4. Filtros Avanzados (Data Filtering)
Dropdowns estilizados para segmentar la actividad:
- 📅 **Rango de Fechas:** Buscar en el pasado.
- ⚙️ **Tipo de Disparo:** Filtrar solo "Secuencias Automáticas" vs "Individuales".
- 🚦 **Estado:** Ver solo los "Fallidos" para poder tomar acción.

## 🛠️ User Review Required

> [!IMPORTANT]
> **Preguntas Clave para Aprobar el Plan:**
> 1. **Ubicación UI:** ¿Deseas que este dashboard sea una pestaña/página independiente (ej: `/logs` o `/automatizaciones`) o prefieres que sea una pestaña gigante dentro de la vista actual de Leads?
> 2. **Gráficos Avanzados:** ¿Requieres gráficos de líneas (ej: correos enviados x día) usando una librería como `Recharts` o es suficiente con los KPIs numéricos de alto impacto + métricas textuales atractivas?
> 3. **Exportación:** ¿Necesitas un botón para exportar este registro de auditoría a Excel/CSV?

## 📝 Plan de Ejecución Táctico

#### [NEW] `src/pages/MarketingDashboard.jsx` (o similar)
Se creará la estructura principal de la página, importando los estilos top-tier de CSS. Mapeará la tabla de la base de datos `email_log` uniéndola con `leads` para sacar los nombres de las personas impactadas.

#### [MODIFY] `src/App.jsx` y Rutas
Si elegimos hacerla independiente, añadiremos el enrutamiento y la incluiremos en la barra de navegación lateral (Sidebar) con un icono premium como 📈 o ⚡.

#### [NEW] `src/components/marketing/ActivityFeed.jsx`
Componente aislado para gestionar el scroll infinito y las animaciones de los registros que van entrando.

## Verificación
Para probarlo:
1. Navegaremos a la nueva interfaz y revisaremos el impacto visual.
2. Probaremos el envío de un correo (usando el botón "Saltar Espera" que ya funciona).
3. Verificaremos que el Life-Feed se actualice instantáneamente (o al refrescar) mostrando el nuevo envío renderizado perfectamente.
