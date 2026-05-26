# Guía de Configuración para iOS (Push Notifications)

Esta guía documenta los pasos adicionales necesarios para compilar la app **Modas Nancy** para iOS y habilitar las notificaciones push.

> **Importante:** El código JavaScript (`push-notifications.js`) y el backend (`notifications-service.js`) ya son 100% compatibles con iOS. Lo que sigue es solo configuración nativa inicial.

---

## Requisitos Previos

1. **Cuenta de Apple Developer** (US$99/año) — necesaria para firmar la app y habilitar Push Notifications.
2. **Mac con Xcode** — requiere macOS para compilar y subir a App Store Connect.
3. **Proyecto Firebase ya creado** con la app Android registrada (lo hiciste al configurar Android).

---

## Paso 1: Registrar la App iOS en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com) y entra al proyecto `modasnancy-app`.
2. Haz clic en el ícono de **iOS+** para agregar una nueva app.
3. En **Apple Bundle ID**, escribe exactamente: `com.modasnancy.app`
4. Descarga el archivo **`GoogleService-Info.plist`**.

---

## Paso 2: Agregar el Proyecto iOS a Capacitor

Desde la raíz del proyecto:

```bash
npx cap add ios
```

Esto creará la carpeta `ios/` con el proyecto Xcode.

---

## Paso 3: Colocar el Archivo de Firebase

1. Copia `GoogleService-Info.plist` a:
   ```
   ios/App/App/GoogleService-Info.plist
   ```
2. Abre el proyecto en Xcode:
   ```bash
   npx cap open ios
   ```
3. Asegúrate de que `GoogleService-Info.plist` esté incluido en el **target** de la app (debería aparecer en el panel de archivos de Xcode).

---

## Paso 4: Habilitar Capacidades en Xcode

1. En Xcode, selecciona el proyecto **App** en el panel izquierdo.
2. Ve a la pestaña **Signing & Capabilities**.
3. Haz clic en **+ Capability**.
4. Busca y agrega:
   - **Push Notifications**
   - **Background Modes** → marca **Remote notifications**

---

## Paso 5: Sincronizar y Compilar

```bash
npx cap sync ios
npx cap open ios
```

En Xcode, selecciona tu dispositivo o simulador y presiona **Run**.

---

## Paso 6: Prueba en iOS

1. Instala la app en un dispositivo físico (el simulador de iOS **no** recibe notificaciones push).
2. Abre la app y acepta el permiso de notificaciones.
3. El token FCM se registrará automáticamente en el backend.
4. Desde el panel admin (**Apps > Enviar Notificación**), envía una notificación de prueba.

---

## Notas Importantes

- **APNs requiere certificados:** En Firebase, ve a **Project Settings > Cloud Messaging > iOS app configuration** y sube tu certificado APNs (desarrollo y producción) o usa la autenticación con clave APNs (.p8).
- El plugin `@capacitor/push-notifications` ya está instalado en el proyecto; funciona para ambas plataformas.
- Si cambias el `Bundle ID`, también debes actualizarlo en `capacitor.config.json` bajo `appId`.
