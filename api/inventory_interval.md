<script setup>
  import { getCurrentInstance } from 'vue'
  const apikey = getCurrentInstance().appContext.config.globalProperties.$apikey;
  const url = getCurrentInstance().appContext.config.globalProperties.$url;
</script>

# Filter by Interval

Data is collected in regular intervals. Currently `bwi2012`, `ci2017` and `bwi2022` are available. The interval data is stored in the `interval_name` columne of the `inventory_archive.plot` table. The `interval_name` is used to identify the data of a specific interval.

- `bwi2012`: Kohlenstoffinventur in 2012
- `ci2017`: Kohlenstoffinventur in 2017
- `bwi2022`: Bundeswaldinventur in 2022

## Read by Interval
To read data from a specific interval, you can use the `interval_name` column in the `inventory_archive.plot` table. The following example shows how to query data for the `ci2017` interval.

::: info
Every request lower or equal `plot` table should include the filter `interval_name=eq.XXX` to ensure that only data from the selected interval is returned.
:::

```txt-vue
curl -X GET "{{ url }}/rest/v1/plot?interval_name=eq.ci2017" -H "Accept-Profile: inventory_archive" -H "apikey: {{ apikey }}"
```

This will return all plots that are part of the `ci2017` interval.

More information about [Horizontal Filtering](https://docs.postgrest.org/en/v12/references/api/tables_views.html#horizontal-filtering).

## Comparing Intervals
To compare cluster data from different intervals, you can use the `interval_name` column in the `inventory_archive.cluster` table.

The following example shows how to query a specific cluster (`cluster_name=eq.5207`) for the `bwi2012` and `ci2017` intervals.

```txt-vue
curl -X GET "{{ url }}/rest/v1/cluster?cluster_name=eq.5207&select=*,plot(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),structure_gt4m(*),edges(*),plot_landmark(*),position(*),subplots_relative_position(*))&plot.interval_name=in.(bwi2012,ci2017)" -H "Accept-Profile: inventory_archive" -H "apikey: {{ apikey }}"
```
This will return the cluster data for the specified cluster, including 8 plots. 4 plots are from the `bwi2012` interval and 4 plots are from the `ci2017` interval. The data is structured in a way that allows you to compare the data from both intervals.
