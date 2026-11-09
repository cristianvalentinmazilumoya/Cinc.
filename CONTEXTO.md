# Cinc — contexto del proyecto

## Qué es

Cinc es una aplicación web (PWA) para seguir las notas del ciclo de DAW (1.º y 2.º) del Institut Vidal i Barraquer. Por cada módulo guarda exámenes y actividades con su nota, porcentaje, fecha y comentario, y calcula la media del módulo, del curso y del ciclo. La interfaz está en español.

Publicada en GitHub Pages: https://cristianvalentinmazilumoya.github.io/Cinc./

## Tecnologías

- HTML, CSS y JavaScript sin frameworks ni compilación (nivel de 1.º de DAW).
- `localStorage` para guardar los datos en el dispositivo.
- Service worker (`sw.js`) para que funcione sin conexión: primero la red y, si no hay, la caché. Cada vez que cambia un archivo hay que subir la versión de `CACHE`.
- Firebase (Google Sign-In + Firestore) para sincronizar entre el Mac y el iPhone. El SDK se carga desde gstatic con `import()`.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página única: cabecera, resumen, lista de módulos, detalle del módulo y diálogos (nota, módulo, copia, sincronizar, acerca de). |
| `styles.css` | Estilos. Colores como variables en `:root`, con modo oscuro por `prefers-color-scheme`. Regla global `[hidden] { display: none !important; }`. |
| `app.js` | Interfaz: pintar módulos y notas, formularios, cursos (1.º, 2.º, Ciclo), copias de seguridad, exportar al calendario (.ics), deshacer. Expone `window.cinc` para `sync.js`. |
| `calculos.js` | Funciones puras de cálculo (medias ponderadas, recuperaciones, «¿cuánto necesito?», media por horas). Las usan la app y las pruebas. |
| `sync.js` | Sincronización con Firebase (módulo ES). |
| `firebase-config.js` | Configuración pública del proyecto de Firebase (no es secreta; la seguridad está en `firestore.rules`). |
| `firestore.rules` | Cada usuario solo puede leer y escribir su documento `usuarios/{uid}`. |
| `pruebas.html` + `pruebas.js` | 47 pruebas de los cálculos. Abrir en el navegador: todo debe salir en verde. |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA. |

## Decisiones y su motivo

- **Sin frameworks**: el código tiene que entenderse con lo visto en clase.
- **El reparto del módulo (exámenes / actividades %) es obligatorio** para tener media; sin él, la media sale «Pendiente».
- **El % de cada nota es opcional**: si ninguna lo tiene, todas cuentan igual; 0 % significa «no cuenta».
- **Media del curso y del ciclo ponderada por horas** (norma oficial de Cataluña).
- **Sincronización con Firebase** en vez de copias manuales: el usuario no quiere subir un archivo cada vez.
- **Orden de las notas en un módulo**: primero las que tienen nota y no tienen fecha, luego por fecha (de la más antigua a la más nueva) y al final las que no tienen ni nota ni fecha.

## Convenciones

- Nombres de variables y funciones en español (`pintarDetalle`, `guardar`, `datos`).
- Comentarios en español explicando el porqué.
- Contraste de colores accesible (mínimo 4,5:1), también en modo oscuro.
- Commits en español, sin líneas `Co-Authored-By` ni menciones a ninguna IA.

## Estado actual (2026-11-09)

- La app funciona y está publicada; sincroniza entre Mac e iPhone.
- 35 notas en 9 módulos de 1.º, todas con fecha.
- Prototipos del rediseño listos en `prototipos/`: tres distribuciones distintas con capturas en claro/oscuro y móvil/escritorio (familiar, módulos en lateral y panel de curso). Falta que Cristian elija una para aplicar el diseño a la app real.

## Encargo completado: prototipos de rediseño

Tras la revisión de Cristian, se rehízo la primera tanda, que solo variaba el aspecto. Ahora hay tres composiciones estáticas (Distribución familiar, Módulo al centro y Panel de curso) con datos de ejemplo; cada una incluye resumen del curso, listado de módulos, detalle y formulario de nueva nota. `prototipos/README.md` reúne la descripción y las capturas.

Pendiente de decisión: Cristian elegirá una propuesta; después se aplicará a `index.html`, `styles.css` y, si hace falta, `app.js`. El encargo original está anotado como completado en `REGISTRO.md`.
