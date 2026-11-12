# Integraciones Google: código, contratos y operación

> Auditoría independiente · 2026-10-23 UTC · `main@2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7` · rama `audit/codex-deep-review`. Evidencia del código fijada a ese SHA; no se cambió código funcional.

**Ningún servicio Google se acredita como funcional end-to-end contra una cuenta real.** Las escrituras se probaron con mocks; no se enviaron correos ni se modificaron calendarios, archivos o contactos reales. No se usó la conexión Google de esta conversación para suplir credenciales de la aplicación auditada.

En la matriz, «mock» significa que el código del adaptador construyó la solicitud y procesó una respuesta sintética. No demuestra consentimiento OAuth, cuota, configuración del proyecto ni aceptación real del contrato por Google. «Bloqueado live» indica falta de cuenta/proyecto de prueba autorizado; no implica caída del servicio.

| Servicio | SDK/API y autenticación | Scopes del código | Lectura | Escritura | Renovación / errores | Estado final |
|---|---|---|---|---|---|---|
| Identity / OAuth 2.0 | Firebase GoogleAuthProvider + signInWithPopup; no GIS separado | 17 scopes Workspace, además de los propios de identidad del SDK | Popup no ejercitado live | Consentimiento no ejercitado | Access token sólo en memoria; no expiración/refresh Workspace; error propagado | PARTIAL; live BLOCKED |
| Firebase Authentication | firebase/auth, onAuthStateChanged, signOut | Firebase ID token gestionado por SDK; distinto del access token Workspace | Listener presente; navegador renderiza sin sesión | Sign-in/out código presente | SDK puede renovar ID token; eso no renueva el token Workspace cacheado | IMPLEMENTED_UNTESTED; live BLOCKED |
| Firestore | firebase/firestore, DB del JSON, UID cliente | Reglas por request.auth.uid; no scopes OAuth de Workspace | onSnapshot código; sin prueba de emulator/live | setDoc/deleteDoc presentes; sin escrituras reales | Errores se capturan/loguean; no se devuelven al llamador | PARTIAL por consistencia; reglas desplegadas BLOCKED |
| Gmail | REST gmail.googleapis.com; Bearer de getAccessToken | mail.google.com + gmail.modify/readonly/send/compose | Lista y detalle mock; metadatos en paralelo presentes | Send mock; confirmación en UI; sin MIME adjunto real | 401 de lista solicita reconectar; sin refresh/retry; fallos parciales de metadatos se descartan | PARTIAL; live BLOCKED |
| Calendar | REST calendar/v3; accessToken explícito | calendar, calendar.events, calendar.readonly | List mock; sin paginación completa | Create y Delete mock; sin Update en servicio | throw ante HTTP error; delete404 tolerado; 401 mock no reintenta | PARTIAL; live BLOCKED |
| Drive | REST drive/v3/files para Docs; Google Picker gapi | drive, drive.file, drive.readonly | List Docs mock; Picker no probado live | Upload view presente, sin escritura probada; creación Docs genera archivo Drive | Picker carga script y maneja error; sin renovación | PARTIAL; live BLOCKED |
| Docs | REST docs/v1/documents, batchUpdate | documents y documents.readonly | Get mock; sólo extrae párrafos top-level | Create + insertText mock; UI crea con confirmación | Puede crear documento y fallar inserción sin rollback; UI no usa insertText para guardar cambios del editor | PARTIAL; live BLOCKED |
| Sheets | No API Sheets ni SDK encontrado | No scope spreadsheets | Ausente | Ausente | No aplica | MISSING; tabla local/CSV no es Sheets |
| Slides | No API Slides ni SDK encontrado | No scope presentations | Ausente | Ausente | No aplica | MISSING |
| Tasks | No API tasks.googleapis.com encontrada | No scope tasks | Ausente | Ausente | No aplica | MISSING; tareas locales/Firestore son otra capacidad |
| Contacts / People | REST people.googleapis.com, Bearer | contacts/readonly, user.emails.read, user.phonenumbers.read | List mock; sólo primera página y primer nombre/teléfono | Create/Delete mock, confirmación UI de borrado presente | Errores HTTP propagados; delete404 tolerado; sin refresh | PARTIAL; consumidor de contactos BROKEN por campo phone |
| Maps | @vis.gl/react-google-maps + REST geocode + navegador geolocation | API key cliente; no OAuth Workspace | Código de mapa/búsqueda/geolocation presente; red bloqueada en navegador | No edición de datos Google implementada | Algunos avisos UI; restricciones/billing de clave no evaluados | IMPLEMENTED_UNTESTED; live BLOCKED |
| Meet | No Meet API, reuniones/conferenceData ni SDK de Meet | No scopes Meet | Ausente | Ausente | No aplica | MISSING |

Evidencias por servicio: [src/services/googleAuth.ts:30](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleAuth.ts#L30), [src/services/googleAuth.ts:93](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleAuth.ts#L93), [src/services/firestoreSyncService.ts:21](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/firestoreSyncService.ts#L21), [src/services/gmailService.ts:38](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/gmailService.ts#L38), [src/services/gmailService.ts:156](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/gmailService.ts#L156), [src/services/googleCalendarService.ts:28](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleCalendarService.ts#L28), [src/services/pickerService.ts:60](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/pickerService.ts#L60), [src/services/googleDocsService.ts:23](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleDocsService.ts#L23), [src/services/googleContactsService.ts:20](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleContactsService.ts#L20), [src/components/GoogleMapsPanel.tsx:127](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/components/GoogleMapsPanel.tsx#L127). Las ausencias se establecen por inventario y búsqueda de imports, hosts, scopes y consumidores en todo el árbol, no por ausencia de un botón.

## Identidad y ciclo de sesión (F20)

`googleSignIn` obtiene un accessToken mediante credentialFromResult y lo guarda en memoria. `getAccessToken` sólo retorna ese valor, sin refresh, expiresAt ni nueva concesión. Tras reload, Firebase puede conservar usuario pero cachedAccessToken está vacío: initAuth llama onAuthFailure en lugar de reconstruir sesión Workspace. Se requiere reconectar. [src/services/googleAuth.ts:65](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleAuth.ts#L65), [src/services/googleAuth.ts:75](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleAuth.ts#L75), [src/services/googleAuth.ts:115](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleAuth.ts#L115). No hay robo de tokens OAuth demostrado; el problema confirmado es ciclo de vida incompleto y excesivo alcance de permisos.

Los 17 scopes exactos declarados son:

```text
https://mail.google.com/
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/documents.readonly
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/contacts
https://www.googleapis.com/auth/contacts.readonly
https://www.googleapis.com/auth/user.emails.read
https://www.googleapis.com/auth/user.phonenumbers.read
```

Se solicitan a la vez scopes completos y readonly redundantes, incluido acceso total a Gmail/Drive. No se comprueba por servicio qué permisos fueron efectivamente concedidos. Activar un selector de integración sólo cambia preferencia/prompts y puede abrir modales; no significa que se haya concedido OAuth o realizado sync. [src/App.tsx:1348](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L1348).

## Firestore: autorización fuente y sincronización defectuosa (F03/F14)

Las reglas fuente **sí** restringen users/{uid}, tareas y eventos al propietario y requieren userId/uid al escribir. No se encontraron reglas globales `allow true`. Sin embargo `/test/{docId}` permite lectura/escritura a cualquier autenticado, el esquema de tareas/eventos apenas se valida y no hay prueba de que estas reglas estén desplegadas en la DB configurada. [firestore.rules:9](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/firestore.rules#L9), [firestore.rules:18](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/firestore.rules#L18), [firestore.rules:30](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/firestore.rules#L30). No se ejecutó emulator ni acceso a otra cuenta.

Los snapshots vacíos no llegan al consumidor. App sólo añade IDs desconocidos, conservando títulos/estado locales de registros existentes; borrados remotos reaparecen o permanecen localmente. saveTask omite recurrence/subtasks/createdAt y saveEvent omite endTime/location/attendees/recurrence. Los errores se absorben con warn y el consumidor puede mostrar éxito. El interruptor cloudSyncEnabled no gobierna el efecto que escribe perfil o se suscribe. [src/services/firestoreSyncService.ts:56](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/firestoreSyncService.ts#L56), [src/services/firestoreSyncService.ts:96](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/firestoreSyncService.ts#L96), [src/services/firestoreSyncService.ts:157](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/firestoreSyncService.ts#L157), [src/App.tsx:454](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L454), [src/App.tsx:1723](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L1723).

Las claves de localStorage no incluyen UID. Al cambiar de cuenta se conservan tareas/contactos/chat de la anterior, y se mezclan con los documentos remotos nuevos. El aislamiento de las reglas Firestore no corrige ese aislamiento de sesión de la UI. [src/App.tsx:305](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L305), [src/App.tsx:464](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L464).

## Gmail, Drive y Docs: límites de la interfaz

Hay una confirmación antes de sendGmailEmail; esto es un control útil del flujo UI, no una garantía de autorización central para herramientas de agentes. Los «adjuntos» Drive se añaden como enlaces de texto; no se descargan ni adjuntan bytes MIME. No hay soporte de borradores Gmail persistidos, delete o labels aunque se pidan scopes amplios. [src/components/GmailModal.tsx:152](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/components/GmailModal.tsx#L152), [src/services/gmailService.ts:168](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/gmailService.ts#L168).

Picker construye DocsView y DocsUploadView con OAuth y origen; no configura developerKey/appId en este código. Falta validar la configuración del proyecto en una prueba autorizada: no se declara roto por ese dato aislado. [src/services/pickerService.ts:82](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/pickerService.ts#L82).

Docs lee sólo párrafos del cuerpo superior, sin extracción de tablas/tabs/estructuras anidadas. insertText siempre inserta en índice 1. El servicio permite insertText, pero su importación del editor está sin usar; editar la copia local no prueba actualización del documento remoto. [src/services/googleDocsService.ts:76](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleDocsService.ts#L76), [src/services/googleDocsService.ts:138](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleDocsService.ts#L138), [src/components/DocumentSpreadsheetModal.tsx:28](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/components/DocumentSpreadsheetModal.tsx#L28).

## Contacts: defecto confirmado (F15)

La conversión produce `number` mediante cast any; PhoneContact exige `phone`. El parser y consumidores usan phone. Con un contacto convertido y una búsqueda que no coincida por nombre se obtiene TypeError por `.includes` sobre undefined. El mock de People CRUD pasa, pero la integración de esos datos al teléfono está defectuosa. [src/services/googleContactsService.ts:68](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/googleContactsService.ts#L68), [src/types/index.ts:860](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/types/index.ts#L860), [src/utils/rtLiteEngine.ts:233](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/utils/rtLiteEngine.ts#L233).

## Condiciones para una verificación live futura

Proyecto OAuth/Firebase de ensayo, scopes mínimos revisados, cuenta sin datos personales y recursos desechables explícitamente autorizados. Probar concesión parcial, recarga, expiración/revocación, 401/403/429, paginación, actualizaciones/borrados remotos, aislamiento entre dos usuarios y reglas con emulator antes de tocar recursos reales. Esta auditoría no ejecutó esos pasos externos ni presume sus resultados.
