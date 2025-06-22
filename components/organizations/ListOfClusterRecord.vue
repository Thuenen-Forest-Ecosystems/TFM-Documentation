<script setup>
import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
    import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'; 

    // Register all Community features
    ModuleRegistry.registerModules([AllCommunityModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const records = ref([]);
    const rowData = ref([]);
    const colDefs = ref([
        { 
            field: "cluster_name",
            headerName: "Cluster Name",
            filter: 'agSetColumnFilter',
            sortable: true,
            type: "number",
            pinned: 'left'
        },
        { 
            field: "plot_count",
            headerName: "Plot Count",
            filter: 'agNumberColumnFilter',
            sortable: true,
            type: "number"
        },
        {
            field: "responsible_troop",
            headerName: "Responsible Troop",
            filter: true,
            sortable: true,
            type: "string",
            cellRenderer: _troopSelection
        },
        //{ field: "more", headerName: "Details", pinned: 'right', width: 50 },
    ]);
    function _troopSelection(params){
        if(!params.data.responsible_troop) return '<small>-</small>';
        return params.data.responsible_troop;
    }
    function _groupByClusterId(records) {
        // return array something like: [{"plot_count": 4, cluster_name: "Cluster A"}, {}, ...]
        const clusterMap = new Map();
        records.forEach(record => {
            const clusterId = record.cluster_id;
            if (!clusterMap.has(clusterId)) {
                clusterMap.set(clusterId, {
                    cluster_name: record.cluster_name,
                    plot_count: 0,
                    responsible_troop: record.responsible_troop
                });
            }
            clusterMap.get(clusterId).plot_count++;
        });
        return Array.from(clusterMap.values());
    }
    function _toRowData(records) {
        return records.map(record => ({
            cluster_name: record.cluster_name,
            plot_count: record.plot_count,
            responsible_troop: record.responsible_troop
        }));
    }
    function _requestCluster() { // Thünen only

        supabase
            .from('records')
            .select('plot_id, plot_name, cluster_name, cluster_id, responsible_troop')
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching clusters:', error);
                } else {
                    //records.value = data;
                    const plotGroups = _groupByClusterId(data);
                    rowData.value = _toRowData(plotGroups);
                }
            });
    }

    onMounted(() => {
        _requestCluster();
    });
</script>

<template>
    <!-- The AG Grid component -->
    <ag-grid-vue
        :pagination="true"
        :rowData="rowData"
        :columnDefs="colDefs"
        style="height: 500px"
    >
    </ag-grid-vue>
</template>