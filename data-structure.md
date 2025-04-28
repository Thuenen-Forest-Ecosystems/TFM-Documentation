<script setup>
  import DashboardButton from './components/RestDocumentation.vue'
</script>

# Data Structure 

The data can be found in the `inventory_archive` schema. The inventory_archive schema contains the following tables:
::: code-group
```txt [Sructure]
- inventory_archive
    - cluster 
        - plot
            - edges
            - deadwood
            - regeneration
            - structure_lt4m
            - subplot_position
            - tree
```
```txt-vue [Request Schema]
curl -X GET "https://ci.thuenen.de/rest/v1/"  -H "Accept-Profile: lookup"  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU"
```
:::

<DashboardButton contentProfile="inventory_archive" />