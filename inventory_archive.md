<script setup>
  import { getCurrentInstance } from 'vue'
  const apikey = getCurrentInstance().appContext.config.globalProperties.$apikey;
  const url = getCurrentInstance().appContext.config.globalProperties.$url;
</script>

# Read by Position

Inventory Data is a collection of geospatial inventory data. To Read data based on the Position 

## Filter by Federal State

The clusters can be queried by Federal State. The Federal State is specified by the `federal_state` value.

In the example below, the column `code` from the table `lookup_state` is queried and filtered by the column `name_de`.

::: code-group

```txt-vue{2} [REQUEST]
curl -X GET "{{ url }}/rest/v1/lookup_state"  
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

With knowledge of the Federal State code, the clusters can be filtered by Federal State using the table `cluster` and the column `states_affected`.

::: code-group

```txt-vue
curl --globoff GET "{{ url }}/rest/v1/cluster?states_affected=cd.{6}"  -H "Accept-Profile: inventory_archive"  -H "apikey: {{ apikey }}"
```
:::

The response will be a list of clusters that are located in the Federal State of Hessen.

## Filter by INSPIRE Grid Cells

The clusters can be queried using an overlaying 1km x 1km grid. Querying a grid cell by its `inspire_grid_cell` value will return all clusters that are located within the grid cell.

In the example below, the grid cell `eq.1kmN2688E4341` is queried. This grid cell is located in the south of Germany.

```txt-vue
curl -X GET "{{ url }}/rest/v1/cluster?inspire_grid_cell=eq.1kmN2688E4341"  -H "Accept-Profile: inventory_archive"  -H "apikey: {{ apikey }}"
```

More information and download (as csv & GeoPackage) of the grid cells can be found at the [bkg](https://gdz.bkg.bund.de/index.php/default/geographische-gitter-fur-deutschland-in-lambert-projektion-geogitter-inspire.html).
