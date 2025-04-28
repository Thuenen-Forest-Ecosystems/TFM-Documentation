# Install necessary packages if not already installed
if (!require(httr)) install.packages("httr")
if (!require(jsonlite)) install.packages("jsonlite")
if (!require(dplyr)) install.packages("dplyr")

# Load the libraries
library(httr)
library(jsonlite)
library(dplyr)

# Set headers for the API request
headers = c(
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU',
  'Accept-Profile' = 'inventory_archive'
)

# Make the API request
res <- VERB("GET", url = "https://ci.thuenen.de/rest/v1/cluster?states_affected=cd.{5}&select=cluster_name,plot!fk_plot_cluster(plot_name,tree(dbh,tree_species))&plot.tree.dbh=not.is.null", add_headers(headers))


# Parse JSON response
data <- content(res, as = "parsed")


# Initialize empty data frame
tree_data <- data.frame(dbh = numeric(), tree_species = numeric())

# Loop through each cluster
for (cluster in data) {
  # Loop through each plot in the cluster
  for (plot in cluster$plot) {
    # Check if the plot has tree data
    if (length(plot$tree) > 0) {
      # Extract tree data safely
      dbh_values <- sapply(plot$tree, function(x) {
        if (!is.null(x$dbh)) as.numeric(x$dbh) else NA
      })
      species_values <- sapply(plot$tree, function(x) {
        if (!is.null(x$tree_species)) as.numeric(x$tree_species) else NA
      })
      
      # Only add data if both vectors have the same length
      if (length(dbh_values) == length(species_values) && length(dbh_values) > 0) {
        plot_trees <- data.frame(
          dbh = dbh_values,
          tree_species = species_values
        )
        # Bind the rows to the main data frame
        tree_data <- rbind(tree_data, plot_trees)
      }
    }
  }
}

# Calculate statistics grouped by tree species (only if we have data)
if (nrow(tree_data) > 0) {
  tree_stats <- tree_data %>%
    group_by(tree_species) %>%
    summarise(
      count = n(),
      mean_dbh = round(mean(dbh, na.rm = TRUE), 2),
      sd_dbh = round(sd(dbh, na.rm = TRUE), 2)
    )

  # Print results for each tree species
  for (i in 1:nrow(tree_stats)) {
    cat("\nTree species:", tree_stats$tree_species[i], "\n")
    cat("Number of trees:", tree_stats$count[i], "\n")
    cat("Mean DBH:", tree_stats$mean_dbh[i], "cm\n")
    cat("Standard deviation DBH:", tree_stats$sd_dbh[i], "cm\n")
  }
} else {
  cat("No tree data found in the response.\n")
}