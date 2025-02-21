
<script setup>
  let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
  //apikey = "[apikey]";
</script>

# General

This API provides access to the Thünen Institute's data. The API is based on the [PostgREST](https://docs.postgrest.org/en/v12/) specification and is designed to be RESTful. The API is versioned and the current version is `v1`.

## Endpoint

The base URL for the API is `https://ci.thuenen.de/rest/v1/`. All requests should start with this URL.

## Authentication

The API requires an API key to be passed in the header of each request. The API key is a JSON Web Token (JWT) and is used to authenticate the user. The API key is passed in the `apikey` header.

```cURL-vue

curl -X GET "https://ci.thuenen.de/rest/v1/"  -H "apikey: {{ apikey }}"

```

## Schema Selection

The second header required is the `Accept-Profile` header. This header is used to specify the schema that the response should be formatted in. The available schemas are `lookup` or `inventory_archive`.

```cURL-vue
curl -X GET "https://ci.thuenen.de/rest/v1/"  -H "Accept-Profile: lookup"  -H "apikey: {{ apikey }}"
```

## CSV / JSON Output (optional)

The API can return data in either CSV or JSON format. The format is specified in the `Accept` header.

::: code-group

```cURL-vue [JSON (default)]
curl -X GET "https://ci.thuenen.de/rest/v1/"  -H "Accept: application/json"  -H "Accept-Profile: lookup"  -H "apikey: {{ apikey }}"
```

```cURL-vue [CSV]
curl -X GET "https://ci.thuenen.de/rest/v1/"   -H "Accept: text/csv"  -H "Accept-Profile: lookup"  -H "apikey: {{ apikey }}"
```

:::

## Count & Pagination

To get the exact count of the number of records in the response, you can add the `Prefer: count=exact` header to the request.

To paginate the response, you can add the `limit` and `offset` query parameters to the request. The `limit` parameter specifies the number of records to return, and the `offset` parameter specifies the number of records to skip.



**Example:** Requesting the count of records in the `Plot` table:

```cURL-vue [count]
curl -X GET "https://ci.thuenen.de/rest/v1/plot?limit=20&offset=25" -I -H "Accept-Profile: inventory_archive" -H "apikey: {{ apikey }}" -H "Prefer: count=exact"
```

The `Content-Range` header contains the range (25-44) of records returned and the total number (260912) of records in the response.

```JSON [Return]
Content-Range: 25-44/260912
```

Read more about the [`Pagination and Count`](https://docs.postgrest.org/en/v12/references/api/pagination_count.html).
