<script setup>
  import { getCurrentInstance } from 'vue'
  const apikey = getCurrentInstance().appContext.config.globalProperties.$apikey;
</script>

# Aggregate & Group Data

For performance reasons, the API does not allow to aggregate data on the fly. Instead, you can post-process the data on your own. This page provides some examples on how to aggregate and group data.



## Mean DBH grouped by tree species in NRW

In this example, we will query meassured tree data from the inventory archive in North Rhine-Westphalia (NRW). We will then calculate the mean diameter at breast height (DBH) for each tree species.

::: code-group
```R-vue
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
  'apikey' = '{{apikey}}',
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
```
```Python-vue
import pandas as pd
import requests

class BearerAuth(requests.auth.AuthBase):
    def __init__(self, token, profile):
        self.token = token
        self.profile = profile
    def __call__(self, r):
        r.headers["apikey"] = self.token
        r.headers["Accept-Profile"] = self.profile
        return r
    
class RequestHandler():
    def __init__(self, baseUrl, token=None, profile=None, endPoint=None):
        self.baseUrl = baseUrl
        self.token = token
        self.profile = profile
        self.set_endpoint(endPoint)
    
    def set_endpoint(self, endPoint):
        self.endPoint = endPoint

    def get_response(self):
        if(not self.set_endpoint):
            return
        self.response = requests.get(self.baseUrl+self.endPoint, auth=BearerAuth(self.token, self.profile))
    
    def check_status(self):
        if(self.response.status_code in [200]):
            self._isAuthorized = True
        else:
            self._isAuthorized = False

    def isAuthorized(self):
        self.check_status()
        return self._isAuthorized

    def return_response_dataFrame(self) -> pd.DataFrame:
        """
        """
        if(self.isAuthorized()):
            return pd.DataFrame.from_records(self.response.json())
        else:
            print("Failed to retrieve data")

baseUrl = "https://ci.thuenen.de/rest/v1/"
authToken = '{{apikey}}'
acctProfile = 'inventory_archive'
endPoint = "cluster?states_affected=cd.{5}&select=cluster_name,plot!fk_plot_cluster(plot_name,tree(dbh,tree_species))&plot.tree.dbh=not.is.null"

requestHand = RequestHandler(baseUrl=baseUrl,
                             token=authToken,
                             profile=acctProfile,
                             endPoint=endPoint
                             )

requestHand.get_response()

dfData = requestHand.return_response_dataFrame().set_index('cluster_name')
dfPlots = pd.concat([pd.DataFrame.from_records(df).assign(cluster_name=key) for key, df in dfData.loc[:,'plot'].items()], ignore_index=True)
# Set cluster_name as index, to keep information in DataFrame for trees
dfPlots.set_index('cluster_name',inplace=True)
# Get all trees out of dfPlots
dfTrees = pd.concat([pd.DataFrame.from_records(df).assign(cluster_name=key) for key, df in dfPlots.loc[:,'tree'].items()], ignore_index=True)

# print summary
print(dfTrees.groupby('tree_species')['dbh'].describe())

# Part with named tree species
# prepare to get lookup table
endPoint = 'lookup_tree_species'
requestHand = RequestHandler(baseUrl=baseUrl,
                             token=authToken,
                             endPoint=endPoint,
                             profile='lookup'
                             )

# get lookup table
requestHand.get_response()
dfLookupTreeSpec = requestHand.return_response_dataFrame()

# Join with lookup table for tree species and print summary
print(dfTrees.join(dfLookupTreeSpec.set_index('code'), on=['tree_species'], how='left')[['dbh','tree_species','name_de']].groupby('name_de')['dbh'].describe())

```
:::

[Source Code (R)](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/aggregate_acer_nrw.R)

[Source Code (Python)](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/aggregate_nrw.py)