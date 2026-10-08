# Procedencia de CladisticsPro

Este documento dice, elemento por elemento, qué partes de CladisticsPro son obra
propia y de dónde salen las ideas que no lo son. Se escribió para acompañar el
registro de la obra ante el INDAUTOR y para que cualquiera pueda comprobar lo
que aquí se afirma.

Última revisión: 8 de octubre de 2026 (versión 1.0.1; la 1.0.0, del 3 de octubre, fue la revisión final para el registro).

---

## 1. En una frase

CladisticsPro no contiene código, íconos, tipografías ni datos de nadie más.
Implementa métodos de la cladística publicados en revistas científicas, todos
citados a su publicación original en el propio código y en la portada de la
app; la escritura de cada uno en JavaScript es propia.

---

## 2. Lo que el programa no tiene

- **Ninguna biblioteca de terceros.** El motor de parsimonia (`js/engine.js`),
  la optimización de caracteres (`js/optimize.js`, `js/mapping.js`), los
  árboles (`js/tree.js`), los formatos de archivo (`js/matio.js`), las figuras
  (`js/cladogram.js`, `js/art.js`), las pruebas estadísticas (`js/hypo.js`) y
  el informe con su archivo `.zip` (`js/report.js`) están escritos para este
  programa. El `.zip` se arma byte a byte según la especificación pública del
  formato, con un CRC-32 propio; la compresión la hace el propio navegador.
- **Nada que se cargue de la red.** Todos los archivos que usa la página están
  en su carpeta; el ícono de la pestaña es un dibujo incrustado. Por eso abre
  con doble clic, sin servidor y sin conexión. El único enlace hacia fuera es
  el del portal de la suite del autor, que sólo se sigue si la persona hace
  clic en él.
- **Ninguna tipografía incluida.** La interfaz y las figuras usan las letras
  instaladas en el equipo. El editor de figuras ofrece familias genéricas y,
  por su nombre, sólo las dos que las revistas piden así (Arial/Helvetica y
  Times New Roman); son referencias a las letras del sistema, no archivos que
  el programa traiga.
- **Ningún adaptador para programas o bibliotecas de otros.** En otras apps de
  la suite, el estudio de figuras sabe abrir gráficas hechas con bibliotecas
  ajenas; la copia de CladisticsPro no lleva esa parte, porque todas sus
  figuras las dibuja el propio programa.
- **Ningún código minificado, empaquetado ni pegado.** Ni carpeta `vendor/`, ni
  `node_modules/`, ni paso de compilación.
- **Ningún dato de terceros.** Las tres matrices de ejemplo (`js/examples.js`)
  son **simuladas**: los nombres de las especies son reales, pero los estados
  se generaron con un proceso de Markov a lo largo de árboles escritos para
  ello (`data/generar_ejemplos.R`); no se observaron en ejemplares ni proceden
  de ninguna publicación.
- **Ninguna imagen incluida.** Las fotos o dibujos de los estados y de los
  taxones los agrega quien usa el programa, con su crédito y su licencia; se
  guardan en su navegador y el programa no trae ninguno.

## 3. Los íconos

Los íconos de línea del navegador de bloques y del estudio de figuras
(`js/labg-navigator.js`, `js/labg-figure-studio.js`) se dibujaron para la suite
LABG sobre una cuadrícula de 24 × 24 con trazo de 1.5, como trazos SVG escritos
en el propio código. Sustituyen, desde el 3 de octubre de 2026, a un conjunto
de íconos de terceros de licencia permisiva que esos módulos usaban antes; con
el cambio, el archivo de licencias de terceros dejó de ser necesario y se
retiró.

## 4. Los métodos publicados

Un método no es objeto de derecho de autor (LFDA, art. 14, fr. I); lo que se
registra es su expresión, el código. Los que el programa implementa, con su
fuente:

| Qué | Dónde | Publicación |
|---|---|---|
| Caracteres no aditivos y aditivos | `optimize.js`, `engine.js` | Fitch 1971; Farris 1970 |
| Matrices de costos entre estados | `optimize.js`, `engine.js` | Sankoff 1975 |
| Caracteres inaplicables | `engine.js`, `mapping.js` | Brazeau, Guillerme y Smith 2019 |
| Caracteres continuos analizados como tales | `engine.js`, `mapping.js` | Farris 1970; Goloboff, Mattoni y Quinteros 2006 |
| Rama y cota | `engine.js` | Hendy y Penny 1982 |
| Adición de Wagner y TBR | `engine.js` | Farris 1970; Swofford y Olsen 1990 |
| Ratchet | `engine.js` | Nixon 1999 |
| Búsqueda sectorial, deriva y fusión de árboles | `engine.js` | Goloboff 1999 |
| Pesos implícitos y extendidos; pesos sucesivos | `engine.js` | Goloboff 1993, 2014; Farris 1969 |
| ACCTRAN y DELTRAN | `optimize.js`, `mapping.js` | Swofford y Maddison 1987 |
| Índices de consistencia y retención | `optimize.js`, `mapping.js` | Kluge y Farris 1969; Farris 1989 |
| Colapso de ramas sin soporte | `optimize.js` | Coddington y Scharff 1994 |
| Apoyo de Bremer y Bremer relativo | `support.js`, `engine.js` | Bremer 1988, 1994; Goloboff y Farris 2001 |
| Bootstrap, jackknife, remuestreo simétrico y GC | `engine.js`, `support.js` | Felsenstein 1985; Farris et al. 1996; Goloboff et al. 2003 |
| Consensos estricto, de mayoría, semiestricto y de Adams | `tree.js` | Sokal y Rohlf 1981; Margush y McMorris 1981; Bremer 1990; Adams 1972 |
| Consenso reducido y comodines | `block8.js`, `tree.js` | Wilkinson 1994; Pol y Escapa 2009 |
| Pruebas de Templeton, sitios ganadores y Kishino–Hasegawa | `hypo.js` | Templeton 1983; Prager y Wilson 1988; Kishino y Hasegawa 1989 |
| Paleta segura para el daltonismo | `cladogram.js`, `style.css` | Okabe e Ito 2008 |

Las distribuciones de probabilidad de `hypo.js` (normal, t de Student,
binomial, rangos con signo) se escriben desde sus definiciones con métodos
numéricos clásicos de dominio público (la aproximación de Lanczos para la
función gamma y las fracciones continuas de las funciones gamma y beta
incompletas). Las cotas de longitud mínima y máxima de los caracteres con
inaplicables (`mapping.js`) se escribieron desde su definición.

La referencia completa de cada publicación está en la portada de la app
(Bloque 1, «Referencias») y en el informe del Bloque 10, que cita sólo lo que
se usó.

## 5. Cómo se comprobó

Cada motor se verificó contra implementaciones independientes de los mismos
métodos (paquetes de un entorno estadístico libre) y contra enumeraciones
exhaustivas de todos los árboles posibles, con matrices simuladas y con
matrices publicadas. Los guiones y sus resultados están en `validation/` (en el
equipo del autor; no se publican en el repositorio), y las pruebas automáticas
del programa (370, todas pasan) en `tests/`. Ninguna de
esas dos carpetas forma parte de la obra: sirven para comprobarla.

## 6. Qué forma parte de la obra registrada

**Sí:** `index.html`, las hojas de estilo de `css/`, el código de `js/`,
`server.ps1` y `Open CladisticsPro.bat`.

**No:** `research/` (notas y capturas de trabajo), `validation/`, `tests/`,
`data/` (los guiones que simulan los ejemplos y los archivos que generan; los
ejemplos ya van incrustados en `js/examples.js`), `LICENSE`, `CHANGELOG.md`,
`README.md` y este documento.

## 7. Autoría, titularidad y licencia

Autor y titular único: **Luis Ángel Barrera-Guzmán**. El programa se escribió
fuera del ejercicio de funciones institucionales y no lleva mención de ninguna
institución. Se distribuye como software libre bajo la Licencia Pública
General de GNU, versión 3 o posterior (`LICENSE`), que es una licencia de uso
otorgada por el titular: no impide el registro ni cede los derechos
patrimoniales. El nombre «CladisticsPro» no se protege con el registro de la
obra; un nombre se protege como marca ante el IMPI.
