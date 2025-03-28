<script setup>
  let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
  //apikey = "[apikey]";
</script>

# Read by Position

Inventory Data is a collection of geospatial inventory data. To Read data based on the Position 

## Filter by Federal State

The clusters can be queried by Federal State. The Federal State is specified by the `federal_state` value.

In the example below, the column `code` from the table `lookup_state` is queried and filtered by the column `name_de`.

::: code-group

```cURL-vue{2} [REQUEST]
curl -X GET "https://ci.thuenen.de/rest/v1/lookup_state"  
    -d "name_de=like.Hessen"
    -d "select=code"
    -H "Accept: application/vnd.pgrst.object+json"
    -H "Accept-Profile: lookup" 
    -H "apikey: {{ apikey }}"
```

```JSON [RESPONSE]
{
  "code": 6
}
```

:::

With knowledge of the Federal State code, the clusters can be queried by Federal State is affected.

::: code-group

```cURL-vue
curl --globoff GET "https://ci.thuenen.de/rest/v1/cluster?states_affected=cd.{6}"  -H "Accept-Profile: inventory_archive"  -H "apikey: {{ apikey }}"
```
:::

The response will be a list of clusters that are located in the Federal State of Hessen.

## Filter by INSPIRE Grid Cells

The clusters can be queried using an overlaying 1km x 1km grid. Querying a grid cell by its `inspire_grid_cell` value will return all clusters that are located within the grid cell.

In the example below, the grid cell `eq.1kmN2688E4341` is queried. This grid cell is located in the south of Germany.

```cURL-vue
curl -X GET "https://ci.thuenen.de/rest/v1/cluster?inspire_grid_cell=eq.1kmN2688E4341"  -H "Accept-Profile: inventory_archive"  -H "apikey: {{ apikey }}"
```

More information and download (as csv & GeoPackage) of the grid cells can be found at the [bkg](https://gdz.bkg.bund.de/index.php/default/geographische-gitter-fur-deutschland-in-lambert-projektion-geogitter-inspire.html).

## Looping for details


This example shows conceptually how to get a simple list of some clusters and then use this list to fetch all (or at least many) details of the clusters an their dependend objects (plots, trees, ...) as structured data trees in a loop. This avoids requesting big data sets at once and therefore hitting limits per call.

::: code-group

```Javascript-vue
<!--
This example shows conceptually how to:
- get a list of clusters and 
- retrieve the json tree of the data belonging to thie clusters in the list from different related tables (plots, trees, ...)
In order to make it work as simple as possible it combines the javascript functionality together with some html to allow it to run simply by opening the file with a web browser.
-->

<!-- The beginning of html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Details Fetcher</title>
</head>
<body>
    <h1>Details Fetcher</h1>
    <div id="status"></div>
    <pre id="result"></pre>

<!-- Here starts the magic ;) -->
    <script>
        // Define the number of items, endpoints, and any necessary headers
        // Number of clusters to fetch (10 might be enough for the example)
        const samples = 10;
        // API base url
        const base_url = "https://ci.thuenen.de/rest/v1/";
        // API call for the list of clusters
        const list_endpoint = `${base_url}cluster?select=cluster_name&cluster_name=lt.${samples}`;
        // stub for API call for details  
        const detail_endpoint = `${base_url}cluster?cluster_name=eq.`;
        // headers for Auth and database scheme to use
        const headers = {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0',
            'Accept-Profile': 'inventory_archive'
        };

        // Helper function to call the first endpoint and get the list of clusters
        async function getList() {
            try {
                const response = await fetch(list_endpoint, { headers });
                if (response.ok) {
                    return await response.json();
                } else {
                    throw new Error(`Failed to retrieve the list of items: ${response.status}`);
                }
            } catch (error) {
                throw new Error(`Request failed: ${error.message}`);
            }
        }

        // Helper function to call the second endpoint and get details for a specific cluster
        async function getDetails(itemId) {
            // Build API request for element of cluster list (including dependend data)
            const url = `${detail_endpoint}${itemId}&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))`;
            try {
                const response = await fetch(url, { headers });
                if (response.ok) {
                    return await response.json();
                } else {
                    throw new Error(`Failed to retrieve details for item: ${itemId}`);
                }
            } catch (error) {
                throw new Error(`Request failed: ${error.message}`);
            }
        }

        (async () => {
            try {
                // Note start time (measuring time just to test performance)
                const start_time = new Date();

                // Get the list of clusters (first call)
                const items_list = await getList();
                // Again just to measure times
                const start_time_details = new Date();
                document.getElementById('status').innerHTML +=
                    `<p>Downloadzeit Traktliste: ${((start_time_details - start_time) / 1000).toFixed(2)} sec.</p>`;

                // Initialize an empty array to store the details for the clusters
                const details_list = [];

                // Iterate over the cluster list and collect details
                for (const item of items_list) {
                    const item_id = item.cluster_name;  // Assuming the ID field is 'cluster_name' in your JSON response from first call
                    const item_details = await getDetails(item_id);
                    // Append the details to the list
                    details_list.push(item_details);
                }

                // Again just to measure times
                const start_time_view = new Date();
                document.getElementById('status').innerHTML +=
                    `<p>Downloadzeit Details: ${((start_time_view - start_time_details) / 1000).toFixed(2)} sec.</p>`;

                // Display the details list as JSON with proper indentation and newlines in the result pre
                document.getElementById('result').textContent = JSON.stringify(details_list, null, 2);

                // Print view generation time
                const end_time = new Date();
                document.getElementById('status').innerHTML +=
                    `<p>View generiert in: ${((end_time - start_time_view) / 1000).toFixed(2)} sec.</p>`;
            } catch (error) {
                document.getElementById('status').innerHTML += `<p>Error: ${error.message}</p>`;
            }
        })();
    </script>
<!-- End of the page-->
</body>
</html>
<!-- Have fun! -->

```

```R-vue
# This example in plain R shows conceptually how to:
# - get a list of clusters and 
# - retrieve the json tree of the data belonging to the clusters in the list from different related tables (plots, trees, ...)
# - show the retrieved json tree as expandable view

# Install necessary packages if not already installed
if (!require(httr)) install.packages("httr", dependencies=TRUE)
if (!require(jsonlite)) install.packages("jsonlite", dependencies=TRUE)

# Load necessary packages
library(httr)
library(jsonlite)

# Define the number of items, endpoints and any necessary headers
# Number of clusters to fetch (10 might be enough for the example)
samples <- 10
# API base url
base_url <- "https://ci.thuenen.de/rest/v1/"
# API call for the list of clusters
list_endpoint <- paste0("cluster?select=cluster_name&cluster_name=lt.",samples)
# stub for API call for details
detail_endpoint <- "cluster?cluster_name=eq."
# headers for Auth and database scheme to use
headers = c(
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0',
  'Accept-Profile' = 'inventory_archive'
)

# Here starts the magic...
# Helper function to call the first endpoint and get the list of cluster
get_list <- function() {
  response <- GET(paste0(base_url, list_endpoint), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop("Failed to retrieve the list of items")
  }
}

# Helper function to call the second endpoint and get details for a specific cluster
get_details <- function(item_id) {
  response <- GET(paste0(base_url, detail_endpoint, item_id,"&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))"), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop(paste("Failed to retrieve details for item:", item_id))
  }
}

#MAIN
# Note start time
start_time <- Sys.time()

# Get the list of items
items_list <- get_list()

# measuring times just to test performance
start_time_details <- Sys.time()
print(paste("Downloadzeit Traktliste:",round(start_time_details - start_time, 2),"sec."))

# Initialize an empty list to store the details
details_list <- list()

# Iterate over the clusters list and collect details
for (item in items_list) {
  item_id <- item$cluster_name  # Assuming the ID field is 'id' in your JSON response
  item_details <- get_details(item_id)
  # Append the details to the list
  details_list <- append(details_list, item_details)
}

# measuring times just to test performance
start_time_view <- Sys.time()
print(paste("Downloadzeit Details:", round(start_time_view - start_time_details, 2),"sec."))

# Show the result as expandable view
listviewer::jsonedit(details_list)

# measuring times just to test performance
end_time <- Sys.time()
print(paste("View generiert in:",round(end_time - start_time_view, 2),"sec."))
# Have fun!
```

```R-vue
# This example of a Shiny R app shows conceptually how to:
# - get a list of clusters and 
# - retrieve the json tree of the data belonging to the clusters in the list from different related tables (plots, trees, ...)
# - show the retrieved json tree as expandable view

# Load necessary packages
library(shiny)
library(httr)
library(jsonlite)
library(listviewer)

# Define the number of items, endpoints, and any necessary headers
samples <- 20000
limitpercall <- 1000
startoffset <- 0
base_url <- "https://ci.thuenen.de/rest/v1/"
#list_endpoint <- paste0("cluster?select=cluster_name&order=cluster_name&limit=",limitpercall,"&offset=",actualoffset)
detail_endpoint <- "cluster?cluster_name=eq." #1&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))"
headers = c(
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0',
  'Accept-Profile' = 'inventory_archive'
)
# Initialize an empty list to store the results
all_data <- list()

# Here starts the magic...
# Helper function to construct list endpoint with offset
get_list_endpoint <- function(offset) {
  list_endpoint <- paste0("cluster?select=cluster_name&order=cluster_name&limit=",limitpercall,"&offset=",offset)
  print(list_endpoint)
}

# Helper function to call the first endpoint and get a part of the list of clusters (with offset)
get_list_part <- function(offset) {
  #print(paste0(base_url, get_list_endpoint(offset)))
  response <- GET(paste0(base_url, get_list_endpoint(offset)), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop("Failed to retrieve the list of items")
  }
}

# Helper function to iterate over first endpoint and the list of items filled
get_list <- function() {
  print(startoffset)
  #Loop over the get_list function, increasing the offset each time
  for (offset in seq(startoffset, samples - limitpercall, by = limitpercall)) {
    data <- get_list_part(offset)
    if (!is.null(data)) {
      all_data <- c(all_data, data)
      
      print(paste("Fetched data for offset", offset))
    }
  }
  return(all_data)
}

# Helper function to call the second endpoint and get details for a specific item
get_details <- function(item_id) {
  response <- GET(paste0(base_url, detail_endpoint, item_id, "&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))"), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop(paste("Failed to retrieve details for item:", item_id))
  }
}

# Define UI for application
ui <- fluidPage(
  # Add title panel
  titlePanel("BWI API Data Retrieval"),
  
  # Add sidebar layout
  sidebarLayout(
    # Define sidebar panel
    sidebarPanel(
      # Add action button to trigger the lookup
      actionButton("downloadButton", "Download cluster list (<=20000)"),
      # Add multi-select dropdown for item selection
      uiOutput("itemSelector"),
      # Add action button to trigger the download of selected items
      actionButton("downloadSelectedButton", "Download data for selected clusters"),
      # Add verbatim text output for timing information
      verbatimTextOutput("timingOutput")
    ),
    
    # Define main panel
    mainPanel(
      # Add UIOutput to display downloaded data
      uiOutput("dataDisplay")
    )
  )
)

# Define server logic
server <- function(input, output, session) {
  # Initialize reactiveValues
  RV <- reactiveValues(items_list = NULL, selected_items = NULL)
  
  observeEvent(input$downloadButton, {
    # Note start time
    start_time <- Sys.time()
    
    # Get the list of items
    items_list <- get_list()
    
    start_time_details <- Sys.time()
    print(paste("Downloadzeit Traktliste:", round(start_time_details - start_time, 2), "sec."))
    
    # Store the items list in reactiveValues
    RV$items_list <- items_list
    
    # Update the UI with the dropdown for item selection
    output$itemSelector <- renderUI({
     
        selectInput("itemSelector", "Select clusters", choices = sapply(items_list, function(item) item$cluster_name), multiple = TRUE)
    })
    
    output$timingOutput <- renderText({
      paste("Downloadzeit Traktliste:", round(start_time_details - start_time, 2), "sec.")
    })
  })
  
  observeEvent(input$downloadSelectedButton, {
    # Note start time
    start_time <- Sys.time()
    
    # Get selected items
    selected_items <- input$itemSelector
    
    # Initialize an empty list to store the details
    details_list <- list()
    
    start_time_details <- Sys.time()
    print(paste("Downloadzeit Details:", round(start_time_details - start_time, 2), "sec."))
    
    # Iterate over the selected items and collect details
    for (item_id in selected_items) {
      item_details <- get_details(item_id)
      details_list <- append(details_list, item_details)
    }
    
    start_time_view <- Sys.time()
    print(paste("Downloadzeit Details:", round(start_time_view - start_time_details, 2), "sec."))
    
    output$dataDisplay <- renderUI({
      withProgress(message = 'Viewing data, please wait...', value = 0, {
        for (i in 1:10) {
          incProgress(1/10)
          Sys.sleep(0.01)  # simulate time to view data
        }
        # Show the results as expandable view
        tagList(
          jsonedit(details_list),
          p(paste("View generiert in:", round(Sys.time() - start_time_view, 2), "sec."))
        )
      })
    })
    
    output$timingOutput <- renderText({
      paste("Downloadzeit Details:", round(start_time_view - start_time_details, 2), "sec.")
    })
  })
}

display.mode="showcase"
# Run the application
shinyApp(ui = ui, server = server)
```

```VB-vue
' This example shows conceptually how to:
' - get a list of clusters from the cluster endpoint as json,
' - retrieve the details of this clusters (as json, no dependend tables, but some more columns) in a loop over the cluster list and
' - insert the retrieved json data in an excel sheet,
' Because Excel worksheets are primarily for flat tables, we do not use linked data from other tables here (like we do in the other language examples).

' Explanations:
' - XMLHTTP Object: The script creates an XMLHTTP object to perform HTTP requests.
' - Headers: The required headers, including the API key and Accept-Profile, are set.
' - Fetching Data : The script fetches the list of clusters from the first endpoint and then iterates through each item to fetch detailed data from the endpoint as defined.
' - Parsing JSON : The JsonConverter object is used to parse JSON responses. Make sure you have the JsonConverter module in your VBA project. You can get it from https://github.com/VBA-tools/VBA-JSON.
' - Writing to Excel : The script writes the fetched details to the active worksheet, with each item's details starting on a new row.

' Requirements:
' - JsonConverter Module : You need to import the JsonConverter module into your VBA project. You can download it from here  and import it into your VBA project (File > Import File...).

' References:
' - Ensure you have the "Microsoft XML, v6.0" reference enabled in your VBA editor (Tools > References > Check "Microsoft XML, v6.0").

' Caveat:
' This might not work in all versions of MS Excel (or other MS applications) because of "reasons":
' 1. Some MS applications on some platforms or security rules might not allow to execute code like macros at all.
' 2. If code excecution is generally possible, some warnings about "active content" or "macro security" might appear.
' 3. Tested in Windows Excel 2021 only.

' Let's start the magic ;)...
Sub ImportDataIntoExcel()
    ' First, we need some declarations (some maybe actually superfluous here, too lazy to fix that ;))
    Dim Http As Object
    Dim json As Object
    Dim Url As String
    Dim base_url As String
    Dim list_endpoint As String
    Dim detail_endpoint As String
    Dim ws As Worksheet
    Dim Headers As String
    Dim lastRow As Long
    Dim samples As Integer
    Dim item_id As String
    Dim itemDetails As Object
    Dim Item As Object
    Dim row As Long
    Dim StartTime
    ' Now we have to set some parameters
    ' The number of clusters (100 should be enought for the example here)
    samples = 100
    ' Base URL of the API
    base_url = "https://ci.thuenen.de/rest/v1/"
    ' The endpoint to get the list of clusters (samples defines how many)
    list_endpoint = base_url & "cluster?select=cluster_name&cluster_name=lt." & samples
    ' The endpoint's stub to get details
    detail_endpoint = base_url & "cluster?cluster_name=eq."
    ' We measure times just to get an idea of the performance
    StartTime = Time    ' Return current system time.
    ' Create a new XMLHTTP object
    Set Http = CreateObject("MSXML2.XMLHTTP")
    ' Get the list of clusters
    Http.Open "GET", list_endpoint, False
    Http.SetRequestHeader "Accept-Profile", "inventory_archive"
    Http.SetRequestHeader "apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0"
    Http.Send
    If Http.Status = 200 Then
        ' Use JsonConverter to parse the data response
        Set json = JsonConverter.ParseJson(Http.ResponseText)
        ' Set the worksheet
        Set ws = ThisWorkbook.Sheets(1)
        ' Clear the worksheet
        ws.Cells.Clear
                ' We measure times just to get an idea of the performance
                ListEndTime = Time
                ' Time for fetching cluster list
                ListTime = DateDiff("s", StartTime, ListEndTime)
                ' Write timing info to the worksheet
                ws.Cells(2, 1).Value = "Zeit für Traktliste [sec.]"
                ws.Cells(2, 2).Value = ListTime
                ws.Cells(3, 1).Value = "Hole Details..."
        ' Initialize the row to start writing data to the worksheet
        row = 5
        ' Loop through each cluster and fetch details
        For Each Item In json
            item_id = Item("cluster_name")
            ' Get details for the cluster
            Http.Open "GET", detail_endpoint & item_id & "&select=id,cluster_name,state_responsible,topo_map_sheet,grid_density,cluster_status,cluster_situation", False
            Http.SetRequestHeader "Accept-Profile", "inventory_archive"
            Http.SetRequestHeader "apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0"
            Http.Send
            If Http.Status = 200 Then
                ' Again use the JsonConverter to parse data response
                Set itemDetails = JsonConverter.ParseJson(Http.ResponseText)
                ' Just an index for the columns
                i = 1
                ' write column names to the worksheet (repetition actually superfluous here, too lazy to fix that ;))
                For Each Key In itemDetails(1).Keys
                        ws.Cells(4, i).Value = Key
                        i = i + 1
                    Next Key
                ' Write cluster details to the worksheet
                For Each Item2 In itemDetails
                    i = 1
                    For Each Key In itemDetails(1).Keys
                        ws.Cells(row, i).Value = Item2(Key)
                        i = i + 1
                    Next Key
                Next Item2
            End If
        ' Move to the next row for the next cluster
        row = row + 1
        Next Item
    Else
        MsgBox "Failed to retrieve the list of items: " & Http.Status
    End If
    ' We measure times just to get an idea of the performance
    DetailEndTime = Time
        ' Time for fetching details
        ListTime = DateDiff("s", ListEndTime, DetailEndTime)
        ' Write timing info to the worksheet
        ws.Cells(3, 1).Value = "Zeit für Traktliste [sec.]"
        ws.Cells(3, 2).Value = ListTime
End Sub
' Have fun ;)...
```
:::