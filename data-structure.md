<script setup>
  import RestDocumentation from './components/RestDocumentation.vue'
  import { getCurrentInstance } from 'vue'
  const apikey = getCurrentInstance().appContext.config.globalProperties.$apikey;
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
curl -X GET "https://ci.thuenen.de/rest/v1/"  -H "Accept-Profile: lookup"  -H "apikey: {{apikey}}"
```
:::

<RestDocumentation contentProfile="inventory_archive" />