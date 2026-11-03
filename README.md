# Cinc

Cinc es una app web (PWA) para apuntar las notas de clase y ver las medias de cada módulo. Cada persona crea sus módulos, añade sus notas y Cinc calcula las medias. Funciona sin cuentas ni servidor: los datos se guardan en el propio dispositivo (`localStorage`).

Web: https://cristianvalentinmazilumoya.github.io/Cinc./

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página y los formularios (`<dialog>`) |
| `styles.css` | Diseño (modo claro y oscuro) |
| `app.js` | Guarda los datos, calcula las medias y pinta la página |
| `manifest.webmanifest` + `sw.js` | Lo que hace que la web se pueda instalar y abra sin conexión |
| `icons/` | Iconos (favicon, PWA, iPhone, Mac) |

## Cómo se usa

1. **Primer uso:** «Usar la plantilla de 1.º DAW» crea los módulos de DAW de golpe. También se pueden crear a mano («Crear un módulo») o cargar una copia de seguridad.
2. **Módulos:** la tarjeta «+ Módulo» crea uno nuevo; «Editar módulo» (en el detalle) cambia el nombre, la sigla o el reparto, o lo borra junto con sus notas.
3. **Notas:** «+ Añadir nota» arriba, o «+ Añadir nota de …» en el detalle de un módulo. Toca una fila de la tabla para editarla o borrarla. Si aún no hay nota, se deja vacía y sale como pendiente.
4. **Copia de seguridad:** botón «Copia». «Descargar copia» guarda un archivo `cinc-copia-AAAA-MM-DD.json`; «Cargar una copia» lo recupera en este u otro dispositivo (sustituye lo que haya).

### Dónde se guardan los datos

En `localStorage`, con la clave `cinc-datos`. Cada navegador y cada dispositivo tiene sus propios datos: no se sincronizan solos. Si alguien borra los datos del navegador, los pierde, por eso la app recuerda hacer una copia cuando hace más de un mes de la última.

La primera vez que se abre esta versión, si el navegador aún tenía las notas de la versión anterior (la que leía la hoja de Google), las pasa solas al formato nuevo.

## Cómo se calculan las medias

- **Porcentaje de cada nota:** cada nota tiene un porcentaje dentro de su grupo: dentro de los exámenes o de las actividades si el módulo tiene reparto, o dentro de todo el módulo si no lo tiene. En cada grupo los porcentajes suman 100 % (por ejemplo, tres actividades de 20 %, 30 % y 50 %). **Una nota sin porcentaje (vacío o 0) no cuenta en la media**: la app no inventa lo que vale.
- **Media de exámenes / actividades:** media ponderada (nota × porcentaje / suma de porcentajes) de las notas puestas que tienen porcentaje, en proporción. Si de 20 %, 30 % y 50 % solo hay nota de las dos primeras, la media se calcula con esas dos como si fueran el 100 % y la app indica «sobre el 50 % evaluado». Cuando llega la tercera, la media pasa a ser sobre el 100 %.
- **Media del módulo:** si el módulo tiene reparto oficial (por ejemplo DIW 60/40), se combinan las dos medias con esos porcentajes. Si solo uno de los dos grupos tiene media, la del módulo es la de ese grupo y se marca como provisional, con el motivo (aún no hay notas del otro grupo, o les falta el porcentaje). Un grupo que vale 0 % en el reparto nunca cuenta. Sin reparto, es la media ponderada de todas sus notas.
- **Media pendiente:** si un módulo tiene notas puestas pero ninguna con porcentaje, la media queda pendiente y se explica que se calculará cuando se indique el porcentaje de cada nota.
- **Parte evaluada de la nota final:** debajo de la media del módulo se indica qué parte de la nota final ya está evaluada (por ejemplo, en un 60/40 con la mitad de cada grupo hecha, «sobre el 50 % evaluado»).
- **Media del curso:** media simple de las medias de los módulos que tienen media.

### Avisos

- Pendiente: hay notas puestas, pero ninguna tiene porcentaje.
- Hay notas puestas que aún no cuentan porque les falta el porcentaje.
- Los porcentajes de un grupo suman más del 100 %.
- Todos los porcentajes de un grupo suman justo lo que vale el grupo en la nota final (por ejemplo 10 + 10 + 20 = 40 % en las actividades de un 60/40): seguramente se han puesto sobre la nota final y no dentro del grupo. La media sale igual, pero la parte evaluada no llegaría nunca al 100 %.
- Un grupo vale 0 % en el reparto pero tiene notas.

Las notas y los porcentajes aceptan coma o punto decimal (`8,5` o `8.5`).

## Probar en el Mac

El service worker no funciona abriendo el archivo con doble clic; hace falta un servidor local. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Y abre http://localhost:8000. Para pararlo: `Ctrl + C`.

## Publicar cambios

La web se publica con GitHub Pages desde la rama `main`. Al hacer push a `main`, en un minuto está en línea.

Si modificas `index.html`, `styles.css` o `app.js`, sube el número de `CACHE` en `sw.js` (`cinc-v18` → `cinc-v19`). Las apps instaladas se actualizan solas la próxima vez que se abren con conexión.

## Instalarla

- **Mac con Safari:** abre la web → menú **Archivo → Añadir al Dock**.
- **Mac con Chrome:** icono de instalar a la derecha de la barra de direcciones.
- **iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar aplicación**.
