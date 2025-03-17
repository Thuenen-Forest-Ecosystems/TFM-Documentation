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
```cUrl-vue [Request Schema]
curl -X GET "https://ci.thuenen.de/rest/v1/"  -H "Accept-Profile: lookup"  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0"
```
:::

<DashboardButton contentProfile="inventory_archive" />