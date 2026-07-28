# instaWork

Aplicación web para gestión de postulaciones laborales automáticas.

## Estructura del proyecto

```
instawork/
├── index.html          # Login (punto de entrada)
├── onboarding.html     # Asistente de configuración
├── dashboard.html      # Panel principal
├── css/
│   ├── variables.css
│   ├── base.css
│   ├── login.css
│   ├── onboarding.css
│   └── dashboard.css
├── js/
│   ├── engine.js       # Motor de búsqueda y estado
│   ├── firebase.js     # Configuración e inicialización de Firebase
│   ├── auth.js         # Helpers de autenticación
│   ├── auth-guard.js   # Protección de rutas
│   ├── ai-titles.js    # Sugerencias de roles con IA
│   ├── login.js
│   ├── onboarding.js
│   └── dashboard.js
├── .htaccess
└── README.md
```

## Flujo de la aplicación

1. **Login** (`index.html`) — Firebase Auth con email y contraseña
2. **Onboarding** (`onboarding.html`) — Configuración de perfil y preferencias
3. **Dashboard** (`dashboard.html`) — Búsqueda y gestión de postulaciones

## Ramas

- `main` — Producción
- `develop` — Desarrollo

## Desarrollo local

```bash
python3 -m http.server 8080
```

Abre http://localhost:8080

## Firebase

- Proyecto: `applyr-69021`
- Auth: Email/Password y Google (ver `FIREBASE-GOOGLE-SETUP.md` si Google falla)
