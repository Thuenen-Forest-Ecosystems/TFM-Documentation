# Check DBH

This use case is used to check the DBH of a cluster. The DBH is the diameter at breast height of a tree. It is a measure of the size of a tree and is used to estimate the age and growth of a tree.

::: code-group

```R [R]
source("get_records.R")   # login + fetch records (properties.tree[].dbh in mm)

dbh_rows <- do.call(rbind, lapply(seq_len(nrow(records)), function(i) {
    trees <- tryCatch(records$properties[[i]]$tree, error = function(e) NULL)
    if (is.null(trees) || length(trees) == 0) return(NULL)
    data.frame(
        record_id    = records$id[i],
        cluster_name = records$cluster_name[i],
        plot_name    = records$plot_name[i],
        dbh          = as.numeric(sapply(trees, `[[`, "dbh"))
    )
}))

invalid_dbh <- dbh_rows[!is.na(dbh_rows$dbh) & (dbh_rows$dbh > 1000 | dbh_rows$dbh < 70), ]
print(invalid_dbh)
```

```txt-vue{2} [.env]
CI_URL=https://ci.thuenen.de
CI_APIKEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU
CI_EMAIL=replace-with-your-email@example.com
CI_PASSWORD=replace-with-your-password
```

:::
