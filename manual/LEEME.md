# Manual de usuario de CladisticsPro

El manual se escribe por partes, en HTML, con el mismo estilo que los manuales de PhenologyPro, EconomicsPro,
PhylogenyPro y las demás apps LABG. Primero se hace en español; la versión en inglés se decide al final. Cuando
todas las partes están listas se unen en un solo documento y se imprime a PDF **una sola vez**.

```
manual/
  manual.css           hoja común: tamaño carta y marco de la portada
  interior.css         páginas interiores: hojas blancas, vivos en terracota profundo y negro, un color por bloque
  paginar.js           reparte el contenido en hojas tamaño carta (encabezados, números de página, índice)
  img/                 capturas de pantalla de la app
  herramientas/
    captura.ps1        abre la app, ejecuta una receta y guarda la captura en img/ al doble de resolución
    recetas/           una receta por captura (JS): inicio, bN-…; _base.txt explica las ayudas comunes
    evaluar.ps1        abre una página sin ventana, ejecuta un guion y escribe el resultado (recortes, valores)
    huecos.js          guion para evaluar.ps1: el hueco al pie de cada hoja de una parte del manual
    unir-manual.ps1    une la portada y las partes en es/manual-completo.html para imprimir el manual completo
  es/
    00a-portada.html   portada blanca: título en español e inglés; al centro, el cladograma de ocho compuestas
                       (Bidens, Cosmos y seis dalias) con cada cambio sobre su rama, el apoyo de Bremer de cada
                       grupo y la matriz de la que sale; a los lados, dalia roja, mirasol, aceitilla, palo mulato,
                       ciruela mexicana y dalia arbórea con su nombre científico; abajo, cuatro viñetas: los
                       conjuntos de Fitch, el intercambio TBR, el apoyo de Bremer y el consenso estricto (todo
                       dibujado con gráficos vectoriales originales)
```

Las capturas se toman con la app abierta desde `file://`, en español, tema claro, 1400 × 900, al doble de
resolución, con la matriz de práctica **«Dahlia, 20 taxones × 45 caracteres»** y los valores por omisión de cada
bloque, salvo donde el texto diga otra cosa (la búsqueda exacta se enseña con «Bursera, 8 × 12» y la escala de las
búsquedas grandes con la «Matriz grande, 120 × 300»). Todos los números del manual salen de esas corridas.

## Plan de partes

| Parte | Archivo | Contenido |
|---|---|---|
| 1 | `00a-portada.html` | portada |
| 2 | `00b-introduccion.html` | créditos, índice general, cómo leer el manual e introducción I.1–I.9 |
| 3 | `01-bloque1.html` | Bloque 1 · Inicio: lo que se ve al abrir, los siete pasos, los dos laboratorios, los diez bloques y los seis tipos de carácter, los métodos, la teoría, el tamaño de la matriz, lo que no hace, referencias y cita |
| 4 | `02-bloque2.html` | Bloque 2 · Matriz: abrir o crear, el resumen, el editor y su inspector, las imágenes de los taxones, el control de calidad, la lista de caracteres y exportar |
| 5 | `03-bloque3.html` | Bloque 3 · Búsqueda: qué se analiza, métodos y parámetros, restricciones, resultados, convergencia, árboles más cortos y consenso estricto |
| 6 | `04-bloque4.html` | Bloque 4 · Pesos: implícitos, implícitos extendidos, sucesivos y sensibilidad a k |
| 7 | `05-bloque5.html` | Bloque 5 · Cladograma: qué árbol, marcas de cambio y optimización, pintar un carácter, editar con el ratón |
| 8 | `06-bloque6.html` | Bloque 6 · Diagnóstico: resumen, cada carácter, diagnosis de cada clado, matriz ordenada, lo que cambia entre árboles |
| 9 | `07-bloque7.html` | Bloque 7 · Apoyo: Bremer y Bremer relativo, bootstrap, jackknife, remuestreo simétrico y GC |
| 10 | `08-bloque8.html` | Bloque 8 · Consensos: estricto, mayoría, mayoría extendida, semiestricto, Adams y taxones comodín |
| 11 | `09-bloque9.html` | Bloque 9 · Hipótesis: grupos o árbol, costo, pruebas de Templeton, sitios ganadores y Kishino–Hasegawa |
| 12 | `10-bloque10.html` | Bloque 10 · Figuras e informe: el cladograma para publicar, las figuras, los formatos, los métodos y el paquete |
| 13 | `11-apendices.html` | apéndices A–F: archivos, reglas de decisión reunidas, glosario, cuando algo no sale, referencias, licencia y cita |

**Estado (4 oct 2026):** las trece partes están escritas y revisadas hoja por hoja; las capturas salen de la versión
1.0.0 con los arreglos encontrados al escribirlas (ver `CHANGELOG.md`). El manual completo se unió e imprimió a PDF
una sola vez, al final. La versión en inglés queda pendiente.

## Colores por bloque

Los de la paleta de la app, en el orden de la franja de la portada.

| Bloque | Color | Variable |
|---|---|---|
| Preliminares e introducción | terracota profundo `#7a2c1b` | `--b0` |
| 1 Inicio | terracota `#9a3b26` | `--b1` |
| 2 Matriz | verde azulado `#1f7a72` | `--b2` |
| 3 Búsqueda | azul `#2d74b0` | `--b3` |
| 4 Pesos | naranja `#c96f22` | `--b4` |
| 5 Cladograma | oliva `#5c7a2a` | `--b5` |
| 6 Diagnóstico | violeta `#6f55a0` | `--b6` |
| 7 Apoyo | rosa `#b8456e` | `--b7` |
| 8 Consensos | pizarra `#5f6b86` | `--b8` |
| 9 Hipótesis | ocre `#8a6a3a` | `--b9` |
| 10 Informe | oro viejo `#94721a` | `--b10` |
| Apéndices | negro `#111111` | `--bx` |

## Cómo se trabaja

1. Cada parte se abre con doble clic y se ve ya paginada (paginar.js). Se revisa el hueco al pie de cada hoja con
   `evaluar.ps1 -ScriptFile manual\herramientas\huecos.js -Page manual/es/NN-….html` desde la carpeta de la app.
2. Las capturas se toman desde la carpeta de la app con
   `powershell -ExecutionPolicy Bypass -File manual\herramientas\captura.ps1 -Receta <nombre> [-Alto 1400]`;
   cada receta deja en `window.__recorte` el recorte que la figura necesita. La herramienta local
   `tools/local/shot.ps1` abre el navegador sin ventana con un perfil limpio.
3. Al terminar todas las partes: `powershell -ExecutionPolicy Bypass -File herramientas\unir-manual.ps1 es` desde
   `manual/`, y se imprime `es/manual-completo.html` a PDF con `tools\local\shot.ps1 -Pdf`
   (`CladisticsPro User's Manual.pdf`).
