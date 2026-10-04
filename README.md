# CladisticsPro

**Caracteres, homología y árboles: cladística morfológica en el navegador, de la matriz al cladograma.**
Versión 1.0.0 · Luis Ángel Barrera-Guzmán · software libre (GPL-3.0 o posterior).

**Versión en línea:** https://luisangelbg.github.io/CladisticsPro/ · **Manual de usuario (PDF, español):**
[`manual/CladisticsPro User's Manual.pdf`](manual/CladisticsPro%20User's%20Manual.pdf)

CladisticsPro reúne en una sola página el trabajo completo de un análisis
cladístico con caracteres morfológicos: escribir la matriz con el enunciado de
cada carácter y el nombre de cada estado, buscar los árboles más cortos,
pesar los caracteres, dibujar los cambios sobre las ramas, diagnosticar cada
carácter, medir el apoyo de los grupos, resumir con consensos, poner a prueba
hipótesis y publicar la figura con sus métodos redactados. Todo se calcula en
el propio equipo: los datos no salen de él.

## Cómo abrirlo

- **En línea**, en la dirección de arriba, o con una copia local: **doble clic en
  `index.html`**. Funciona sin servidor y sin conexión, con los ejemplos incluidos.
- O bien `Open CladisticsPro.bat` (o `server.ps1`), que sirve la carpeta en
  `http://localhost:9850`; sólo hace falta para abrir la app desde otro equipo
  de la misma red.

## Los diez bloques

1. **Inicio** — la lógica de la cladística en lenguaje llano, dos laboratorios
   que calculan de verdad y la lista de referencias.
2. **Matriz** — taxones × caracteres con enunciados y estados; polimorfismos,
   «?», inaplicables con sus dependencias, caracteres ordenados, matrices de
   costos, continuos, imágenes por estado y una imagen de cada taxón, que se
   dibuja junto a su nombre en los cladogramas. Lee y escribe NEXUS, xread, CSV y
   TSV, y guarda el proyecto completo.
3. **Búsqueda** — rama y cota exacta, adición de Wagner + TBR, ratchet,
   búsqueda sectorial, deriva y fusión de árboles, con restricciones y en
   varios hilos.
4. **Pesos** — pesos implícitos con su constante k, implícitos extendidos,
   pesos sucesivos y sensibilidad a k.
5. **Cladograma** — cada cambio sobre su rama (único u homoplásico), ACCTRAN,
   DELTRAN o sólo no ambiguos, el árbol pintado por un carácter y la edición
   con el ratón con la longitud al instante.
6. **Diagnóstico** — pasos, IC, IR e ICR por carácter, sinapomorfías de cada
   clado y la matriz ordenada por el árbol.
7. **Apoyo** — Bremer absoluto y relativo, bootstrap, jackknife, remuestreo
   simétrico y GC.
8. **Consensos** — estricto, mayoría, mayoría extendida, semiestricto y Adams;
   consenso reducido y taxones comodín.
9. **Hipótesis** — el costo de un grupo propuesto con la búsqueda repetida bajo
   restricción, o el de un árbol completo, con las pruebas de Templeton, de
   sitios ganadores y de Kishino–Hasegawa, carácter por carácter.
10. **Figuras e informe** — el cladograma para publicar, todas las figuras en
    SVG, los árboles en NEXUS, xread y Newick, los métodos redactados en
    español o inglés con sus referencias y un paquete `.zip` reproducible.

## Carpetas

| Carpeta | Qué hay |
|---|---|
| `index.html`, `css/`, `js/` | el programa |
| `tests/` | las pruebas automáticas: abrir `tests/index.html` (370 pruebas) |
| `data/` | cómo se simularon las matrices de ejemplo (ya incrustadas en `js/examples.js`) |
| `manual/` | el manual de usuario en español: las partes en HTML, sus capturas y el PDF |

`PROCEDENCIA.md` explica qué es obra propia y de dónde salen los métodos;
`CHANGELOG.md`, qué cambió en cada etapa. La comprobación de cada motor contra
implementaciones independientes en R (guiones e informes) y las notas de trabajo
se conservan aparte y no forman parte de este repositorio.

## Cómo citarlo

Barrera-Guzmán, L. Á. (2026). *CladisticsPro: cladística morfológica en el
navegador* (versión 1.0.0) [Programa de cómputo].

## Licencia

Este programa es software libre: puede redistribuirse y modificarse bajo los
términos de la Licencia Pública General de GNU, versión 3 o (a elección de
quien lo use) cualquier versión posterior. Se distribuye con la esperanza de
que sea útil, pero SIN NINGUNA GARANTÍA. Ver `LICENSE`.
