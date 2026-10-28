# Cinc

Cinc es una app web (PWA) para consultar mis notas de 1.º de DAW. Solo lectura: las notas se escriben en la hoja de Google `Cinc - DAW 1` y la app las lee a través de un Apps Script.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño (modo claro y oscuro) |
| `app.js` | Lee la hoja, calcula las medias y pinta la página |
| `apps-script/Code.gs` | Script que se pega en la hoja y devuelve las notas en JSON |
| `manifest.webmanifest` + `sw.js` | Lo que hace que la web se pueda instalar |
| `icons/` | Iconos (favicon, PWA, iPhone, Mac) |
| `datos-ejemplo.json` | Copia de la hoja para probar sin Apps Script. No se sube a GitHub (`.gitignore`) |

---

## Paso 1 · Publicar el Apps Script

1. Abre la hoja `Cinc - DAW 1` en Google Sheets.
2. Menú **Extensiones → Apps Script**. Se abre un editor con un archivo `Código.gs`.
3. Borra lo que haya y pega el contenido de `apps-script/Code.gs`. Pulsa el icono de guardar (💾).
4. Arriba a la derecha: **Implementar → Nueva implementación**.
5. En la rueda ⚙️ junto a «Seleccionar tipo», elige **Aplicación web**.
6. Rellena:
   - Descripción: `Notas DAW1`
   - Ejecutar como: **Yo (cristianmazilumoya@gmail.com)**
   - Quién tiene acceso: **Cualquier usuario**
7. Pulsa **Implementar** y luego **Autorizar acceso**. Elige tu cuenta.
   - Saldrá «Google no ha verificado esta aplicación». Es normal (el script es tuyo): pulsa **Configuración avanzada → Ir a … (no seguro)** y después **Permitir**.
8. Copia la **URL de la aplicación web** (acaba en `/exec`).
9. Pégala en una pestaña nueva del navegador: deberías ver un texto JSON que empieza por `{"actualizado":...,"filas":[["Módulo","Tipo",...`.

> **Privacidad**: la hoja sigue siendo privada, pero cualquiera que tenga esa URL (o abra tu web) puede ver las notas. No hay forma de evitarlo con una web estática sin inicio de sesión (la opción 3, OAuth, sería para más adelante).

> **Si cambias el script más adelante**: *Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar*. Así la URL no cambia.

## Paso 2 · Poner la URL en la app

En `app.js`, línea 7:

```js
const URL_DATOS = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

Mientras esté vacía, la página usa `datos-ejemplo.json` y muestra un aviso.

## Paso 3 · Probar en el Mac

El service worker y `fetch` no funcionan abriendo el archivo con doble clic; hace falta un servidor local. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y abre http://localhost:8000. Para pararlo: `Ctrl + C`.

## Paso 4 · Subirlo a GitHub Pages

1. En https://github.com/new crea un repositorio, por ejemplo `notas-daw1` (público: GitHub Pages gratis solo funciona con repos públicos).
2. En la carpeta del proyecto:

   ```bash
   git init
   git add .
   git commit -m "Primera versión de Notas DAW1"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/notas-daw1.git
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → **Save**.
4. Al cabo de un minuto la web estará en `https://TU_USUARIO.github.io/notas-daw1/`.

## Paso 5 · Instalarla

- **Mac con Safari**: abre la web → menú **Archivo → Añadir al Dock**.
- **Mac con Chrome**: icono de instalar a la derecha de la barra de direcciones (o menú ⋮ → *Transmitir, guardar y compartir → Instalar página como aplicación*).
- **iPhone (Safari)**: botón Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome)**: menú ⋮ → **Instalar aplicación**.

## Cómo se calculan las medias

- Media de exámenes / prácticas: media ponderada (nota × peso / suma de pesos) de las filas con nota.
- Media del módulo: con reparto oficial (DIW 60/40, SI 50/50, DIG 35/45, NT 40/60) se combinan los grupos que ya tienen nota; sin reparto, media ponderada de todas sus notas.
- Media del curso: media simple de las medias de los módulos con nota.

Los repartos están en la lista `MODULOS` al principio de `app.js`.

## Cuando cambies la app

Si modificas `index.html`, `styles.css` o `app.js`, sube el número de `CACHE` en `sw.js` (`cinc-v5` → `cinc-v6`) para que los móviles con la app instalada descarguen la versión nueva.
