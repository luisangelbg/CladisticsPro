# CladisticsPro — example matrices, simulated on known trees.
# Copyright (C) 2026 Luis Ángel Barrera-Guzmán. GPL-3.0-or-later.
#
# The examples of the app are SIMULATED. The names of the plants are real
# Mexican species and the statements of the characters are plausible
# morphology, but the states were drawn by a Markov process along a tree
# written here, not observed on specimens. They are for teaching and testing,
# not for any taxonomic conclusion; the app says so wherever they appear.
#
# Writes, in this folder:
#   ejemplo_bursera.nex   8 taxa × 12 characters  (small, exact search in an instant)
#   ejemplo_dahlia.nex   20 taxa × 45 characters  (every kind of character)
#   ejemplo_grande.nex  120 taxa × 300 characters (to time the ratchet)
# each with its true tree in a TREES block. Then hacer_examples.js embeds them
# in js/examples.js.
#
# Run: Rscript generar_ejemplos.R

suppressMessages({ library(ape) })
here <- tryCatch(dirname(normalizePath(sys.frame(1)$ofile)), error = function(e) getwd())
SYM <- c(0:9, LETTERS[1:20])

q <- function(s) if (grepl("^[A-Za-z0-9_.-]+$", s) && !grepl("^[0-9]+$", s)) s else paste0("'", gsub("'", "''", s), "'")

# ---- simulation of one character along a tree ---------------------------------
# k states; model "unord" (every change equally likely), "ord" (only to the
# adjacent state) or a rate matrix Q given; rate = expected changes per unit of
# branch length; the root state is drawn from `root` (vector of states).
sim_char <- function(tr, k, rate, model = "unord", root = 0, Q = NULL) {
  if (is.null(Q)) {
    Q <- matrix(0, k, k)
    for (a in 1:k) for (b in 1:k) if (a != b) Q[a, b] <- if (model == "ord") as.numeric(abs(a - b) == 1) else 1
  }
  diag(Q) <- 0
  Q <- Q / max(rowSums(Q))
  n <- Ntip(tr); st <- integer(n + tr$Nnode)
  st[n + 1] <- if (length(root) > 1) sample(root, 1) else root
  tr2 <- reorder(tr, "cladewise")
  for (e in seq_len(nrow(tr2$edge))) {
    p <- tr2$edge[e, 1]; ch <- tr2$edge[e, 2]
    s <- st[p]; t <- tr2$edge.length[e] * rate
    # Gillespie along the branch
    repeat {
      out <- sum(Q[s + 1, ])
      if (out <= 0) break
      w <- rexp(1, out)
      if (w > t) break
      t <- t - w
      s <- sample(0:(k - 1), 1, prob = Q[s + 1, ])
    }
    st[ch] <- s
  }
  setNames(st[1:n], tr$tip.label)
}
# Brownian motion of a log measurement
sim_cont <- function(tr, mean, sd) {
  x <- rTraitCont(tr, model = "BM", sigma = sd, root.value = log(mean))
  exp(x)
}

# ---- NEXUS writer in the app's own conventions -----------------------------------
write_nexus <- function(file, title, taxa, chars, M, contM, tree, outgroup, depends, units, ranges) {
  # chars: list of list(name, states, type, cost); discrete only, in order
  L <- c("#NEXUS", paste0("[", title, " — matriz SIMULADA para enseñar y probar CladisticsPro; los estados no se observaron en ejemplares]"), "")
  L <- c(L, "BEGIN TAXA;", paste0("  DIMENSIONS NTAX=", length(taxa), ";"),
         paste0("  TAXLABELS ", paste(sapply(taxa, q), collapse = " "), ";"), "END;", "")
  maxk <- max(sapply(chars, function(c) length(c$states)))
  L <- c(L, "BEGIN CHARACTERS;", if (!is.null(contM)) "  TITLE 'Discretos';",
         paste0("  DIMENSIONS NCHAR=", length(chars), ";"),
         paste0('  FORMAT DATATYPE=STANDARD MISSING=? GAP=- SYMBOLS="', paste(SYM[1:maxk], collapse = " "), '";'),
         "  CHARSTATELABELS")
  csl <- sapply(seq_along(chars), function(j) paste0("    ", j, " ", q(chars[[j]]$name), " / ", paste(sapply(chars[[j]]$states, q), collapse = " ")))
  L <- c(L, paste0(paste(csl, collapse = ",\n"), ";"), "  MATRIX")
  w <- max(nchar(sapply(taxa, q))) + 2
  for (i in seq_along(taxa)) L <- c(L, paste0("    ", formatC(q(taxa[i]), width = -w), paste(M[i, ], collapse = "")))
  L <- c(L, "  ;", "END;", "")
  if (!is.null(contM)) {
    L <- c(L, "BEGIN CHARACTERS;", "  TITLE 'Continuos';", paste0("  DIMENSIONS NCHAR=", ncol(contM), ";"),
           "  FORMAT DATATYPE=CONTINUOUS MISSING=? GAP=-;",
           paste0("  CHARLABELS ", paste(sapply(colnames(contM), q), collapse = " "), ";"), "  MATRIX")
    for (i in seq_along(taxa)) L <- c(L, paste0("    ", formatC(q(taxa[i]), width = -w), paste(contM[i, ], collapse = " ")))
    L <- c(L, "  ;", "END;", "")
  }
  ord <- which(sapply(chars, function(c) c$type == "ord"))
  stp <- which(sapply(chars, function(c) c$type == "step"))
  if (length(ord) || length(stp)) {
    L <- c(L, "BEGIN ASSUMPTIONS;")
    for (j in stp) {
      C <- chars[[j]]$cost; k <- nrow(C)
      L <- c(L, paste0("  USERTYPE paso_", j, " (STEPMATRIX) = ", k), paste0("    ", paste(SYM[1:k], collapse = " ")))
      for (a in 1:k) L <- c(L, paste0("    ", paste(ifelse(seq_len(k) == a, ".", C[a, ]), collapse = " ")))
      L <- c(L, "  ;")
    }
    un <- setdiff(seq_along(chars), c(ord, stp))
    parts <- c(if (length(un)) paste0("unord: ", paste(un, collapse = " ")),
               if (length(ord)) paste0("ord: ", paste(ord, collapse = " ")),
               if (length(stp)) paste0("paso_", stp, ": ", stp))
    L <- c(L, paste0("  TYPESET * tipos = ", paste(parts, collapse = ", "), ";"), "END;", "")
  }
  L <- c(L, "BEGIN TREES;", paste0("  TREE arbol_verdadero = [&R] ", write.tree(tree)), "END;", "")
  L <- c(L, "BEGIN CLADISTICSPRO;", paste0("  TITLE ", q(title), ";"), paste0("  OUTGROUP ", paste(outgroup, collapse = " "), ";"))
  for (d in depends) L <- c(L, paste0("  DEPENDS ", d[1], " ON ", d[2], " = ", paste(d[-(1:2)], collapse = " "), ";"))
  for (u in units) L <- c(L, paste0("  UNIT ", u[1], " ", q(u[2]), ";"))
  for (r in ranges) L <- c(L, paste0("  RANGE ", r[1], " ", r[2], " ", r[3], " ", r[4], ";"))
  L <- c(L, "END;")
  writeLines(L, file.path(here, file), useBytes = TRUE)
}
# fill in «?» and polymorphisms
sprinkle <- function(M, pmiss, ppoly, keep_rows = integer(0)) {
  for (i in seq_len(nrow(M))) for (j in seq_len(ncol(M))) {
    if (i %in% keep_rows || M[i, j] == "-") next
    u <- runif(1)
    if (u < pmiss) M[i, j] <- "?"
    else if (u < pmiss + ppoly && M[i, j] %in% c("0", "1")) M[i, j] <- "(01)"
  }
  M
}

# =============================================================================
# 1 · Bursera, small
# =============================================================================
set.seed(1201)
tb <- read.tree(text = "(Spondias_purpurea,((Bursera_simaruba,Bursera_glabrifolia),((Bursera_fagaroides,Bursera_microphylla),(Bursera_copallifera,(Bursera_bipinnata,Bursera_schlechtendalii)))));")
tb$edge.length <- rep(1, nrow(tb$edge))
taxa_b <- gsub("_", " ", tb$tip.label)
chars_b <- list(
  list(name = "Hoja", states = c("simple", "compuesta"), type = "unord"),
  list(name = "Folíolos", states = c("enteros", "serrados"), type = "unord"),
  list(name = "Raquis", states = c("sin alas", "alado"), type = "unord"),
  list(name = "Corteza", states = c("no exfoliante", "exfoliante en láminas"), type = "unord"),
  list(name = "Resina", states = c("sin aroma", "aromática"), type = "unord"),
  list(name = "Partes florales", states = c("cuatro", "cinco"), type = "unord"),
  list(name = "Fruto", states = c("drupa carnosa", "drupa bivalvada"), type = "unord"),
  list(name = "Pseudoarilo", states = c("ausente", "rojo"), type = "unord"),
  list(name = "Hojas en", states = c("brotes largos", "braquiblastos"), type = "unord"),
  list(name = "Pubescencia", states = c("glabra", "pubescente"), type = "unord"),
  list(name = "Hábito", states = c("árbol", "arbusto"), type = "unord"),
  list(name = "Inflorescencia", states = c("racimo", "flores solitarias"), type = "unord"))
# characters drawn by hand on the tree: synapomorphies of its clades, with some homoplasy
Mb <- rbind(
  "Spondias purpurea"       = c(1,0,0,0,0,1,0,0,0,0,0,0),
  "Bursera simaruba"        = c(1,0,0,1,1,1,1,1,0,0,0,0),
  "Bursera glabrifolia"     = c(1,1,0,1,1,1,1,1,0,1,0,0),
  "Bursera fagaroides"      = c(1,0,1,1,1,0,1,1,1,0,1,1),
  "Bursera microphylla"     = c(0,0,1,1,1,0,1,1,1,0,1,1),
  "Bursera copallifera"     = c(1,1,1,0,1,0,1,1,0,1,0,0),
  "Bursera bipinnata"       = c(1,1,1,0,1,0,1,1,1,1,1,0),
  "Bursera schlechtendalii" = c(0,1,1,0,1,0,1,1,1,1,1,1))
Mb <- Mb[taxa_b, ]
Mb <- matrix(as.character(Mb), nrow(Mb), dimnames = dimnames(Mb))
Mb["Bursera microphylla", 10] <- "?"
Mb["Bursera glabrifolia", 12] <- "?"
write_nexus("ejemplo_bursera.nex", "Bursera (didáctico)", taxa_b, chars_b, Mb, NULL, tb, 1, list(), list(), list())

# =============================================================================
# 2 · Dahlia, every kind of character
# =============================================================================
set.seed(20261003)
td <- read.tree(text = paste0("(Bidens_pilosa,(Cosmos_bipinnatus,((Dahlia_macdougallii,(Dahlia_imperialis,(Dahlia_excelsa,",
  "(Dahlia_tenuicaulis,Dahlia_campanulata)))),((Dahlia_linearis,(Dahlia_rupicola,Dahlia_dissecta)),((Dahlia_scapigera,",
  "Dahlia_cardiophylla),((Dahlia_merckii,Dahlia_moorei),((Dahlia_coccinea,(Dahlia_sherffii,Dahlia_atropurpurea)),",
  "(Dahlia_pinnata,(Dahlia_rudis,Dahlia_australis)))))))));"))
td <- compute.brlen(td, method = "Grafen", power = 0.8)
td$edge.length <- td$edge.length / sum(td$edge.length) * 10   # about 2–3 changes per character at rate 0.25
taxa_d <- gsub("_", " ", td$tip.label)
n <- length(taxa_d)
clade <- function(...) taxa_d %in% paste("Dahlia", c(...))
pseudo <- clade("imperialis", "excelsa", "tenuicaulis", "campanulata")
entemo <- clade("linearis", "rupicola", "dissecta")
dahlia <- grepl("^Dahlia", taxa_d)
# 42 discrete characters (the three continuous ones go in their own block)
D <- list()
add <- function(name, states, type = "unord", values = NULL, rate = 0.25, cost = NULL, root = 0, need = dahlia) {
  k <- length(states)
  if (is.null(values)) {
    Q <- if (type == "step") { Qs <- 1 / cost; Qs[!is.finite(Qs)] <- 0; Qs } else NULL
    tries <- 0
    repeat {
      v <- sim_char(td, k, rate, if (type == "ord") "ord" else "unord", root, Q)
      tries <- tries + 1
      tb2 <- table(v[need])
      # informative among the taxa that have the structure (two states, each in two taxa); after
      # 300 draws it is enough that the character varies
      if (sum(tb2 >= 2) >= 2 || (tries > 300 && length(tb2) > 1)) break
    }
    values <- v
  }
  D[[length(D) + 1]] <<- list(name = name, states = states, type = type, cost = cost, values = as.integer(values))
}
add("Hábito", c("herbáceo", "sufrútice", "arborescente", "epífito"),
    values = ifelse(pseudo, 2, ifelse(taxa_d == "Dahlia macdougallii", 3, ifelse(taxa_d %in% c("Dahlia sherffii", "Dahlia australis", "Dahlia merckii"), 1, 0))))
add("Raíces tuberosas", c("ausentes", "presentes"), values = as.integer(dahlia))
add("Tallo", c("sólido", "fistuloso"), values = as.integer(pseudo | taxa_d %in% c("Dahlia coccinea", "Dahlia pinnata")))
add("Entrenudos", c("no engrosados", "engrosados en los nudos"), rate = 0.2)
add("Tricomas del tallo", c("ausentes", "presentes"), rate = 0.35)               # 5: controls 6 and 7
add("Tipo de tricoma del tallo", c("simples", "glandulares"), rate = 0.3, need = D[[5]]$values == 1)        # 6
add("Densidad de tricomas", c("escasos", "densos"), rate = 0.3, need = D[[5]]$values == 1)                 # 7
add("División de la hoja", c("simple", "pinnada", "bipinnada", "tripinnada"), "ord",
    values = ifelse(pseudo, 2, ifelse(entemo, 3, ifelse(taxa_d %in% c("Dahlia scapigera", "Dahlia cardiophylla"), 0, 1))))
add("Hojas", c("sésiles", "pecioladas"), rate = 0.2, root = 1)
add("Raquis", c("sin alas", "alado"), rate = 0.25)
add("Margen del folíolo", c("entero", "serrado", "crenado"), rate = 0.3, root = 1)
add("Ápice del folíolo", c("agudo", "acuminado", "obtuso"), rate = 0.3)
add("Hojas en roseta basal", c("no", "sí"), values = as.integer(taxa_d %in% c("Dahlia scapigera", "Dahlia cardiophylla")))
add("Envés de la hoja", c("glabro", "pubescente"), rate = 0.3)
add("Nervación del folíolo", c("pinnada", "palmeada desde la base"), rate = 0.2)
add("Capítulos por rama", c("solitarios", "de dos a cuatro", "muchos"), "ord", rate = 0.35, root = 1)
add("Capítulos", c("erectos", "nutantes"), values = as.integer(pseudo | taxa_d == "Dahlia macdougallii"))
add("Pedúnculo", c("más corto que la hoja", "más largo que la hoja"), rate = 0.25, root = 1)
add("Brácteas involucrales externas", c("reflejas", "patentes", "adpresas"), rate = 0.3)
add("Número de brácteas externas", c("cinco", "ocho o más"), rate = 0.2)
add("Forma de la bráctea externa", c("ovada", "linear", "espatulada"), rate = 0.3)
add("Brácteas internas", c("libres", "connadas en la base"), values = as.integer(dahlia))
add("Páleas", c("persistentes", "caducas"), rate = 0.2)
add("Flores liguladas", c("ocho", "más de ocho"), rate = 0.25)
add("Color de la lígula", c("blanco", "rosado", "morado", "rojo"), "step",
    cost = rbind(c(0, 1, 2, 2), c(1, 0, 1, 1), c(2, 1, 0, 2), c(3, 2, 2, 0)), rate = 0.35, root = 1)
add("Ápice de la lígula", c("entero", "tridentado"), rate = 0.25, root = 1)
add("Lígula", c("plana", "acanalada"), rate = 0.15)
add("Corola del disco", c("amarilla", "anaranjada", "morada"), rate = 0.25)
add("Lóbulos de la corola", c("glabros", "pilosos"), rate = 0.25)
add("Anteras", c("amarillas", "negras"), values = as.integer(taxa_d %in% c("Dahlia coccinea", "Dahlia sherffii", "Dahlia atropurpurea", "Bidens pilosa")))
add("Ramas del estilo", c("agudas", "obtusas"), rate = 0.2)
add("Forma del aquenio", c("oblanceolado", "linear"), values = as.integer(!dahlia))
add("Aquenio alado", c("no", "sí"), rate = 0.3)                                  # 33: controls 34
add("Tipo de ala", c("entera", "fimbriada"), rate = 0.3, need = D[[33]]$values == 1)                          # 34
add("Vilano", c("ausente", "presente"), values = as.integer(!dahlia | taxa_d %in% c("Dahlia merckii", "Dahlia moorei")))  # 35: controls 36, 37
add("Tipo de vilano", c("aristas", "escamas"), rate = 0.3, need = D[[35]]$values == 1)                        # 36
add("Número de aristas", c("dos", "cuatro"), rate = 0.3, need = D[[35]]$values == 1)                          # 37
add("Superficie del aquenio", c("lisa", "tuberculada"), rate = 0.25)
add("Color del aquenio", c("negro", "café", "moteado"), rate = 0.3)
add("Número cromosómico", c("diploide", "tetraploide", "octoploide"), "ord",
    values = ifelse(pseudo, 1, ifelse(taxa_d %in% c("Dahlia coccinea", "Dahlia pinnata", "Dahlia rudis", "Dahlia australis", "Dahlia sherffii", "Dahlia atropurpurea"), 2, 0)))
add("Látex", c("ausente", "presente"), rate = 0.15)
add("Disposición de las hojas", c("opuestas", "verticiladas"), values = as.integer(pseudo & taxa_d != "Dahlia campanulata"))
Md <- sapply(D, function(c) as.character(c$values))
rownames(Md) <- taxa_d
# inapplicables: a dependent character is «-» where its controlling structure is absent
deps <- list(c(6, 5, 1), c(7, 5, 1), c(34, 33, 1), c(36, 35, 1), c(37, 35, 1))
for (d in deps) Md[Md[, d[2]] != as.character(d[3]), d[1]] <- "-"
Md <- sprinkle(Md, 0.05, 0.025, keep_rows = 1:2)
# one autapomorphy on purpose, so the quality control has something to say
Md[, 41] <- "0"; Md["Dahlia imperialis", 41] <- "1"
# continuous characters: a log-normal Brownian motion, and a range of ±12 % per species
cont <- cbind("Altura de la planta" = sim_cont(td, 120, 0.45), "Longitud de la hoja" = sim_cont(td, 22, 0.35), "Longitud de la lígula" = sim_cont(td, 35, 0.3))
cont[pseudo, 1] <- cont[pseudo, 1] * 4
contM <- matrix(sprintf("%.1f", cont), n, dimnames = list(taxa_d, colnames(cont)))
contM[sample(3:n, 2), 2] <- "?"
ranges <- list()
for (i in 1:n) for (j in 1:3) if (contM[i, j] != "?") {
  v <- cont[i, j]; ranges[[length(ranges) + 1]] <- c(42 + j, i, sprintf("%.1f", v * 0.88), sprintf("%.1f", v * 1.12))
}
write_nexus("ejemplo_dahlia.nex", "Dahlia (didáctico)", taxa_d, lapply(D, function(c) c[c("name", "states", "type", "cost")]),
            Md, contM, td, c(1, 2), deps, list(c(43, "cm"), c(44, "cm"), c(45, "mm")), ranges)

# =============================================================================
# 3 · a large matrix, to time the ratchet
# =============================================================================
set.seed(777)
tg <- rtree(120, tip.label = sprintf("Taxón_%03d", 1:120))
tg$edge.length <- tg$edge.length * 0.6
taxa_g <- sort(gsub("_", " ", tg$tip.label))
G <- list()
for (j in 1:300) {
  k <- sample(c(2, 2, 2, 3, 3, 4), 1)
  repeat { v <- sim_char(tg, k, runif(1, 0.02, 0.08)); if (length(unique(v)) > 1) break }
  G[[j]] <- list(name = paste("Carácter", j), states = as.character(0:(k - 1)), type = "unord", values = v)
}
Mg <- sapply(G, function(c) as.character(c$values)); rownames(Mg) <- gsub("_", " ", tg$tip.label); Mg <- Mg[taxa_g, ]
Mg <- sprinkle(Mg, 0.04, 0, keep_rows = 1)
write_nexus("ejemplo_grande.nex", "Matriz grande simulada", taxa_g, lapply(G, function(c) c[c("name", "states", "type")]),
            Mg, NULL, tg, 1, list(), list(), list())
cat("ejemplos escritos en", here, "\n")
