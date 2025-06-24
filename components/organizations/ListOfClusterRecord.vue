<script setup>
import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
    import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'; 

    // Register all Community features
    ModuleRegistry.registerModules([AllCommunityModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const page = ref(1);
    const rowsPerPage = ref(100); // Number of rows per page
    const pages = ref(0); // Total number of pages, can be calculated based on total records
    const totalRecords = ref(0); // Total number of records, can be fetched from

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
    function onPageChange(newPage) {
        page.value = newPage;
        _requestCluster(); // Adjust for zero-based index
        // Fetch new data for the selected page if needed
        // Example: _requestCluster(newPage);
        // If you implement server-side pagination, pass newPage to your fetch function
    }
    function _requestCluster() { // Thünen only
        rowData.value = [];
        console.log('Requesting clusters for page:', page.value * rowsPerPage.value, rowsPerPage.value);
        supabase
            .from('records')
            .select('plot_id, plot_name, cluster_name, cluster_id, responsible_troop')
            //.order('cluster_name', { ascending: true })
            //.range(page.value * rowsPerPage.value, (page.value + 1) * rowsPerPage.value - 1)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching clusters:', error);
                } else {
                    console.log('Fetched clusters:', data);
                    //records.value = data;
                    const plotGroups = _groupByClusterId(data);
                    rowData.value = _toRowData(plotGroups);
                }
            });
    }

    async function _countRecords() {
        const { data, count, error } = await supabase
            .from('records')
            .select('*', { count: 'exact', head: true })
        if (error) {
            console.error('Error counting records:', error);
            return 0;
        }
        console.log('Total records:', count);
        return count;
    }

    onMounted(async () => {
        _requestCluster();
        totalRecords.value = await _countRecords();
        pages.value = Math.ceil(totalRecords.value / rowsPerPage.value);
            

    });
</script>

<template>
    <!-- The AG Grid component -->
    <ag-grid-vue
        :pagination="false"
        :rowData="rowData"
        :columnDefs="colDefs"
        style="height: 500px"
    >
    </ag-grid-vue>

    <div class="text-center">
        <v-pagination
            v-model="page"
            :length="pages"
            :total-visible="5"
            rounded="circle"
            @update:modelValue="onPageChange"
        ></v-pagination>
    </div>
</template>