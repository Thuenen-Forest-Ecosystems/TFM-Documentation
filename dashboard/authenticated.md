<script setup>
    import { ref, onMounted, getCurrentInstance } from 'vue'
    import { createClient } from '@supabase/supabase-js'

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

</script>

# For Authenticated Users

This section is for authenticated users. You need to login to get an access token. The access token is required to access the data.

## Login

Sign in with email and password to get access token.

::: code-group

```R-vue
library(httr)

# Credentials
email <- "something@email.de"
password <- "fdo8zsdb3rfs"

headers = c(
  'Content-Type' = 'text/plain',
  'apikey' = '{{apikey}}'
)

body = paste0("{\n    \"email\": \"", email, "\",\n    \"password\": \"", password, "\"\n}")

res <- VERB("POST", url = "{{url}}/auth/v1/token?grant_type=password", body = body, add_headers(headers))

# get access token from json
access_token <- content(res, "parsed")$access_token

# output access token
print(access_token)
```

:::

## Request data

Request data from table derived_deadwood with access token and apikey.

::: code-group

```R-vue
# Request Data from table TEMPLATE
headers = c(
'apikey' = '{{apikey}}',
'Authorization' = paste("Bearer", access_token, sep = " "),
'Accept-Profile' = 'derived',
'Content-Type' = 'text/csv'
)

res <- VERB("GET", url = "{{url}}/rest/v1/derived_deadwood?select=*", add_headers(headers))

# output data from table TEMPLATE
print(content(res, "text"))
```

:::

## Send data

Send data to table derived_deadwood with access token and apikey.

::: code-group

```R-vue
# create body
body <- '[{"data": "ADDED 1"}, {"data": "ADDED 2"}]'


headers = c(
'apikey' = '{{apikey}}',
'Authorization' = paste("Bearer", access_token, sep = " "),
'Content-Profile' = 'derived',
'Content-Type' = 'application/json'
)

res <- VERB("POST", url = "{{url}}/rest/v1/derived_deadwood", body=body, add_headers(headers))

# output json response
print(content(res, "parsed"))
```
:::