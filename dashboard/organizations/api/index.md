# Daten abrufen

## Downloads

Laden Sie Ihre Eckendaten als CSV-Datei herunter.

<DownloadBtn />

<script setup>
import DownloadBtn from '../../../components/api/DownloadBtn.vue'
</script>

## API

Die API von Thünen Corner bietet Zugriff auf die Daten, die in den Ecken gespeichert sind. Sie können die API verwenden, um Daten abzurufen.

## API - Anzahl der verfügbaren Ecken

Mit diesem Beispiel können Sie die Anzahl der Ecken abrufen, auf die Sie Zugriff haben. Ersetzen Sie die Anmeldeinformationen durch Ihre eigenen, um die Anzahl der verfügbaren Ecken zu erhalten.

::: code-group

```R [R]
# count.R — Count records the authenticated user can access
library(httr)
library(jsonlite)

URL <- "https://ci.thuenen.de"
KEY <- "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU"

# 1) Login
login_resp <- POST(
    paste0(URL, "/auth/v1/token?grant_type=password"),
    add_headers(apikey = KEY, `Content-Type` = "application/json"),
    body = toJSON(list(
        email    = "replace-with-your-email@example.com",
        password = "replace-with-your-password"
    ), auto_unbox = TRUE),
    encode = "raw"
)
auth <- fromJSON(content(login_resp, "text", encoding = "UTF-8"))

# 2) Count records
resp <- GET(
    paste0(URL, "/rest/v1/records?select=id&limit=0"),
    add_headers(
        apikey           = KEY,
        Authorization    = paste("Bearer", auth$access_token),
        `Accept-Profile` = "public",
        Prefer           = "count=exact"
    )
)

# 3) Total is in Content-Range header: "*/12345"
total <- as.integer(sub(".*/", "", headers(resp)[["content-range"]]))
cat(sprintf("Verfügbare Ecken: %d\n", total))
```

```python [Python]
# count.py — Count records the authenticated user can access
import requests

URL = "https://ci.thuenen.de"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU"

# 1) Login
auth = requests.post(
    f"{URL}/auth/v1/token?grant_type=password",
    headers={"apikey": KEY, "Content-Type": "application/json"},
    json={"email": "replace-with-your-email@example.com",
          "password": "replace-with-your-password"},
).json()

# 2) Count records (RLS filters automatically)
resp = requests.get(
    f"{URL}/rest/v1/records?select=id&limit=0",
    headers={
        "apikey": KEY,
        "Authorization": f"Bearer {auth['access_token']}",
        "Accept-Profile": "public",
        "Prefer": "count=exact",
    },
)

# 3) Total is in Content-Range header: "*/12345"
total = resp.headers["content-range"].split("/")[-1]
print(f"Verfügbare Ecken: {total}")
```

:::

## API - Bäume mit ungünstigem h/d Verhältnis

Mit diesem Beispiel können Sie Bäume mit einem ungünstigen h/d-Verhältnis identifizieren. Ersetzen Sie die Anmeldeinformationen durch Ihre eigenen, um die Analyse durchzuführen.

::: code-group

```R [R]
# Berechnung:
#   dbh         → Millimeter  → / 10  = cm
#   tree_height → Dezimeter   → * 10  = cm
#   h/d = tree_height_cm / dbh_cm

library(httr2)
library(jsonlite)

URL     <- "https://ci.thuenen.de"
KEY     <- "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU"
HD_MIN  <- 60
HD_MAX  <- 80

# ── 1. Login ─────────────────────────────────────────────────────────────────
auth <- request(paste0(URL, "/auth/v1/token?grant_type=password")) |>
  req_headers(apikey = KEY, `Content-Type` = "application/json") |>
  req_body_json(list(email = "replace-with-your-email@example.com", password = "replace-with-your-password")) |>
  req_perform() |>
  resp_body_json()

token <- auth$access_token

auth_headers <- function(req) {
  req |>
    req_headers(
      apikey           = KEY,
      Authorization    = paste("Bearer", token),
      `Accept-Profile` = "public"
    )
}

# ── 2. Alle Records seitenweise laden ────────────────────────────────────────
PAGE    <- 1000L
offset  <- 0L
records <- list()

repeat {
  page <- request(URL) |>
    req_url_path_append("rest/v1/records") |>
    req_url_query(
      select = "cluster_name,plot_name,properties->tree",
      limit  = PAGE,
      offset = offset
    ) |>
    auth_headers() |>
    req_perform() |>
    resp_body_json(simplifyVector = FALSE)

  if (length(page) == 0) break
  records <- c(records, page)
  offset  <- offset + PAGE
  if (length(page) < PAGE) break
}

cat(sprintf("Geladene Ecken: %d\n", length(records)))

# ── 3. h/d-Verhältnis berechnen ──────────────────────────────────────────────
not_optimal   <- list()
skipped_trees <- 0L
total_trees   <- 0L

for (rec in records) {
  cluster <- rec$cluster_name
  plot    <- rec$plot_name
  trees   <- if (!is.null(rec$tree)) rec$tree else list()

  for (tree in trees) {
    total_trees <- total_trees + 1L

    dbh_mm    <- tree$dbh
    height_dm <- tree$tree_height

    if (is.null(dbh_mm) || is.null(height_dm)) { skipped_trees <- skipped_trees + 1L; next }

    dbh_mm    <- suppressWarnings(as.numeric(dbh_mm))
    height_dm <- suppressWarnings(as.numeric(height_dm))

    if (is.na(dbh_mm) || is.na(height_dm) || dbh_mm <= 0) { skipped_trees <- skipped_trees + 1L; next }

    dbh_cm    <- dbh_mm / 10
    height_cm <- height_dm * 10
    hd        <- height_cm / dbh_cm

    if (hd < HD_MIN || hd > HD_MAX) {
      not_optimal <- c(not_optimal, list(list(
        cluster_name = cluster,
        plot_name    = plot,
        tree_number  = tree$tree_number,
        dbh_cm       = round(dbh_cm, 1),
        height_cm    = round(height_cm, 1),
        hd           = round(hd, 1),
        flag         = if (hd > HD_MAX) "zu instabil (> 80)" else "zu gedrungen (< 60)"
      )))
    }
  }
}

# ── 4. Ausgabe ────────────────────────────────────────────────────────────────
cat(sprintf("\nBäume überprüft:      %d\n", total_trees))
cat(sprintf("Übersprungen (k.A.):  %d\n", skipped_trees))
cat(sprintf("Nicht optimal:        %d\n", length(not_optimal)))
cat(sprintf("  davon > 80 (inst.): %d\n", sum(sapply(not_optimal, \(t) t$hd > HD_MAX))))
cat(sprintf("  davon < 60 (gedr.): %d\n", sum(sapply(not_optimal, \(t) t$hd < HD_MIN))))

if (length(not_optimal) > 0) {
  df <- do.call(rbind, lapply(not_optimal, as.data.frame))
  cat(sprintf("\n%6s  %4s  %5s  %7s  %7s  %6s  Flag\n",
              "Trakt", "Ecke", "Baum", "DBH cm", "H cm", "h/d"))
  cat(strrep("-", 60), "\n")
  show <- head(df, 50)
  for (i in seq_len(nrow(show))) {
    t <- show[i, ]
    cat(sprintf("%6s  %4s  %5s  %7.1f  %7.1f  %6.1f  %s\n",
                t$cluster_name, t$plot_name, t$tree_number,
                t$dbh_cm, t$height_cm, t$hd, t$flag))
  }
  if (nrow(df) > 50) cat(sprintf("... und %d weitere\n", nrow(df) - 50))
}
```

```python [Python]
# Berechnung:
#   dbh         → Millimeter  → / 10  = cm
#   tree_height → Dezimeter   → * 10  = cm
#   h/d = tree_height_cm / dbh_cm

import requests

URL = "https://ci.thuenen.de"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU"

HD_MIN = 60   # unterhalb: zu gedrungen / zu kurz
HD_MAX = 80   # oberhalb:  instabil / sturmgefährdet

# ── 1. Login ────────────────────────────────────────────────────────────────
auth = requests.post(
    f"{URL}/auth/v1/token?grant_type=password",
    headers={"apikey": KEY, "Content-Type": "application/json"},
    json={"email": "replace-with-your-email@example.com", "password": "replace-with-your-password"},
).json()

token = auth["access_token"]
headers = {"apikey": KEY, "Authorization": f"Bearer {token}",
           "Accept-Profile": "public"}

# ── 2. Alle Records seitenweise laden ──────────────────────────────────────
PAGE = 1000
records = []
offset = 0

while True:
    resp = requests.get(
        f"{URL}/rest/v1/records?select=cluster_name,plot_name,properties->tree"
        f"&limit={PAGE}&offset={offset}",
        headers=headers,
    )
    resp.raise_for_status()
    page = resp.json()
    if not page:
        break
    records.extend(page)
    offset += PAGE
    if len(page) < PAGE:
        break

print(f"Geladene Ecken: {len(records)}")

# ── 3. h/d-Verhältnis berechnen ─────────────────────────────────────────────
not_optimal = []   # list of dicts with details
skipped_trees = 0  # trees with missing / zero values

for rec in records:
    cluster = rec.get("cluster_name")
    plot = rec.get("plot_name")
    trees = (rec.get("tree") or [])

    for tree in trees:
        tree_number = tree.get("tree_number")
        dbh_mm = tree.get("dbh")          # mm
        height_dm = tree.get("tree_height")  # dm

        if dbh_mm is None or height_dm is None:
            skipped_trees += 1
            continue
        try:
            dbh_mm = float(dbh_mm)
            height_dm = float(height_dm)
        except (TypeError, ValueError):
            skipped_trees += 1
            continue

        if dbh_mm <= 0:
            skipped_trees += 1
            continue

        dbh_cm = dbh_mm / 10
        height_cm = height_dm * 10
        hd = height_cm / dbh_cm

        if hd < HD_MIN or hd > HD_MAX:
            not_optimal.append({
                "cluster_name": cluster,
                "plot_name":    plot,
                "tree_number":  tree_number,
                "dbh_cm":       round(dbh_cm, 1),
                "height_cm":    round(height_cm, 1),
                "hd":           round(hd, 1),
                "flag":         "zu instabil (> 80)" if hd > HD_MAX else "zu gedrungen (< 60)",
            })

# ── 4. Ausgabe ───────────────────────────────────────────────────────────────
print(
    f"\nBäume überprüft:     {sum(len(r.get('tree') or []) for r in records)}")
print(f"Übersprungen (k.A.): {skipped_trees}")
print(f"Nicht optimal:       {len(not_optimal)}")
print(
    f"  davon > 80 (inst.): {sum(1 for t in not_optimal if t['hd'] > HD_MAX)}")
print(
    f"  davon < 60 (gedr.): {sum(1 for t in not_optimal if t['hd'] < HD_MIN)}")

if not_optimal:
    print(f"\n{'Trakt':>6}  {'Ecke':>4}  {'Baum':>5}  {'DBH cm':>7}  {'H cm':>7}  {'h/d':>6}  Flag")
    print("-" * 60)
    for t in not_optimal[:50]:   # first 50 rows
        print(f"{str(t['cluster_name']):>6}  {str(t['plot_name']):>4}  "
              f"{str(t['tree_number']):>5}  {t['dbh_cm']:>7.1f}  "
              f"{t['height_cm']:>7.1f}  {t['hd']:>6.1f}  {t['flag']}")
    if len(not_optimal) > 50:
        print(f"... und {len(not_optimal) - 50} weitere")
```

```txt-vue{2} [OUTPUT]
Bäume überprüft:     515
Übersprungen (k.A.): 512
Nicht optimal:       2
  davon > 80 (inst.): 1
  davon < 60 (gedr.): 1

 Trakt  Ecke   Baum   DBH cm     H cm     h/d  Flag
------------------------------------------------------------
1000000069     1      1     30.0   3000.0   100.0  zu instabil (> 80)
1000000069     1      4     60.0   3200.0    53.3  zu gedrungen (< 60)
```

:::
