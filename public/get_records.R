# get_records.R
# ============================================================================
# Fetch all records from public.records via Supabase REST API (paginated loop)
#
# Access is governed by RLS:
#   - Root-org users see all records
#   - Other users see only records where their organization_id matches
#     responsible_administration, responsible_state, responsible_provider,
#     or responsible_troop
#
# Auth: logs in with email + password to obtain a user JWT, so RLS is enforced.
#       Credentials can also be set via SUPABASE_EMAIL / SUPABASE_PASSWORD env vars,
#       or provide a ready-made token in SUPABASE_USER_TOKEN to skip login entirely.
# ============================================================================

# ---- Dependencies -----------------------------------------------------------
if (!require(httr)) install.packages("httr")
if (!require(jsonlite)) install.packages("jsonlite")
if (!require(dplyr)) install.packages("dplyr")

library(httr)
library(jsonlite)
library(dplyr)

# ---- Config -----------------------------------------------------------------
# Load .env — checks (in order):
#   1. same directory as this script
#   2. current working directory
#   3. parent of current working directory
script_dir <- tryCatch(dirname(sys.frame(1)$ofile), error = function(e) NULL)
env_candidates <- unique(c(
    if (!is.null(script_dir)) file.path(script_dir, ".env"),
    file.path(getwd(), ".env"),
    file.path(dirname(getwd()), ".env")
))
env_file <- Filter(file.exists, env_candidates)[1]

if (!is.na(env_file) && !is.null(env_file)) {
    if (!require(dotenv)) install.packages("dotenv")
    dotenv::load_dot_env(file = env_file)
    cat("Loaded .env from:", env_file, "\n")
} else {
    cat("No .env file found. Relying on environment variables.\n")
}

SUPABASE_URL <- Sys.getenv("SUPABASE_URL", unset = NA)
SUPABASE_ANON_KEY <- Sys.getenv("SUPABASE_ANON_TOKEN", unset = NA)

if (is.na(SUPABASE_URL) || SUPABASE_URL == "") {
    stop("SUPABASE_URL is not set. Please set it in your environment or .env file.")
}
if (is.na(SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY == "") {
    stop("SUPABASE_ANON_TOKEN is not set. Please set it in your environment or .env file.")
}

# ---- Login: email + password -> JWT -----------------------------------------
login_supabase <- function(email = NULL, password = NULL) {
    if (is.null(email) || email == "") {
        email <- readline(prompt = "Supabase email: ")
    }
    if (is.null(password) || password == "") {
        # readline shows input in plain text; use rstudioapi when available
        if (requireNamespace("rstudioapi", quietly = TRUE) &&
            rstudioapi::isAvailable()) {
            password <- rstudioapi::askForPassword("Supabase password")
        } else {
            password <- readline(prompt = "Supabase password: ")
        }
    }

    auth_url <- sprintf(
        "%s/auth/v1/token?grant_type=password",
        sub("/$", "", SUPABASE_URL)
    )

    resp <- POST(
        auth_url,
        add_headers(
            "apikey"       = SUPABASE_ANON_KEY,
            "Content-Type" = "application/json"
        ),
        body = toJSON(list(email = email, password = password), auto_unbox = TRUE),
        encode = "raw"
    )

    if (status_code(resp) != 200) {
        body <- tryCatch(content(resp, as = "text", encoding = "UTF-8"), error = function(e) "")
        stop(sprintf("Login failed (HTTP %d): %s", status_code(resp), body))
    }

    parsed <- fromJSON(content(resp, as = "text", encoding = "UTF-8"))
    token <- parsed[["access_token"]]
    if (is.null(token) || token == "") stop("Login succeeded but no access_token in response.")

    cat(sprintf("Logged in as: %s\n", email))
    token
}

# Obtain token: prefer env var, fall back to interactive login
SUPABASE_AUTH_TOKEN <- {
    t <- Sys.getenv("SUPABASE_USER_TOKEN", unset = "")
    if (nchar(t) > 0) {
        cat("Using SUPABASE_USER_TOKEN from environment.\n")
        t
    } else {
        cat("SUPABASE_USER_TOKEN not set — please log in.\n")
        login_supabase(
            email    = Sys.getenv("SUPABASE_EMAIL", unset = ""),
            password = Sys.getenv("SUPABASE_PASSWORD", unset = "")
        )
    }
}

# ---- Parameters -------------------------------------------------------------
PAGE_SIZE <- 1000L # PostgREST default max; adjust as needed
SCHEMA <- "public"
TABLE <- "records"

# Optional column selection (set to "*" for all columns)
SELECT_COLUMNS <- paste(c(
    "id",
    "cluster_name",
    "plot_name",
    "properties",
    "responsible_provider",
    "responsible_troop",
    "completed_at_troop",
    "completed_at_state",
    "completed_at_administration",
    "updated_at"
), collapse = ",")

# Optional: filter by a specific organization UUID in responsible_administration
# or responsible_state. Set to NULL to return all records visible to the user.
FILTER_RESPONSIBLE_ADMINISTRATION <- NULL # e.g. "uuid-of-org"
FILTER_RESPONSIBLE_STATE <- NULL # e.g. "uuid-of-state-org"

# ---- Helper: build common request headers -----------------------------------
build_headers <- function(token, anon_key, schema = "public") {
    h <- c(
        "apikey"          = anon_key,
        "Authorization"   = paste("Bearer", token),
        "Accept"          = "application/json",
        "Accept-Profile"  = schema,
        "Prefer"          = "count=exact" # returns total count in header
    )
    h
}

# ---- Helper: single page fetch ----------------------------------------------
fetch_page <- function(url, headers, offset, limit) {
    response <- GET(
        url,
        add_headers(.headers = headers),
        query = list(
            select = SELECT_COLUMNS,
            offset = as.character(offset),
            limit  = as.character(limit)
        )
    )

    status <- status_code(response)
    if (status == 401) stop("Unauthorized (401). Check your SUPABASE_USER_TOKEN.")
    if (status == 403) stop("Forbidden (403). Your token may lack access to this resource.")
    if (status %/% 100 != 2) {
        body <- tryCatch(content(response, as = "text", encoding = "UTF-8"), error = function(e) "")
        stop(sprintf("HTTP %d from Supabase: %s", status, body))
    }

    # Extract total count from Content-Range header  (e.g. "0-999/12345")
    content_range <- headers(response)[["content-range"]]
    total_count <- NA_integer_
    if (!is.null(content_range) && grepl("/", content_range)) {
        total_count <- as.integer(sub(".*/", "", content_range))
    }

    body_text <- content(response, as = "text", encoding = "UTF-8")
    rows <- fromJSON(body_text, flatten = TRUE)

    list(rows = rows, total_count = total_count)
}

# ---- Build base URL with optional filters -----------------------------------
base_url <- sprintf(
    "%s/rest/v1/%s",
    sub("/$", "", SUPABASE_URL),
    TABLE
)

# PostgREST filter query parameters appended via httr query list
# They are handled separately inside the loop to avoid URL length issues
extra_filters <- list()
if (!is.null(FILTER_RESPONSIBLE_ADMINISTRATION)) {
    extra_filters[["responsible_administration"]] <- paste0("eq.", FILTER_RESPONSIBLE_ADMINISTRATION)
}
if (!is.null(FILTER_RESPONSIBLE_STATE)) {
    extra_filters[["responsible_state"]] <- paste0("eq.", FILTER_RESPONSIBLE_STATE)
}

# ---- Paginated fetch loop ---------------------------------------------------
fetch_all_records <- function() {
    hdrs <- build_headers(SUPABASE_AUTH_TOKEN, SUPABASE_ANON_KEY, SCHEMA)
    all_rows <- list()
    offset <- 0L
    total <- NA_integer_
    page_num <- 1L

    repeat {
        cat(sprintf("Fetching page %d (offset %d, limit %d)...\n", page_num, offset, PAGE_SIZE))

        # Build query with optional filters + pagination
        query_params <- c(
            list(
                select = SELECT_COLUMNS,
                offset = as.character(offset),
                limit  = as.character(PAGE_SIZE)
            ),
            extra_filters
        )

        response <- GET(
            base_url,
            add_headers(.headers = hdrs),
            query = query_params
        )

        status <- status_code(response)
        if (status == 401) stop("Unauthorized (401). Check your SUPABASE_USER_TOKEN.")
        if (status == 403) stop("Forbidden (403). Insufficient permissions.")
        if (status %/% 100 != 2) {
            body <- tryCatch(content(response, as = "text", encoding = "UTF-8"), error = function(e) "")
            stop(sprintf("HTTP %d: %s", status, body))
        }

        # Parse total from Content-Range
        content_range <- headers(response)[["content-range"]]
        if (!is.null(content_range) && grepl("/", content_range)) {
            total <- as.integer(sub(".*/", "", content_range))
        }

        body_text <- content(response, as = "text", encoding = "UTF-8")
        rows <- fromJSON(body_text, flatten = TRUE)

        if (!is.data.frame(rows) || nrow(rows) == 0) {
            cat("No more rows. Stopping.\n")
            break
        }

        all_rows <- c(all_rows, list(rows))
        fetched <- offset + nrow(rows)

        cat(sprintf(
            "  -> Received %d rows (total fetched so far: %d%s)\n",
            nrow(rows),
            fetched,
            if (!is.na(total)) sprintf(" of %d", total) else ""
        ))

        # Stop if we received fewer rows than PAGE_SIZE (last page)
        if (nrow(rows) < PAGE_SIZE) break
        # Stop if we have fetched everything
        if (!is.na(total) && fetched >= total) break

        offset <- fetched
        page_num <- page_num + 1L
    }

    if (length(all_rows) == 0) {
        cat("No records returned. Check your credentials and organization membership.\n")
        return(data.frame())
    }

    result <- bind_rows(all_rows)
    cat(sprintf("\nDone. Total records fetched: %d\n", nrow(result)))
    result
}

# ---- Run --------------------------------------------------------------------
records <- fetch_all_records()

# ---- Inspect ----------------------------------------------------------------
if (nrow(records) > 0) {
    cat("\nColumn names:\n")
    print(names(records))

    cat("\nFirst 5 rows:\n")
    print(head(records, 5))

    cat(sprintf(
        "\nRecords with completed_at_troop: %d\n",
        sum(!is.na(records$completed_at_troop))
    ))
    cat(sprintf(
        "Records with completed_at_state: %d\n",
        sum(!is.na(records$completed_at_state))
    ))
    cat(sprintf(
        "Valid records (is_valid = TRUE): %d\n",
        sum(isTRUE(records$is_valid) | records$is_valid %in% TRUE, na.rm = TRUE)
    ))
}
