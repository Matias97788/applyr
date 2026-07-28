# Configurar Google Sign-In en Firebase

Si ves **"The requested action is invalid"**, sigue estos pasos en orden.

## 1. Activar Google en Firebase

1. Abre [Firebase Console](https://console.firebase.google.com/) → proyecto **applyr-69021**
2. Ve a **Build → Authentication → Sign-in method**
3. Haz clic en **Google**
4. Activa el interruptor **Enable**
5. Elige un **Project support email** (tu Gmail)
6. Guarda

## 2. Dominios autorizados

1. En **Authentication → Settings → Authorized domains**
2. Confirma que aparezcan:
   - `localhost`
   - `applyr-69021.firebaseapp.com`
3. Si usas otro dominio (Netlify, Render, etc.), agrégalo aquí

## 3. OAuth en Google Cloud Console

1. Abre [Google Cloud Console](https://console.cloud.google.com/) → mismo proyecto **applyr-69021**
2. Ve a **APIs & Services → OAuth consent screen**
   - Tipo: **External** (o Internal si es workspace)
   - Completa nombre de app, email de soporte
   - En **Test users**, agrega tu Gmail si la app está en modo "Testing"
3. Ve a **APIs & Services → Credentials**
4. Abre el cliente OAuth **Web client** (creado por Firebase, suele llamarse "Web client (auto created by Google Service)")
5. En **Authorized JavaScript origins**, agrega:
   ```
   http://localhost
   http://localhost:8080
   https://applyr-69021.firebaseapp.com
   ```
6. En **Authorized redirect URIs**, confirma que exista:
   ```
   https://applyr-69021.firebaseapp.com/__/auth/handler
   ```
7. Guarda

## 4. Probar de nuevo

1. Recarga http://localhost:8080
2. Clic en **Continuar con Google**
3. Debería abrirse la pantalla para elegir cuenta Gmail

## Si sigue fallando

- Prueba en ventana de incógnito (sin extensiones que bloqueen cookies)
- Verifica que la **Web API Key** en `js/firebase.js` coincida con Firebase → Project settings → General → Web API Key
- Espera 2–5 minutos tras cambiar OAuth (los cambios tardan en propagarse)
