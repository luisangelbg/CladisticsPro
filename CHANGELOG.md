# Cambios de CladisticsPro

## Sin versión nueva · La etiqueta en el nombre en los laboratorios de Inicio — 9 de octubre de 2026

- **Nombres que contienen lo que se ve** (WCAG 2.5.3, la etiqueta en el nombre; 9 oct): en el laboratorio «Cuenta los
  pasos», el nombre de cada celda de la matriz no traía el estado que muestra («Grupo externo · 1 Hoja: simple» sobre
  un «0») y el de cada árbol, «Árbol de 7 pasos», no traía sus puntas. Ahora la celda se llama «Grupo externo · 1
  Hoja: 0 (simple)» y el árbol, «Árbol (GE,((A,B),(C,D))): 7 pasos», con lo que además se distinguen los árboles de
  igual longitud. En «ACCTRAN contra DELTRAN» cada punta se llama «GE: 0» o «A: ? (desconocido)». Sólo cambia
  `js/labs.js`; se ve y calcula igual. Pruebas: 373, todas pasan.

## Versión 1.0.1 · Tablas a prueba de hoja de cálculo — 8 de octubre de 2026

- **Tablas a prueba de hoja de cálculo** (8 oct): Excel leía el polimorfismo `(01)` de un CSV como el número −1 (formato
  contable) y, al guardar, la matriz quedaba con `-1`, `-12`…; un intervalo `1-3` podía volverse fecha. La exportación
  CSV/TSV y la copia de celdas con Ctrl+C escriben ahora `[01]` y `1–3` (nueva función `Mx.sheetText`); la app lee
  ambas notaciones y la de antes. NEXUS y xread no cambian. Manual: secciones 2.8 y D. Pruebas: 373, todas pasan (3 nuevas).
  Archivada en Zenodo: DOI de la versión 10.5281/zenodo.23231485.

## Versión 1.0.0 · Bloques 9 y 10, y adecuaciones para el registro — 3 de octubre de 2026

- **Bloque 9 · Hipótesis**: una hipótesis es uno o varios **grupos** que deben (o no deben) ser monofiléticos —se
  repite la búsqueda del Bloque 3 con ellos como restricciones— o un **árbol completo** (el del Bloque 5, uno del
  archivo o uno pegado). Se compara con el árbol más corto carácter por carácter: pasos de más, caracteres a favor y en
  contra, y las pruebas de **Templeton** (rangos con signo de Wilcoxon, exacta o normal con corrección por empates y
  continuidad), **sitios ganadores** (binomial exacta) y **Kishino–Hasegawa** para parsimonia (t de la diferencia
  media), con la advertencia de Goldman, Anderson y Rodrigo (2000). El árbol de la hipótesis con sus grupos en color,
  la tabla de los caracteres que cambian, el historial de hipótesis y la exportación en CSV y Newick. Si la hipótesis
  da un árbol más corto que el del Bloque 3, lo avisa.
- **Bloque 10 · Figuras e informe**: el **cladograma para publicar** sobre cualquier árbol de la sesión, con las
  marcas de cambio (ACCTRAN, DELTRAN o no ambiguos), los valores de apoyo del Bloque 7, título, letra y cursivas;
  **todas las figuras** de los bloques en SVG con los colores del tema claro (o abiertas en el estudio); los árboles y
  la matriz en **NEXUS** (los árboles con tabla TRANSLATE), **xread** (ahora con los árboles en `tread`) y **Newick**;
  los **métodos redactados** en español o inglés sólo con lo que se corrió, con sus referencias completas, en texto o
  página para imprimir; y el **paquete reproducible** `.zip` (matriz, árboles, figuras, tablas, métodos e índice),
  escrito por la propia app con un CRC-32 propio.
- **Motor y formatos**: `js/hypo.js` (distribuciones y pruebas), `js/report.js` (métodos, bibliografía, SVG autónomo y
  ZIP); `matio.js` escribe y lee `tread` en xread y escribe los árboles NEXUS con TRANSLATE; `cladogram.js` deja sitio
  en la rama al valor de apoyo cuando hay marcas. Bibliografía: Goldman, Anderson y Rodrigo 2000.
- **Interfaz**: los botones flotantes del navegador (Último cambio, Volver arriba) suben por encima del pie del
  bloque en vez de tapar «Siguiente» (navegador 1.1.1).
- **Adecuaciones para el registro ante el INDAUTOR** (la app queda, por ahora, sólo en este equipo):
  - los **íconos** de los módulos compartidos se dibujaron de nuevo para la suite y sustituyen a los de un conjunto de
    terceros; el aviso de licencias de terceros se retiró (queda en `research/historial/`);
  - las **cotas de los índices** con inaplicables (`mapping.js`) se reescribieron desde su definición: el mínimo con la
    cobertura exacta de `optimize.js` y el máximo con un procedimiento propio de uniones disjuntas; los índices siguen
    iguales a la implementación independiente en 8350/8350 caracteres;
  - fuera las **tipografías** que se descargaban del portal (letras del sistema), el enlace «Reportar un problema» (no
    hay repositorio público), la dirección web en «Cómo citar» y las marcas de dispositivos en `server.ps1`, que ahora
    lleva su línea de autoría igual que el `.bat`;
  - `PROCEDENCIA.md` y `README.md` nuevos;
  - revisión final: la copia del estudio de figuras ya no lleva los adaptadores para bibliotecas de gráficas ajenas ni
    las notas sobre otro lenguaje (CladisticsPro dibuja todas sus figuras); el editor de figuras ofrece familias
    genéricas más Arial/Helvetica y Times New Roman, las que piden las revistas; el lector NEXUS ya no nombra un
    programa en su lista de bloques que omite en silencio (ahora avisa que lo omitió); la interfaz deja de anunciar la
    extensión de archivo de otro programa; ninguna petición fuera del equipo al usar la app (37 recursos, todos locales).
- **Navegador 1.1.1** también en las demás apps de la suite (fuera de esta carpeta).
- **Imágenes de los taxones** (pedido del autor, 3 oct): cada taxón u OTU puede llevar una foto o un dibujo del usuario
  (`js/taxonimg.js`). Se agrega desde el inspector del taxón o desde la galería nueva del Bloque 2, una por una o
  varias a la vez (cada archivo se empareja con el taxón de su nombre, que se puede corregir); se encuadra arrastrando
  y acercando, lleva crédito y licencia, y sólo se dibuja si el usuario confirma que muestra a ese taxón. En los
  cladogramas del Bloque 5 (casilla «Imágenes de los taxones») y del Bloque 10 (antes del nombre o en columna después
  de él, con tamaño, forma y marco) va dentro del SVG, así que se exporta con la figura; el Bloque 10 da los créditos
  agrupados para el pie de figura y el ZIP los lleva en `figuras/creditos_imagenes.txt`. Las imágenes se guardan en el
  navegador y viajan en el archivo de proyecto; cambiarlas no borra los resultados de los análisis y se puede deshacer.
  Pruebas: 361, todas pasan (6 nuevas); auditoría de los Bloques 2, 5 y 10 con imágenes, sin fallas a 1280 y 360 px.
- **Publicación** (4 oct): repositorio público https://github.com/luisangelbg/CladisticsPro, versión en línea
  https://luisangelbg.github.io/CladisticsPro/ y archivo en Zenodo. **DOI de concepto 10.5281/zenodo.23147012**
  (la 1.0.0: 10.5281/zenodo.23147013): va en la cita de la portada (con BibTeX), en la referencia del programa de los
  métodos redactados del Bloque 10, en `CITATION.cff`, `codemeta.json`, el README y el manual. La dirección de la cita
  se parte en pantallas angostas.
- **Lema** (4 oct): junto al nombre, «CladisticsPro · caracteres, homología y árboles» (en inglés «characters,
  homology and trees») en la barra superior y en el título de la pestaña; también en la portada y los créditos del
  manual. El título de la obra y de la cita no cambia.
- **Arreglos encontrados al escribir el manual** (4 oct): con la búsqueda exacta, el recuadro del Bloque 3 decía
  «Réplicas que llegaron 0 / 1 · pocas réplicas llegaron: conviene buscar más», porque `pool.js` contaba la búsqueda
  exacta como una réplica; ahora dice «Exacta ✓ · rama y cota: no hay árboles más cortos» (o «incompleta» si se agotó
  el tiempo). «1 hilos» y «1 distintos» pasan a singular (Bloques 3, 4 y 8); en la portada, el texto de los diez
  bloques dice que el capítulo N del manual explica el Bloque N. **Regla 1 (ramas de longitud cero)**: las dos ramas
  que salen de la raíz se juzgaban por separado, y la del grupo interno podía colapsarse aunque la rama del árbol sin
  raíz que forman juntas lleva cambios (en Dahlia, el género no salía como grupo en el consenso estricto). Ahora se
  juzgan juntas: se colapsan las dos sólo si ambos hijos pueden tener el mismo estado en todos los caracteres, y
  ninguna si uno de ellos es terminal. Comprobado contra la definición (contraer la rama no alarga el árbol) en todas
  las ramas internas de un árbol de Dahlia. **Matrices grandes**: al juntar los árboles de varios hilos se guardaban
  hasta hilos × el máximo (1000 árboles con 10 hilos y tope 100); ahora nunca más que el tope. Calcular el CI y el RI
  de cada árbol de la lista ya no reconstruye los cambios (sólo la pasada que da los pasos) y la regla 1 sólo hace las
  dos pasadas que necesita: por árbol de 120 × 300, de 431 a 52 ms. Ese trabajo se hace por tandas y la ventana de
  espera dice cuántos árboles lleva («Colapsando ramas y calculando índices… (k de N árboles)») en vez de quedarse en
  «quedan ~2 s»; el ratchet informa su avance ciclo por ciclo, así que la ventana ya no se queda en «Preparando…»
  mientras corre la primera réplica. La búsqueda por omisión de la matriz grande pasó de unos 8 minutos a 1.
  **Sensibilidad a k**: cuando varios k dan el mismo resultado, la nota y los métodos los nombran a todos en vez de
  sólo el primero. **Interfaz**: en el Bloque 4 cada parámetro va en su propia casilla (antes r y M, o los tres de
  los pesos sucesivos, iban apilados) y la curva de pesos ya no crece sin fin en una tarjeta ancha; en el Bloque 5,
  los selectores de «Qué árbol» muestran su texto completo, la leyenda de las marcas desaparece con «Caracteres:
  ninguno», y al pintar un continuo los intervalos de los nodos ya no se enciman ni se cortan (cada rama reserva
  sitio para su texto, sólo se escribe donde el intervalo cambia y con tres cifras significativas) y la nota explica
  el degradado. **Control de calidad**: un carácter no informativo *sube* el CI de la matriz (una autapomorfía tiene
  CI 1); el aviso decía que lo bajaba. **Bloque 8**: empieza con los árboles colapsados por la regla 1, como el
  consenso estricto del Bloque 3 (antes tomaba los binarios y su estricto no coincidía); y la **búsqueda de comodines**
  ya funciona con árboles colapsados: antes podaba los árboles ya colapsados, cuyas ramas en cero —puestas en cero por
  el «?» del propio comodín— seguían colapsadas, y un taxón casi sin datos que deshacía el consenso (de 14 a 5 clados
  en Dahlia) salía «sin comodines». Ahora se busca en los árboles binarios y el consenso reducido se arma colapsando
  de nuevo los árboles podados. En el Bloque 6, «la longitud va de 97.036 a 97.036» pasa a «los 6 árboles tienen la
  misma longitud…»; en «Por qué se mueve» ya no se anuncia una lista de caracteres cuando ninguno cambia; en el Bloque 9
  el método de la búsqueda se nombra en el idioma de la app («ratchet», «combinada») y no con su clave interna.
  **Métodos redactados**: con un consenso en la sesión, la bibliografía traía las referencias de los cinco tipos de
  consenso aunque el texto citara uno; ahora sólo las citadas. **Bloque 10**: el archivo Newick (`.tre`) escribe
  cada árbol precedido por su nombre entre corchetes, como el paquete; el lector de Newick de la app (Bloques 5 y 9)
  no aceptaba un comentario antes del árbol y ahora lo salta. Pruebas: 370, todas pasan (9 nuevas, 1 corregida).
- **Pruebas**: 355, todas pasan (34 nuevas).
- **Validación** (`validation/block9/`, `validation/block10/`): costo de un grupo con la búsqueda exacta igual a la
  enumeración de todos los árboles en 20/20 matrices (más corto, con el grupo y sin él); Wilcoxon (estadístico y p),
  binomial y t iguales a las funciones de referencia en 60/60 vectores; los árboles exportados leídos por tres lectores
  independientes (NEXUS, Newick y `tread`) con los mismos grupos en 11/11, las matrices celda por celda 3/3 en NEXUS y
  en xread, y los dos ZIP (guardado y comprimido) abiertos por un descompresor independiente con el tamaño y el MD5 de
  cada uno de sus 17 archivos.
- **Errores encontrados y corregidos**: el lector independiente juntaba las palabras de los nombres entre comillas con
  espacio en un NEXUS sin TRANSLATE (ahora los árboles van por número); en `tread`, un número tras «)» lo tomaba por
  rótulo (ahora cada grupo lista primero sus taxones); en los métodos, el umbral de mayoría salía como «5000 %», el
  ajuste de pesos implícitos repetía la longitud, la búsqueda exacta decía «0 de 1 réplicas» y los valores de apoyo se
  encimaban con las marcas de cambio.

## Bloques 7 y 8 · Apoyo de ramas, consensos y comodines — 3 de octubre de 2026

- **Bloque 7 · Apoyo**: **Bremer** (Bremer 1988) por una búsqueda sin cada grupo — exacta hasta 12 taxones, heurística
  arriba, varias a la vez en los hilos — o por los árboles subóptimos guardados hasta k pasos más; **Bremer relativo**
  (Goloboff y Farris 2001); **bootstrap** (Felsenstein 1985), **jackknife** (Farris et al. 1996) y **remuestreo
  simétrico** (Goloboff et al. 2003) con frecuencia absoluta y **GC**, repartidos en los hilos y reproducibles con la
  semilla. El apoyo se lee sobre el consenso estricto, el primer árbol más corto o el árbol del Bloque 5: ramas de
  color según una escala de lectura de cuatro clases, el valor en cada rama, la tabla de los grupos y la exportación
  en Newick (con los valores) y CSV.
- **Bloque 8 · Consensos y comodines**: **estricto** (de Nelsen en la tradición de los programas de parsimonia),
  **mayoría** con umbral, **mayoría extendida**, **semiestricto** (Bremer 1990) y **Adams** (Adams 1972), con la
  frecuencia de cada clado y los cinco lado a lado; **taxones comodín**: el que, al podarlo, devuelve más clados al
  consenso estricto, uno por uno (consenso reducido), con su porcentaje de «?», los lugares donde se coloca en los
  árboles y los caracteres que lo llevan a cada uno.
- **Motor**: claves de grupo, pesos de remuestreo, remuestreo completo (`E.resample`) y árboles subóptimos
  (`E.suboptimal`); `js/support.js` con las cuentas del apoyo; `tree.js` con los consensos nuevos y la poda.
- **Pruebas**: 321, todas pasan (23 nuevas).
- **Validación** (`validation/block7/`, `validation/block8/`): Bremer exacto igual a la enumeración de todos los
  árboles en 50/50 grupos (por búsqueda sin el grupo y por subóptimos); Bremer relativo 44/44; remuestreo con los pesos
  sorteados en R y cada réplica exacta: conteos idénticos en 12/12 corridas; consensos estricto, mayoría (60 y 80 %),
  semiestricto, mayoría extendida y Adams 24/24 cada uno, y estricto sin cada taxón 199/199.
- **Errores encontrados y corregidos**: la rama y cota podaba árboles parciales con una restricción **negativa**, pero
  un taxón añadido después puede romper el grupo (el Bremer de un grupo salía infinito; el exacto era 1): ahora sólo
  las positivas podan y la negativa se revisa en el árbol completo, mientras la adición de Wagner la sigue usando de
  guía y la subida repara un árbol inicial que la rompa; el árbol armado desde sus clados volvía a poner en la raíz a
  los taxones podados (el comodín reaparecía en el consenso reducido); con la raíz del consenso en politomía, el valor
  de cada grupo se copiaba a sus hermanos; y `TreeTools::ConsensusWithout` dio un consenso menos resuelto en un caso,
  por lo que la referencia usa ape.

## Bloques 5 y 6 · Cladograma y mapeo, diagnóstico de caracteres — 3 de octubre de 2026

- **Mapeo de caracteres** (`js/mapping.js`): cada carácter sobre un árbol con la misma longitud que la búsqueda.
  Discretos con la optimización de costos del Bloque 1 (conjuntos MPR, ACCTRAN, DELTRAN); **con «–», el algoritmo de
  Brazeau et al. (2019) leído por regiones**: sus cuatro pases dicen qué nodos son aplicables y dentro de cada región
  aplicable los cambios se colocan como en cualquier carácter (en árboles con politomías, que el algoritmo no admite,
  «–» se lee como «?» y se avisa); **continuos** por parsimonia lineal exacta, con el intervalo de valores más
  parsimoniosos de cada nodo. Cotas para CI y RI; con «–», la longitud máxima cuenta las regiones posibles, como la
  implementación de referencia.
- **Bloque 5**: árboles de la búsqueda (uno por uno, colapsados o el consenso estricto), de los pesos, del archivo de
  la matriz o pegados en Newick; **marcas de cambio sobre las ramas** (llena = cambio único, vacía = homoplásico,
  tenue = ambiguo; número de carácter arriba y estado o nombre del estado abajo) con ACCTRAN, DELTRAN o sólo los
  cambios no ambiguos, y filtro (todos, informativos, únicos); cada rama tan larga como sus marcas; **pintar el árbol
  por un carácter** (estados posibles en los nodos, ramas punteadas donde no aplica, continuos en escala de color con
  sus intervalos); clic en una rama → los cambios que definen ese clado; **edición con el ratón** (mover un clado,
  colapsar, resolver una politomía, enraizar, girar, escalonar, deshacer, volver al original) con longitud, CI, RI y
  la diferencia con el original al instante. Exporta el árbol en Newick y la lista de cambios en CSV.
- **Bloque 6**: por carácter, mínimo, pasos, máximo, CI, RI, RC, sus pasos en todos los árboles de la fuente, si sus
  cambios caen en las mismas ramas en todos y su peso bajo pesos implícitos con el k elegido; **diagnosis de cada
  clado** (sinapomorfías únicas, cambios homoplásicos, continuos, regiones aplicables nuevas) y autapomorfías de los
  terminales, con los nombres de los estados y el árbol con los clados numerados, en texto para descargar; **la
  matriz ordenada por el árbol** con cada estado en su color y las sinapomorfías resaltadas, por clado; y lo que
  cambia entre los árboles igual de cortos.
- **Coherencia entre bloques**: el CI y el RI de la búsqueda (Bloque 3) se calculan ahora con la misma lectura de «–»
  y de los continuos que el cladograma.
- **Pruebas**: 298, todas pasan (38 nuevas: edición de árboles, longitudes del mapeo contra la búsqueda, regiones,
  politomías, cotas con «–», ACCTRAN y DELTRAN óptimos, continuos dentro de sus intervalos, matriz asimétrica y raíz,
  dibujo, y los Bloques 5 y 6).
- **Validación** (`validation/block5/`): estados de cada nodo con «–» iguales a TreeSearch en 158 086/158 086 nodos de
  30 matrices publicadas; CI y RI de cada carácter iguales en 8350/8350; continuos 20/20 longitudes y 290/290
  intervalos iguales a una programación dinámica independiente en R (5 árboles con politomías).
- **Errores encontrados y corregidos**: con una matriz de pasos asimétrica la longitud depende de la raíz, y el motor
  enraizaba en el primer taxón del grupo externo mientras el cladograma lo hace entre grupo externo e interno (en
  *Dahlia*, 3 contra 2 pasos en el carácter 25): ahora el motor mide como el cladograma, y la búsqueda de *Dahlia* da
  97.036 en lugar de 98.036; un nombre con guion bajo al final no se reconocía a sí mismo al leer un árbol; las
  reconstrucciones continuas podían no ser óptimas cuando el valor del padre cae entre dos valores de las puntas; y
  el CI y el RI del Bloque 3 leían «–» como «?» aunque la búsqueda usara el algoritmo.

## Bloques 3 y 4 · Búsqueda de árboles y pesos — 3 de octubre de 2026

- **Motor de búsqueda** (`js/engine.js`): Fitch con empaquetado vertical (un plano de bits por estado, 32 caracteres
  por palabra) y pesos por rebanadas de bits; ordenados por codificación aditiva; continuos como intervalos
  aditivos (escalados, en sus unidades o fuera); matrices de pasos por el método de Sankoff; el **algoritmo de
  inaplicables** de Brazeau, Guillerme y Smith (2019). **Atajo exacto de TBR** por conjuntos de arista (Goloboff
  1996), también con pesos implícitos y con continuos; con inaplicables y matrices de pasos da una cota inferior
  ajustada gracias a una «sombra» de cada carácter en la parte rápida.
- **Búsquedas**: adición de Wagner al azar, TBR (y SPR), colección de todos los árboles igual de cortos, **ratchet**
  (Nixon 1999), deriva, búsqueda sectorial y fusión de árboles (Goloboff 1999), y **rama y cota** (Hendy y Penny
  1982) que garantiza todos los árboles más cortos. Restricciones de monofilia positivas y negativas. «Automático»
  elige la exacta hasta 12 taxones, el ratchet hasta 60 y la combinada arriba.
- **Hilos** (`js/pool.js`): las réplicas se reparten en los núcleos de la computadora con Web Workers armados desde
  el código del propio motor (funciona con doble clic); si el navegador los niega, corre en la página. Tiempo
  máximo, cancelar y la misma semilla repite el resultado.
- **Resultados del Bloque 3**: longitud, árboles más cortos, CI y RI, réplicas que llegaron al óptimo, curva de
  convergencia, tabla de árboles, **colapso de ramas de longitud cero** (regla 1 de Coddington y Scharff 1994,
  exacta con los pases de Sankoff), consenso estricto y exportación en Newick y NEXUS.
- **Bloque 4**: **pesos implícitos** (Goloboff 1993) con la curva k/(k + h) y cada carácter sobre ella; **pesos
  implícitos extendidos** (Goloboff 2014) con r y M; **pesos sucesivos** (Farris 1969) por RC, CI o RI hasta que los
  pesos se estabilizan; y **sensibilidad a k**, con la tabla de qué clados aparecen con cada k y el k más parecido a
  los demás (Mirande 2009).
- **Velocidad**: la evaluación completa de un árbol reutiliza su memoria y sólo recorre el árbol hacia una punta;
  los tres pases del algoritmo de inaplicables corren **por bits**, 32 caracteres por palabra; y con caracteres
  lentos la subida evalúa primero los reordenamientos de cota más baja (exacta cuando no descarta ninguno). Una
  subida TBR en matrices publicadas con inaplicables bajó de 35 s a 0.2 s (Wortley et al. 2006, 37 taxones) y de
  145 s a 1.6 s (Zhu et al. 2013, 75 taxones), y la búsqueda del ejemplo *Dahlia* de 7.7 s a 0.3 s.
- **Pruebas**: 260, todas pasan (58 nuevas: longitudes contra la optimización exacta, atajo exacto con los tres
  criterios, rama y cota contra la enumeración de los 10 395 árboles, restricciones, inaplicables por bits y
  carácter por carácter, rama y cota con inaplicables, cota de la sombra, distorsiones, pesos sucesivos, regla 1,
  consensos e hilos).
- **Validación** (`validation/block3/`): inaplicables 90/90 árboles y 1869/1869 caracteres iguales a TreeSearch;
  búsqueda exacta igual a `phangorn::bab` en 25/25 matrices (237/237 árboles); pesos implícitos 144/144 iguales a
  TreeSearch y extendidos 144/144 iguales a la fórmula de Goloboff (2014). Búsqueda heurística en 7 matrices, con
  el mismo tiempo que TreeSearch y en un solo hilo: 5 iguales y 2 más cortas (Wills et al. 2012: 273 contra 275;
  Zhu et al. 2013: 638 contra 639); con pesos implícitos, 3 iguales y 1 mejor. TreeSearch midió los 11 mejores
  árboles de la app y confirmó cada longitud.
- **Errores encontrados y corregidos**: el segundo pase de inaplicables no contaba la región nueva bajo un nodo
  aplicable con un hijo inaplicable (contraejemplo mínimo «1 1 – – –» hallado al comparar con TreeSearch); el pase
  ascendente no iniciaba la punta del grupo externo (ahora hay una raíz virtual); las particiones suponían presente
  el taxón 0 en los árboles parciales; la rama y cota con inaplicables daba la longitud correcta pero podía perder
  árboles óptimos, porque la cuenta del algoritmo puede bajar al añadir un taxón (en una matriz de 6 × 8 halló 19 de
  29; ahora los árboles parciales usan la sombra y la comparación con la enumeración da 40/40); los pesos sucesivos
  desalineaban los índices al quitar caracteres de peso 0; la cota inferior con inaplicables era tan floja que casi
  todo se evaluaba completo; y los lectores aceptaban pesos con decimales que el conteo por bits truncaba en
  silencio: ahora se redondean al leer, con un aviso.

## Bloque 2 · Matriz de caracteres — 3 de octubre de 2026

- **Modelo de la matriz** (`js/matrix.js`): taxones (activo, grupo externo, nota), caracteres (enunciado, nombres
  de estado, tipo no ordenado / ordenado / matriz de pasos / continuo, peso, activo, unidad, nota, imágenes, y
  **de qué carácter depende** para los inaplicables) y celdas (estado, polimorfismo «(01)», incertidumbre «{01}»,
  «?», «–», valor o intervalo continuo). Hasta 30 estados (0–9, A–T). Cada cambio es una operación que devuelve su
  inversa: **deshacer y rehacer sin límite**.
- **Control de calidad**: 20 revisiones (nombres vacíos o repetidos, sin grupo externo, invariables, no
  informativos, estados sin nombre o sin usar, polimorfismos no contiguos en ordenados, matrices de pasos que violan
  la desigualdad del triángulo o asimétricas, exceso de faltantes por carácter o taxón, taxones sin datos o
  idénticos, y «–» que contradice la dependencia declarada).
- **Lectores y escritores** (`js/matio.js`): NEXUS (TAXA, CHARACTERS/DATA estándar, continuos, ADN y proteínas,
  intercalado, MATCHCHAR, SYMBOLS, CHARSTATELABELS, CHARLABELS, STATELABELS, TYPESET, WTSET, EXSET, USERTYPE,
  CHARSET, TREES con TRANSLATE, y un bloque propio con grupo externo, dependencias, unidades, notas e intervalos);
  xread (particiones &[num]/&[cont]/&[dna], ccode, cnames, smatrix, outgroup); tablas CSV/TSV/punto y coma y lo
  que se pega de una hoja de cálculo; lista de caracteres en texto y HTML con imágenes; proyecto `.json`.
- **Editor** (`js/grid.js`): cuadrícula virtualizada (sólo dibuja lo visible: la matriz de 120 × 300 carga en
  0.3 s), encabezados fijos, selección con ratón y teclado, edición directa, Ctrl + número para polimorfismos,
  copiar y pegar con hojas de cálculo, aviso al lector de pantalla de la celda activa.
- **Inspector**: enunciado, tipo, peso, estados (renombrar, añadir, subir, bajar y quitar recodificando las
  celdas), matriz de pasos editable, dependencia con «Poner “–” donde no aplica», unidad, notas, imágenes por
  estado (`js/stateimg.js`, con crédito, licencia y confirmación) y operaciones de carácter y taxón.
- **Sesión en el navegador** (`js/store.js`, IndexedDB): se guarda sola y se ofrece recuperarla.
- **Ejemplos simulados** (`data/generar_ejemplos.R` → `data/hacer_examples.js` → `js/examples.js`): *Bursera*
  8 × 12, *Dahlia* 20 × 45 (todos los tipos de carácter, 5 dependencias, intervalos continuos) y una matriz de
  120 × 300; cada uno con su árbol verdadero.
- **Pruebas**: 202, todas pasan. **Validación** (`validation/block2/`): 88 093 comparaciones de lectura cruzada con
  ape y TreeTools, sin desacuerdos.
- **Errores encontrados y corregidos**: al deshacer el borrado de un carácter que dependía de otro, su dependencia
  se desplazaba dos veces (lo atrapó una prueba de 30 caminatas de 25 operaciones al azar); en xread los corchetes
  se quitaban como comentarios, y en ese formato significan polimorfismo o «desactivar», así que se perdían
  `ccode [`, `cnames` y `smatrix`; las entradas de `cnames` terminan cada una en «;» y se partían como comandos;
  los nombres de `USERTYPE` con guion bajo no casaban con `TYPESET`; los enunciados vacíos regresaban como
  «car 1»; la simulación de los ejemplos podía quedarse en un ciclo sin fin al exigir variación imposible; y el
  atributo `hidden` no ocultaba el formulario de «Matriz nueva» ni la tarjeta «Recuperar la última sesión»
  (las reglas `display` de la tarjeta y de la rejilla le ganaban): ahora `[hidden]` manda siempre.

## Bloque 1 · Inicio — 3 de octubre de 2026

Primera etapa de la construcción. Funciona con doble clic en `index.html` (`file://`) y con `server.ps1`
(puerto 9850).

- **Armazón de la LABG Suite**: barra común, fila de los diez bloques (2–10 marcados «pronto»), español e inglés
  con español por omisión, tema claro y oscuro, navegador de bloques 1.1.0, estudio de figuras 1.4.0, editor ✎ 1.0.0
  y esperas animadas, copiados de la fuente común.
- **Identidad propia**: terracota de etiqueta de herbario, verde azulado y oliva; los estados de un carácter con
  la paleta de Okabe e Ito, segura al daltonismo.
- **Motor de árboles** (`js/tree.js`): Newick con comillas, comentarios y longitudes; unión de puntas con la matriz
  sin importar mayúsculas ni guiones bajos; reenraizado, enraizado por grupo externo (con aviso si no es
  monofilético), escalonado, clados y enumeración de los (2n − 5)!! árboles.
- **Optimización de caracteres** (`js/optimize.js`): método de matrices de costos para no ordenados, ordenados y
  matrices de pasos asimétricas; conjuntos MPR por nodo; ACCTRAN y DELTRAN con la raíz elegible; cambios no
  ambiguos; cambios homoplásicos; pasos mínimos (incluido el árbol de Steiner de una matriz de pasos) y máximos;
  CI, RI, RC y HI por carácter y del conjunto.
- **Cladograma** (`js/cladogram.js`): cada cambio sobre su rama, lleno si el estado aparece una vez y vacío si es
  homoplásico, las ramas tan largas como sus marcas, ramas pintadas por un carácter y conjuntos MPR en los nodos.
- **Portada**: héroe con una matriz optimizada de verdad sobre su cladograma, dos laboratorios que calculan
  («Cuenta los pasos» con los 15 árboles de cinco taxones y «ACCTRAN contra DELTRAN»), los diez bloques, seis tipos
  de carácter, 42 métodos con su cita, diez secciones de teoría con figuras, límites medidos, lo que el programa no
  hace, 52 referencias y cómo citar.
- **Pruebas**: `tests/index.html`, 81 pruebas, todas pasan.
- **Validación** (`validation/block1/`): 8549 comparaciones contra phangorn y TreeSearch, sin desacuerdos.
- **Errores encontrados al validar y corregidos**: las marcas del héroe, calculadas a mano, no eran la
  optimización real (el carácter 6 son dos ganancias paralelas, no una ganancia y una reversión) — ahora una prueba
  las recalcula; el enraizado con un grupo externo de varios taxones sólo buscaba el grupo interno entre los hijos
  de la raíz y declaraba no monofilético a un grupo que sí lo era.
