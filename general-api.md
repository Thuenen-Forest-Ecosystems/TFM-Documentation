
<script setup>
  const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
</script>

# General

This API provides access to the Thünen Institute's data. The API is based on the [PostgREST](https://docs.postgrest.org/en/v12/) specification and is designed to be RESTful. The API is versioned and the current version is `v1`.

## Endpoint

The base URL for the API is `https://ci.thuenen.de/rest/v1/`. All requests should start with this URL.

## Authentication

The API requires an API key to be passed in the header of each request. The API key is a JSON Web Token (JWT) and is used to authenticate the user. The API key is passed in the `apikey` header.

```cURL

curl -X GET "https://ci.thuenen.de/rest/v1/" -H "apikey: {{ apikey }}"

```

## Schema Selection

The second header required is the `Accept-Profile` header. This header is used to specify the schema that the response should be formatted in. The available schemas are `lookup` or `inventory_archive`.

```cURL
curl -X GET "https://ci.thuenen.de/rest/v1/" -H "Accept-Profile: lookup" -H "apikey: {{ apikey }}"
```

## CSV / JSON Output (optional)

The API can return data in either CSV or JSON format. The format is specified in the `Accept` header.

::: code-group

```cURL [JSON (default)]
curl -X GET "https://ci.thuenen.de/rest/v1/" -H "Accept: application/json" -H "Accept-Profile: lookup" -H "apikey
: {{ apikey }}"
```

```cURL [CSV]
curl -X GET "https://ci.thuenen.de/rest/v1/" -H "Accept: text/csv" -H "Accept-Profile: lookup" -H "apikey
: {{ apikey }}"
```

:::
