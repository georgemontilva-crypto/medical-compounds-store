# Medical Compounds Store - TODO

## Fase 1: Base de datos y referencias
- [x] Crear todo.md
- [x] Leer referencias de file-storage (R2)
- [x] Diseñar y migrar esquema completo de base de datos

## Fase 2: Backend / API
- [x] Autenticación JWT propia: registro con email/password
- [x] Autenticación JWT propia: login con email/password
- [x] Autenticación JWT propia: logout y middleware de sesión
- [x] Router de categorías: CRUD completo
- [x] Router de productos: CRUD con variaciones (MG/ML)
- [x] Router de variaciones de producto: precio y stock independiente
- [x] Router de imágenes de producto: subida a R2
- [x] Router de carrito: añadir, actualizar, eliminar ítems
- [x] Router de cupones: crear, editar, eliminar, validar
- [x] Router de órdenes: crear, listar, detalle, cambiar estado
- [x] Router de admin: gestión de usuarios, órdenes, productos, cupones
- [x] Notificación al admin al crear nueva orden

## Fase 3: Frontend - Tienda
- [x] Layout principal con navbar, logo y carrito
- [x] Página de catálogo con filtros por categoría
- [x] Búsqueda de productos por nombre
- [x] Ordenamiento de productos (precio, nombre, destacados)
- [x] Tarjeta de producto con botón de añadir al carrito
- [x] Carrito lateral deslizante (drawer derecho)
- [x] Carrito: editar cantidades y eliminar ítems
- [x] Página de detalle de producto
- [x] Selector de variación (MG/ML) en detalle de producto
- [x] Galería de imágenes en detalle de producto

## Fase 4: Frontend - Auth y Checkout
- [x] Página de registro (email + contraseña)
- [x] Página de login (email + contraseña)
- [x] Contexto de autenticación global
- [x] Página de checkout: resumen del pedido
- [x] Página de checkout: formulario de datos de envío
- [x] Página de checkout: aplicación de cupones de descuento
- [x] Página de checkout: sección de pago (lista para integrar pasarela)
- [x] Página de mis órdenes del usuario

## Fase 5: Panel de Administración
- [x] Layout de admin con sidebar
- [x] Dashboard admin: métricas básicas
- [x] Admin: listado y gestión de productos
- [x] Admin: crear/editar producto con variaciones
- [x] Admin: subida de imágenes a R2 con previsualización
- [x] Admin: gestión de categorías
- [x] Admin: listado de órdenes con filtros
- [x] Admin: detalle de orden y cambio de estado
- [x] Admin: listado de usuarios registrados
- [x] Admin: creador y gestor de cupones de descuento

## Fase 6: Pulido y entrega
- [x] Diseño responsivo en todas las páginas
- [x] Estética de laboratorio médico aplicada globalmente
- [x] 18 tests vitest pasando (auth, access control, cart, coupons, products, orders)
- [x] Checkpoint final

## Fase 7: Navbar, Hero Slider y Lab Reports
- [x] Navbar con mega-menús desplegables (Shop, Science, Research, Wholesale, Contact, Sign In)
- [x] Hero banner fullscreen con slider de imágenes y efecto Ken Burns
- [x] Sistema de reportes de laboratorio: subida de PDFs en admin
- [x] Página pública /lab-reports/:slug para ver reportes del producto
- [x] Ruta y enlace desde la página de detalle de producto

## Configuración externa (post-entrega)
- [x] Página de detalle de orden para usuario (/my-orders/:id) — implementada
- [ ] Integración de pasarela de pago real (Stripe, PayPal, etc.) — requiere decisión del usuario
- [ ] Configurar variables de entorno en Railway (DATABASE_URL, JWT_SECRET, R2 credentials) — requiere credenciales del usuario

## Fase 8: Paleta Teal/Beige/Gold y Textura Hex-Cream
- [x] Paleta de colores teal (#3A9E94, #7ECDC4, #5BB8AE, #2A8E84) aplicada globalmente
- [x] Textura hexagonal (hex-cream, hex-section) definida en index.css y aplicada en todas las páginas
- [x] Contact.tsx: bug del label "Name *" corregido, paleta teal aplicada
- [x] Login.tsx y Register.tsx: fondo hex-cream aplicado
- [x] Checkout.tsx: fondo hex-cream aplicado en todos los estados
- [x] MyOrders.tsx: fondo hex-cream + colores processing/shipped en teal
- [x] OrderDetail.tsx: fondo hex-cream + colores processing/shipped en teal
- [x] LabReports.tsx: fondo hex-cream + iconos y botones en teal
- [x] ProductDetail.tsx: hover del botón Lab Reports en teal
- [x] Navbar.tsx: todos los colores violeta reemplazados por teal
- [x] Home.tsx: sección CTA y trust badges en teal
- [x] AdminDashboard, AdminOrders, AdminOrderDetail, AdminUsers, AdminLabReports: colores teal aplicados
