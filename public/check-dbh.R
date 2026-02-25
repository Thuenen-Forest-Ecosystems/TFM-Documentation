# check-dbh.R
# Check records where any tree has DBH > 1000 mm or DBH < 70 mm
# DBH is stored in properties.tree[].dbh (unit: mm)

script_dir <- tryCatch(dirname(sys.frame(1)$ofile), error = function(e) getwd())
source(file.path(script_dir, "get_records.R")) # fetches `records` with properties column

# Extract all DBH values with record/plot context
dbh_rows <- do.call(rbind, lapply(seq_len(nrow(records)), function(i) {
    trees <- tryCatch(records$properties[[i]]$tree, error = function(e) NULL)
    if (is.null(trees) || length(trees) == 0) {
        return(NULL)
    }
    data.frame(
        record_id = records$id[i],
        cluster_name = records$cluster_name[i],
        plot_name = records$plot_name[i],
        dbh = as.numeric(sapply(trees, `[[`, "dbh")),
        stringsAsFactors = FALSE
    )
}))

# Flag out-of-range values
invalid_dbh <- dbh_rows[!is.na(dbh_rows$dbh) & (dbh_rows$dbh > 1000 | dbh_rows$dbh < 70), ]

cat(sprintf("\nTotal trees checked: %d\n", nrow(dbh_rows)))
cat(sprintf("DBH out of range (>1000 or <70 mm): %d\n", nrow(invalid_dbh)))
print(invalid_dbh)
