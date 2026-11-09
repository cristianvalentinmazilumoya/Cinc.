# Propuestas de rediseño de Cinc

Las tres opciones proponen distribuciones y recorridos distintos, con datos de ejemplo de 1.º DAW. Cada prototipo estático contiene el resumen, los módulos, el detalle de Programació, sus notas y un formulario de alta. No modifica ni guarda datos de la app real.

- **A · Distribución familiar** (`a-calma.html`): conserva el orden reconocible de Cinc: cabecera y cursos, resumen, módulos en cuadrícula y después el detalle. En escritorio, el detalle y el alta quedan juntos al final; en móvil se apilan.
- **B · Módulo al centro** (`b-cuaderno.html`): convierte la vista en un espacio de trabajo de tres zonas: módulos a la izquierda, notas en el centro y registro rápido a la derecha. En móvil esas zonas se apilan para navegar módulo por módulo.
- **C · Panel de curso** (`c-panel.html`): pone la media calculada con las notas guardadas y la próxima fecha registrada arriba; después compara los módulos junto a la agenda y deja el detalle completo al pie. No estima qué parte del curso está evaluada.

## Capturas

En `capturas/` hay cuatro PNG por propuesta: móvil (390 × 844) y escritorio (1440 × 900), en claro y oscuro. Las capturas móviles muestran la parte superior de cada diseño; al desplazarse por el HTML aparecen las demás secciones.

| Propuesta | Móvil claro | Móvil oscuro | Escritorio claro | Escritorio oscuro |
|---|---|---|---|---|
| A · Distribución familiar | `a-calma-390x844-claro.png` | `a-calma-390x844-oscuro.png` | `a-calma-1440x900-claro.png` | `a-calma-1440x900-oscuro.png` |
| B · Módulo al centro | `b-cuaderno-390x844-claro.png` | `b-cuaderno-390x844-oscuro.png` | `b-cuaderno-1440x900-claro.png` | `b-cuaderno-1440x900-oscuro.png` |
| C · Panel de curso | `c-panel-390x844-claro.png` | `c-panel-390x844-oscuro.png` | `c-panel-1440x900-claro.png` | `c-panel-1440x900-oscuro.png` |

## Nombre y logo

La exploración está en [identidad/README.md](identidad/README.md) y [identidad/index.html](identidad/index.html). Compara tres direcciones desarrolladas con argumento, tono, paleta y una muestra de interfaz: **Cinc** (continuidad), **Nota a nota** (descriptiva) y **Quadern** (local). Cada una tiene un símbolo vectorial SVG independiente. La app publicada conserva su identidad actual.
