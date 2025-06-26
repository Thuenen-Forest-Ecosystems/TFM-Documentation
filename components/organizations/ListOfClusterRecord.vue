<script setup>
    import { onMounted, ref, getCurrentInstance, inject, nextTick } from 'vue';
    import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
    ModuleRegistry.registerModules([AllCommunityModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';

    const darkTheme = themeQuartz.withPart(colorSchemeDark);
    const lightTheme = themeQuartz.withPart(colorSchemeLight);
    const globalIsDark = inject('globalIsDark');
    const currentTheme = globalIsDark?.value ? darkTheme : lightTheme;

    // Handle PowerSync - only available in browser
    let powersync = null;
    
    // Try to get PowerSync from injection instead of composable during SSR
    const powerSyncDB = inject('powerSyncDB', null);
    

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const page = ref(1);
    const rowsPerPage = ref(100); // Number of rows per page
    const pages = ref(0); // Total number of pages, can be calculated based on total records
    const totalRecords = ref(0); // Total number of records, can be fetched from

    const loading = ref(false);

    const records = ref([]);
    const organizations = ref([]);
    const troops = ref([]);
    const rowData = ref([]);

    const colDefs = ref([
        { 
            field: "cluster_name",
            headerName: "Cluster Name",
            filter: true,
            sortable: true,
            type: "number",
            pinned: 'left'
        },
        {
            field: "responsible_administration",
            headerName: "Administration",
            filter: true,
            sortable: true,
            type: "string",
        },
        {
            field: "responsible_state",
            headerName: "Landesinventurleitung",
            filter: true,
            sortable: true,
            type: "string",
        },
        {
            field: "responsible_provider",
            headerName: "Dienstleister",
            filter: true,
            sortable: true,
            type: "string",
        },
        {
            field: "responsible_troop",
            headerName: "Aufnahmetrupp",
            filter: true,
            sortable: true,
            type: "string",
        },
        //{ field: "more", headerName: "Details", pinned: 'right', width: 50 },
    ]);
    function _groupByClusterId(records) {
        // return array something like: [{"plot_count": 4, cluster_name: "Cluster A"}, {}, ...]
        const clusterMap = new Map();
        records.forEach(record => {
            const clusterId = record.cluster_id;
            if (!clusterMap.has(clusterId)) {
                clusterMap.set(clusterId, {
                    cluster_name: record.cluster_name,
                    responsible_administration: organizations.value.find(o => o.id == record.responsible_administration)?.name || record.responsible_administration,
                    responsible_state: organizations.value.find(o => o.id == record.responsible_state)?.name || record.responsible_state,
                    responsible_provider: organizations.value.find(o => o.id == record.responsible_provider)?.name || record.responsible_provider,
                    responsible_troop: troops.value.find(o => o.id == record.responsible_troop)?.name || record.responsible_troop
                });
            }else{
                const cluster = clusterMap.get(clusterId);
                if(record.responsible_administration && !cluster.responsible_administration) cluster.responsible_administration = organizations.value.find(o => o.id == record.responsible_administration)?.name || record.responsible_administration;
                if(record.responsible_state && !cluster.responsible_state) cluster.responsible_state = organizations.value.find(o => o.id == record.responsible_state)?.name || record.responsible_state;
                if(record.responsible_provider && !cluster.responsible_provider) cluster.responsible_provider = organizations.value.find(o => o.id == record.responsible_provider)?.name || record.responsible_provider;
                if(record.responsible_troop && !cluster.responsible_troop) cluster.responsible_troop = troops.value.find(o => o.id == record.responsible_troop)?.name || record.responsible_troop;

            }
        });
        return Array.from(clusterMap.values());
    }
    function onPageChange(newPage) {
        page.value = newPage;
    }
    function _requestOrganizations() {
        organizations.value = [];
        
        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - using fallback data');
          return;
        }
        
        powerSyncDB.getAll('SELECT * from organizations')
            .then((l) => {
                organizations.value = l;
                if (organizations.value.length > 0) {
                    rowData.value = _groupByClusterId(records.value);
                } else {
                    console.warn('No organizations found');
                }
            })
            .catch((e) => console.error(e));
    }
    function _requestTroops() {
        troops.value = [];
        
        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - using fallback data');
          return;
        }
        
        powerSyncDB.getAll('SELECT * from troop')
            .then((l) => {
                troops.value = l;
                if (troops.value.length > 0) {
                    rowData.value = _groupByClusterId(records.value);
                } else {
                    console.warn('No troops found');
                }
                
            })
            .catch((e) => console.error(e));
    }
    function _requestCluster() {
        loading.value = true;
        rowData.value = [];

        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - loading will remain true');
          loading.value = false;
          return;
        }

        powerSyncDB.getAll('SELECT * from records')
            .then((l) => {
                records.value = l;
                rowData.value = _groupByClusterId(records.value);
                _requestOrganizations();
                _requestTroops();
            })
            .catch((e) => console.error(e))
            .finally(() => {
                loading.value = false;
            });
        /*
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
            });*/
    }

    async function _countRecords() {
        let count = 0;
        try {
            const { data, error } = await supabase
                .from('records')
                .select('*', { count: 'exact', head: true });
            if (error) {
                console.error('Error counting records:', error);
                return 0;
            }
            console.log('Total records:', count);
        } catch (error) {
            console.error('Error counting records:', error);
        }
        return count;
    }

    onMounted(async () => {
        _requestCluster();
        //totalRecords.value = await _countRecords();
        //pages.value = Math.ceil(totalRecords.value / rowsPerPage.value);
            

    });
</script>

<template>
    <!-- The AG Grid component -->
    <ag-grid-vue
        v-if="!loading"
        :theme="currentTheme"
        :pagination="true"
        :rowData="rowData"
        :columnDefs="colDefs"
        style="height: 600px"
    >
    </ag-grid-vue>
    <div v-else class="text-center ma-11">
        <v-progress-circular
            indeterminate
            color="primary"
            size="30"
            width="4"
        ></v-progress-circular>
        <p>Loading records...</p>
    </div>

    <!--<div class="text-center">
        <v-pagination
            v-model="page"
            :length="pages"
            :total-visible="5"
            rounded="circle"
            @update:modelValue="onPageChange"
        ></v-pagination>
    </div>-->
</template>