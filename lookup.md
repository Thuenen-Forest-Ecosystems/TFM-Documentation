<script setup>
  const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
</script>

# Lookup 

The lookup tables are used to translate codes and identifiers in `inventory_archive` tables into human-readable information.

::: info
Don't forget to include the `Accept-Profile: lookup` header in your request.
:::

## List of lookup endpoints

Endpoint `https://ci.thuenen.de/rest/v1/`

By default, the lookup schema returns all records in the lookup table. You can filter the results by adding query parameters to the URL.

::: code-group

```R-vue
library(httr)

headers = c( 
  'Accept-Profile' = 'lookup',
  'apikey' = '{{ apikey }}'
)

res <- VERB("GET", url = "https://ci.thuenen.de/rest/v1/", add_headers(headers))

cat(content(res, 'text'))

```

```Python-vue
import requests

url = "https://ci.thuenen.de/rest/v1/"

payload = {}
headers = {
  'Accept-Profile': 'lookup',
  'apikey': '{{ apikey }}'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)
```

```JavaScript-vue
var https = require('follow-redirects').https;
var fs = require('fs');

var options = {
  'method': 'GET',
  'hostname': 'ci.thuenen.de',
  'path': '/rest/v1/',
  'headers': {
    'Accept-Profile': 'lookup',
    'apikey': '{{ apikey }}'
  },
  'maxRedirects': 20
};

var req = https.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function (chunk) {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });

  res.on("error", function (error) {
    console.error(error);
  });
});

req.end();
```

:::


## Single lookup endpoint

Endpoint `https://ci.thuenen.de/rest/v1/[TABLENAME]`

To retrieve a complete lookup table, you can add the **tablename** to the URL. You can find the list of available lookup tables in the [List of lookup endpoints
](#list-of-lookup-endpoints) section.

::: code-group

```R-vue
library(httr)

headers = c(
  'apikey' = '{{ apikey }}',
  'Accept-Profile' = 'lookup'
)

res <- VERB("GET", url = "https://ci.thuenen.de/rest/v1/lookup_tree_species", add_headers(headers))

cat(content(res, 'text'))

# JSON to data.frame
install.packages("jsonlite");
library(jsonlite)

df <- as.data.frame(jsonlite::fromJSON(content(res, 'text')))
```

```Python-vue
import requests

url = "https://ci.thuenen.de/rest/v1/lookup_tree_species"

payload = {}
headers = {
  'apikey': '{{ apikey }}',
  'Accept-Profile': 'lookup'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)
```

```JavaScript-vue
var myHeaders = new Headers();
myHeaders.append("apikey", "{{ apikey }}");
myHeaders.append("Accept-Profile", "lookup");

var requestOptions = {
  method: 'GET',
  headers: myHeaders,
  redirect: 'follow'
};

fetch("https://ci.thuenen.de/rest/v1/lookup_tree_species", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));
```

```cURL-vue
curl --location 'https://ci.thuenen.de/rest/v1/lookup_tree_species' \
--header 'apikey: {{ apikey }}' \
--header 'Accept-Profile: lookup'
```

:::
*Example request getting `tree species`.*


## Filtering lookup tables

Endpoint `https://ci.thuenen.de/rest/v1/[TABLENAME]?[COLUMN]=[FILTER]`

You can filter the results of a lookup table by adding query parameters to the URL.

Find the complete [list of available query parameters](https://docs.postgrest.org/en/v12/references/api/tables_views.html).

::: code-group

```R-vue
library(httr)

headers = c(
  'apikey' = '{{ apikey }}',
  'Accept-Profile' = 'lookup'
)

res <- VERB("GET", url = "https://ci.thuenen.de/rest/v1/lookup_tree_species?code=eq.100", add_headers(headers))

cat(content(res, 'text'))
```

```Python-vue
import requests

url = "https://ci.thuenen.de/rest/v1/lookup_tree_species?code=eq.100"

payload = {}
headers = {
  'apikey': '{{ apikey }}',
  'Accept-Profile': 'lookup'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)

```

```JavaScript-vue
var myHeaders = new Headers();
myHeaders.append("apikey", "{{ apikey }}");
myHeaders.append("Accept-Profile", "lookup");

var requestOptions = {
  method: 'GET',
  headers: myHeaders,
  redirect: 'follow'
};

fetch("https://ci.thuenen.de/rest/v1/lookup_tree_species?code=eq.100", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));
```

```cURL-vue
curl --location 'https://ci.thuenen.de/rest/v1/lookup_tree_species?code=eq.100' \
--header 'apikey: {{ apikey }}' \
--header 'Accept-Profile: lookup'
```

:::
*Example request getting beech by code `100`.*
