# Protocolo de imágenes de fondo y publicidad no invasiva

Estado: **borrador de diseño (ideación + verificación)** — sesión 2026-06-13.
Ámbito: skin `devanture/` (prototipo p5.js). Se portará al app React en la Fase 8.

Este documento define cómo deben construirse, validarse y automatizarse las
imágenes de fondo del juego, y cómo integrar **publicidad no invasiva e
hiper-seleccionada** sin degradar el estándar de calidad gráfica ni la
legibilidad del tablero.

> **Principio rector — "pista de tenis" (Roland Garros).** La zona central de
> juego (el tablero, los dados, los textos y los iconos) se mantiene siempre
> despejada y "tranquila", como la pista. La marca vive en la periferia de la
> imagen (las gradas, las vallas perimetrales), de forma ambiental y elegante.
> El usuario nunca llega al patrocinador por un clic accidental en el fondo:
> solo a través de un **botón discreto** dibujado por la aplicación.

La foto de referencia (cancha de tierra batida con vallas BNP Paribas / Emirates
/ Roland Garros y la pista limpia en el centro) ilustra exactamente este reparto.

---

## 1. Situación actual

- El fondo es el `background` del `<body>` en CSS: `background-size: cover;
  background-position: center center;` (ver `index.html`). El canvas p5 es
  transparente (`clear()`), así que la foto se ve **detrás** de todo el render.
- Como el fondo es CSS y no el canvas, **un clic en el fondo no navega a ningún
  sitio** hoy: el canvas captura los clics y los enruta por contexto. Esto ya
  cumple el requisito de "jamás por error de clic en la imagen". El botón
  patrocinador será el **único** elemento clicable que abra una URL externa.
- Pool actual = `FOND_LIST = ['fond1.jpg', 'fond2.jpg']` (en `sketch.js`). Son
  las **dos imágenes provisorias** a reemplazar. `fond1.jpg` pesa 1,7 MB
  (excede el presupuesto, ver §4) y está además rotada 90°; `fond2.jpg` ≈ 245 KB.
- `newMatch()` sortea un fondo distinto por partida, extrae la tinte dominante
  (`extractDominantHue`) y reconstruye la paleta (`buildPalette`). Cualquier
  imagen nueva debe seguir funcionando con ese pipeline de paleta.

---

## 2. Verificación del espacio disponible

Geometría real (extraída de `computeGeometry()` y `getDiePos()`). Unidad base
`a` = ancho de un punto del tablero; `r = a/2`. El **tablero mide `13a × 13a` y
está siempre centrado** en el viewport, en `(bx, by)` con
`bx = (W − 13a)/2`, `by = (H − 13a)/2`.

Diagramas: `devanture/docs/zones_landscape.svg` y `zones_portrait.svg`
(generados por `docs/gen_zone_diagrams.py`).

### 2.1 Horizontal (landscape, `W ≥ H·1.1`)

`a = min(W/25, H/15)` (NAMES_W_A = 6 ⇒ totalA = 13 + 2·6 = 25; totalH = 15).

| Región | Ocupación |
|--------|-----------|
| Tablero | central, `13a × 13a` |
| Gutter izquierdo | **dados** en columna vertical (centro `bx − 2.75r`, ancho `3.5r`, alto = 13a) + pila **bandera/exit/cubo** a ~`2r` del borde |
| Gutter derecho | **nombres / scores** (reserva `NAMES_W_A = 6a` para la etiqueta más larga al hacer hover) |
| Franja superior / inferior | solo `~1a` cada una → números de punto 1–24, muy justa |
| Modo espejo (`mirrorMode`) | la columna de dados puede aparecer **a la derecha** → la zona de exclusión debe ser **simétrica** |

**Conclusión landscape:** los gutters laterales son anchos (≥ 6a) pero están
**ocupados por UI** (dados + controles a la izquierda/derecha en espejo,
nombres a ambos lados). El espacio realmente libre y sin colisión es escaso.
→ En landscape la publicidad debe ser **ambiental** (integrada en la foto, a
bajo contraste, en los tercios externos de los gutters), nunca un bloque de
logo recortado. El **botón patrocinador va abajo-derecha** (libre durante la
partida; el exit vive en el margen izquierdo en juego activo).

### 2.2 Vertical (portrait)

`a = min((W − 16)/13, H/22)`. El tablero ocupa casi todo el ancho (márgenes
laterales de 8 px). Las **bandas superior e inferior miden ≥ 9r (= 4,5a)** cada
una.

| Región | Ocupación |
|--------|-----------|
| Banda superior | dados negros + nombre/pip pegados al tablero; **esquina sup-derecha** = bandera/cubo (`~5,7r`) |
| Banda inferior | dados blancos + nombre/pip pegados al tablero; aviso de doblaje; **esquina inf-derecha** = botón EXIT |
| Franja externa superior | por **encima** de la fila de dados/nombre: full width × `~2,7a` → **zona libre** salvo la esquina sup-derecha |

**Conclusión portrait:** es la **mejor orientación para publicidad**. La franja
superior (banner full-width sobre la fila de dados) está casi totalmente libre;
la inferior es secundaria (más poblada por aviso de doblaje + exit). El **botón
patrocinador va arriba-izquierda** (esquina libre).

### 2.3 Modelo de zonificación (formal, automatizable)

Tres capas, definidas como fracciones del viewport para ser independientes de
resolución:

1. **EXCLUSION ZONE (núcleo tranquilo).** Bounding box de {tablero, dados,
   bloques de info}. La imagen aquí debe ser visualmente **calmada**: sin
   rostros, sin texto, sin logos, sin puntos focales de alto contraste, para no
   competir con fichas/dados/textos ni provocar ilegibilidad. **Prohibido**
   cualquier contenido de marca o CTA.
   - Landscape (mirror-safe): central **≈ 66 % del ancho × 90 % del alto**.
   - Portrait: central **≈ 100 % del ancho × (alto del tablero + filas de dados)**,
     i.e. todo salvo las franjas externas sup/inf.
2. **UI KEEP-OUT (recortes de UI).** Sub-rectángulos dentro/junto a la zona de
   exclusión donde además **ningún logo ni el botón** pueden situarse: columna
   de dados, pila bandera/exit/cubo, columnas de nombres, esquina del cubo.
3. **ADVERTISING-SAFE ZONE.** El resto periférico. Aquí puede vivir contenido de
   marca (a bajo contraste en landscape; como banner en la franja superior en
   portrait) y, por encima, el botón patrocinador en su ancla designada.

---

## 3. Reparto inteligente de la información (la "imagen ideal")

Una sola foto debe servir en ambas orientaciones por culpa del `cover`
+ centrado. Por eso el protocolo exige **dos variantes por fondo**:

- `…-landscape.jpg` — apaisada, marca difusa en gutters, núcleo central calmado.
- `…-portrait.jpg` — vertical, marca en banda superior, núcleo central calmado.

La app elige la variante según `W ≥ H·1.1`. Si solo hay una variante, se usa
para ambas (degradación aceptable, no recomendada).

Composición exigida en cada variante (ver máscara en §4.3):

- **Núcleo central calmado** que cubra la EXCLUSION ZONE de esa orientación.
- **Banda de marca** colocada donde la orientación tiene hueco (gutters en
  landscape, banda superior en portrait), evitando los UI KEEP-OUT.
- Sin texto legible "quemado" en la foto salvo, opcionalmente, un wordmark de
  marca **muy discreto** dentro de la banda de marca (nunca en el núcleo).

---

## 4. Requisitos de la imagen

### 4.1 Dimensiones y formato

| Parámetro | Landscape | Portrait |
|-----------|-----------|----------|
| Aspect ratio objetivo | 16:9 (autoriza hasta 21:9 por `cover`) | 9:16 |
| Resolución mínima | 1920×1080 | 1080×1920 |
| Formato | `.jpg` (calidad 80–85) o `.webp` | igual |
| **Presupuesto de peso** | **≤ 300 KB** optimizado | **≤ 300 KB** |
| Espacio de color | sRGB | sRGB |

`fond1.jpg` (1,7 MB) **incumple** el presupuesto y debe re-comprimirse o
descartarse. Mantener el peso bajo es crítico en móvil (el fondo bloquea la
primera pintura nítida).

### 4.2 Legibilidad / contraste

- El render aplica un voile y deriva la paleta de la **tinte dominante**. Las
  fotos deben tener una tinte dominante clara y estable (evitar imágenes
  multicolor caóticas) para que `buildPalette()` produzca una paleta coherente.
- En la EXCLUSION ZONE, el contraste local debe ser bajo (luminancia uniforme),
  para garantizar legibilidad de fichas blancas/negras, dados y textos marfil.
- Evitar zonas que choquen con los colores del juego (p. ej. grandes manchas
  marfil donde van textos marfil, o rojo intenso donde van halos dorados).

### 4.3 Máscara de zona segura (plantilla para autores / IA)

Plantilla conceptual que todo candidato debe respetar (coordenadas como
fracción del lienzo de la variante):

```
LANDSCAPE (16:9)                      PORTRAIT (9:16)
┌───────────────────────────┐        ┌───────────────────────────┐
│ marca  · · ·CALMA· · ·  m  │        │      BANDA DE MARCA        │  ← 0–22%
│ amb.   · · · · · · · ·  a  │        ├───────────────────────────┤
│ (gut.) · ·EXCLUSION· ·  r  │        │ · · · · · CALMA · · · · ·  │
│ ←17%   · · · · · · · ·  ca │        │ · · · · EXCLUSION · · · ·  │  22–82%
│        · · · · · · · ·  17%│        │ · · · · · · · · · · · · ·  │
└───────────────────────────┘        ├───────────────────────────┤
  calma central 66%×90%               │      (banda inferior)      │  ← 82–100%
                                      └───────────────────────────┘
```

---

## 5. Botón patrocinador

- **Único** elemento que abre una URL externa. Dibujado por la app (no forma
  parte de la imagen).
- **Discreto:** pequeño, baja opacidad en reposo (~0,55), full al hover/touch.
  Texto corto o wordmark del patrocinador. Altura ≈ `1,2r`.
- **Anclaje** (esquina libre por orientación, ver §2):
  - Landscape: **abajo-derecha**, a `r/2` del borde (durante partida activa el
    EXIT está en el margen izquierdo). Ocultar en game-over / lobby / overlays.
  - Portrait: **arriba-izquierda**, a `r/2` del borde (TR = bandera/cubo,
    BR = exit, banda inferior = aviso).
- **Comportamiento:** abre `sponsor.url` en pestaña nueva con
  `rel="noopener noreferrer"`. Zona clicable = solo el rect del botón
  (registrar en una lista tipo `exitBtns`, no en el fondo).
- **Accesibilidad / honestidad:** marcar como publicidad (p. ej. prefijo `◆` o
  etiqueta "sponsor"); nunca disfrazar el botón de control del juego.
- Si el fondo activo no tiene patrocinador (`sponsor == null`), **no** se
  dibuja botón.

---

## 6. Manifiesto de fondos (automatización)

La app dejará de hardcodear `FOND_LIST` y leerá un manifiesto JSON
(`devanture/backgrounds.manifest.json`). Cada entrada describe un fondo, sus
variantes de orientación, el patrocinador y el estado de validación. Esto
permite que un proceso automático **añada/retire fondos editando solo el JSON**.

Esquema por entrada (ver ejemplo completo en `backgrounds.manifest.json`):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | identificador único (slug) |
| `variants.landscape` | string | ruta a la imagen apaisada |
| `variants.portrait` | string | ruta a la imagen vertical |
| `dominantHueOverride` | number\|null | fuerza la tinte (0–360) si la autoextracción falla |
| `sponsor` | object\|null | `null` = fondo sin publicidad |
| `sponsor.name` | string | nombre de la marca |
| `sponsor.url` | string | URL destino (https) |
| `sponsor.buttonLabel` | string | texto del botón discreto |
| `source` | object | `{type:"ai"\|"stock"\|"owned", credit, license}` |
| `validation` | object | `{exclusionClear, contrastOk, weightKb, checkedAt}` |
| `alt` | string | descripción accesible |

Reglas:
- Una entrada solo entra al pool en runtime si `validation.exclusionClear === true`
  **y** `validation.contrastOk === true` **y** `weightKb ≤ 300`.
- `sponsor.url` debe ser `https://` y de dominio en lista blanca (anti-abuso).

---

## 7. Pipeline de automatización

### 7.1 Búsqueda de imágenes reales (stock)

- **Criterios:** una sola tinte dominante, centro de baja-frecuencia (cielo,
  agua, pared, textura, bokeh), interés visual en la periferia, sin texto
  incrustado, licencia comercial clara (CC0 / licencia de stock con derechos
  para publicidad).
- **Queries semilla** (combinar tinte + "espacio negativo central"):
  `"minimalist [color] background negative space center"`,
  `"[color] gradient texture copy space"`,
  `"aerial [landscape] muted tones centered emptiness"`.
- Rechazar: rostros/figuras en el centro, alto detalle central, watermarks,
  resolución < mínimos.

### 7.2 Generación por IA

Plantilla de prompt (rellenar `{tinte}`, `{tema}`, orientación):

```
A {tinte}-toned {tema} background, {16:9|9:16}, high graphic quality,
photographic, the CENTRAL {66%|60%} of the frame is calm and low-contrast
with NO subjects/text/logos (negative space for an overlaid game board),
visual interest and texture confined to the {left & right margins | top band},
soft cinematic lighting, single dominant hue, no watermark, no text.
```

Negative prompt: `text, watermark, logo, busy center, high-contrast center,
faces in center, clutter`.

Post-proceso obligatorio: generar **ambas** variantes (no recortar a la fuerza
una de otra si rompe la composición), comprimir a ≤ 300 KB, registrar
`source.type = "ai"`.

### 7.3 Validación automática (QA)

Antes de hacer commit de un fondo al manifiesto, comprobar:

- [ ] **Overlap de exclusión:** ningún punto focal/borde de alto contraste cae
      en la EXCLUSION ZONE (heurística: varianza/energía de gradiente del
      recorte central por debajo de un umbral).
- [ ] **Contraste de legibilidad:** simular voile + render de una ficha marfil y
      una negra sobre el recorte central → contraste ≥ umbral WCAG-like.
- [ ] **Peso:** `≤ 300 KB` por variante.
- [ ] **Click-safety:** confirmar que solo el rect del botón es clicable (el
      fondo nunca navega).
- [ ] **Licencia / consentimiento:** `source.license` presente y compatible con
      uso publicitario; si hay personas reconocibles, model release.
- [ ] **Tinte:** `extractDominantHue` devuelve un valor estable y la paleta
      resultante no choca con los colores del juego.

---

## 8. Pasos de implementación en la skin (siguiente sesión)

1. Crear `backgrounds.manifest.json` (hecho: ejemplo en este PR).
2. Cargar el manifiesto en `setup()` y derivar `FOND_LIST` de las entradas
   válidas; `currentFond` pasa a ser una entrada (con variantes), no un string.
3. En `computeGeometry()` exponer `bx, by, a, r, diceOnSide` (ya existen) y
   añadir un helper `sponsorButtonRect()` por orientación (§5).
4. Dibujar el botón patrocinador en `draw()` (tras el render de juego, antes de
   overlays), registrar su rect, y manejar el clic en `mousePressed` abriendo
   `window.open(url, '_blank', 'noopener')`.
5. Seleccionar `variants.landscape|portrait` según `diceOnSide` al cargar la
   imagen de fondo (`loadImage` + `document.body.style.backgroundImage`).
6. (Opcional dev) tecla de depuración para superponer las zonas en pantalla y
   verificar visualmente (equivalente runtime de los SVG de §2).

> Esta sesión cubre **ideación + verificación + protocolo + manifiesto +
> diagramas**. El cableado en `sketch.js` (pasos 2–6) se hará en la siguiente
> sesión para no desestabilizar la skin sin poder ejecutarla aquí.
