<script setup>
    import { onMounted, ref, getCurrentInstance, inject, nextTick, watch } from 'vue';
    import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
    ModuleRegistry.registerModules([AllCommunityModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';

    import { listOfLookupTables } from '../../.vitepress/theme/powersync-schema';
    

    const darkTheme = themeQuartz.withPart(colorSchemeDark);
    const lightTheme = themeQuartz.withPart(colorSchemeLight);
    const globalIsDark = inject('globalIsDark');
    const currentTheme = globalIsDark?.value ? darkTheme : lightTheme;

    import { useDatabase } from '../../.vitepress/theme/composables/useDatabase'

    const { waitForDb } = useDatabase()
    const lookupTablesValue = ref({});
    let currentGrid = ref(null);
    let selectedRows = ref([]);
    let selectableLose = ref([]);



    const props = defineProps({
        organization_id: {
            type: String,
            required: true
        }
    });

    // Handle PowerSync - only available in browser
    let powersync = null;
    
    // Try to get PowerSync from injection instead of composable during SSR
    //const powerSyncDB = inject('powerSyncDB', null);
    

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    let powerSyncDB = ref(null);

    const page = ref(1);
    const rowsPerPage = ref(100); // Number of rows per page
    const pages = ref(0); // Total number of pages, can be calculated based on total records
    const totalRecords = ref(0); // Total number of records, can be fetched from

    const loading = ref(false);

    const records = ref([]);
    const organizations = ref([]);
    const cluster = ref([]);
    const troops = ref([]);
    const rowData = ref([]);
    const selectedLos = ref(null);

    // Grid Options
    const gridOptions = {
        rowSelection: {
            mode: 'multiRow',
            selectAll: 'filtered',
            enableClickSelection: true,
            
        }
    }

    const colDefs = ref([
        { 
            field: "cluster_id",
            headerName: "Cluster ID",
            filter: true,
            sortable: true,
            //type: "number",
            pinned: 'left',
            hide: true // Hide by default, can be shown if needed
        },
        { 
            field: "cluster_name",
            headerName: "Cluster Name",
            filter: true,
            sortable: true,
            //type: "number",
            pinned: 'left'
        },
        { 
            field: "plot_name",
            headerName: "Plot Name",
            filter: true,
            sortable: true,
            pinned: 'left'
            //type: "number"
        },
        {
            field: "cluster_status",
            headerName: "Cluster Status",
            filter: true,
            sortable: true,
            //type: "string",
        },
        {
            field: "cluster_situation",
            headerName: "Cluster Situation",
            filter: true,
            sortable: true,
            //type: "string",
        },
        
        {
            field: "responsible_administration",
            headerName: "Administration",
            filter: true,
            sortable: true,
            //type: "string",
        },
        {
            field: "responsible_state",
            headerName: "Landesinventurleitung",
            filter: true,
            sortable: true,
            //type: "string",
        },
        {
            field: "responsible_provider",
            headerName: "Dienstleister",
            filter: true,
            sortable: true,
            //type: "string",
        },
        {
            field: "responsible_troop",
            headerName: "Aufnahmetrupp",
            filter: true,
            sortable: true,
            //type: "string",
        },
        {
            field: "is_valid",
            headerName: "Gültigkeit",
            filter: true,
            sortable: true,
            //type: "boolean",
            cellRenderer: (params) => {
                return params.value ? 'Valid' : 'Invalid';
            }
            //type: "string",
        },
        {
            field: "forest_status",
            headerName: "Wald Status",
            filter: true,
            sortable: true,
            type: "string",
        },
        {
            field: "forest_office",
            headerName: "Forstamt",
            filter: true,
            sortable: true,
            type: "string",
        },
        {
            field: "growth_district",
            headerName: "Wuchsbezirk",
            filter: true,
            sortable: true,
            type: "string",
        },
        {
            field: "ffh_forest_type",
            headerName: "FFH Waldlebensraumtyp",
            filter: true,
            sortable: true,
            type: "string"
        },
        {
            field: "accessibility",
            headerName: "Zugänglichkeit",
            filter: true,
            sortable: true,
            type: "string"
        },
        {
            field: "federal_state",
            headerName: "Bundesland",
            filter: true,
            sortable: true,
            //type: "string",
        }
    ]);
    function _renderLookup(tableName, fieldName, previousValue) {
        if (!previousValue) return 'not defined';
        if (previousValue[fieldName]) {
            const lookupTable = lookupTablesValue.value[tableName];
            // Find by "code" field
            const entry = lookupTable?.find(item => item.code === previousValue[fieldName].toString());

            if (entry) {
                // Return the German name or the raw value
                return `${entry.name_de}  (${previousValue[fieldName]})`;
            }else{
                console.warn(`No entry found for ${fieldName} in ${tableName} with code: ${previousValue[fieldName]}`);
            }
            // If no entry found, return the raw value
            return `no lookup value | ${previousValue[fieldName]} (${tableName})`;
        }
        return null;
    }
    function _renderCluster(tableName, cluster_id) {
        if (!cluster_id) return 'not defined';
        const clusterData = cluster.value.find(c => c.id === cluster_id);
        if (clusterData) {
            return `${clusterData[tableName]} (${clusterData.cluster_name})`;
        }
        return `coming soon`;
    }
    function _preRenderRecords(records) {
        if (!records || records.length === 0) {
            console.warn('No records to render');
            return [];
        }
        // return array something like: [{"plot_count": 4, cluster_name: "Cluster A"}, {}, ...]
        console.log('start');
        return records.map(record => {
            const previousValue = JSON.parse(record.previous_properties || '{}');
            return {
                cluster_id: record.cluster_id,
                cluster_name: record.cluster_name,
                plot_name: record.plot_name,
                cluster_status: _renderCluster('cluster_status', record.cluster_id),
                cluster_situation: _renderCluster('cluster_situation', record.cluster_id),
                state_responsible: _renderCluster('state_responsible', record.cluster_id),
                responsible_administration: organizations.value.find(o => o.id == record.responsible_administration)?.name || record.responsible_administration,
                responsible_state: organizations.value.find(o => o.id == record.responsible_state)?.name || record.responsible_state,
                responsible_provider: organizations.value.find(o => o.id == record.responsible_provider)?.name || record.responsible_provider,
                responsible_troop: troops.value.find(o => o.id == record.responsible_troop)?.name || record.responsible_troop,
                is_valid: record.is_valid,
                forest_status: _renderLookup('lookup_forest_status', 'forest_status', previousValue),
                forest_office: _renderLookup('lookup_forest_office', 'forest_office', previousValue),
                growth_district: _renderLookup('lookup_growth_district', 'growth_district', previousValue),
                federal_state: _renderLookup('lookup_state', 'federal_state', previousValue),
                ffh_forest_type: _renderLookup('lookup_ffh_forest_type', 'ffh_forest_type', previousValue),
                accessibility: _renderLookup('lookup_accessibility', 'accessibility', previousValue),
            };
        });
    }
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
    async function _requestAllLookupTables(){
        if (!powerSyncDB) {
            console.warn('PowerSync not available - using fallback data');
            return;
        }
        
        for (const table of listOfLookupTables) {
            powerSyncDB.getAll(`SELECT * from ${table}`)
                .then((data) => {
                    lookupTablesValue.value[table] = data;
                })
                .catch((e) => console.error(`Error loading ${table}:`, e));
        }
    }
    async function _requestcluster() {
        cluster.value = [];
        
        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - using fallback data');
          return;
        }

        await supabase
            .schema('inventory_archive')
            .from('cluster')
            .select('*')
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching clusters:', error);
                } else {
                    cluster.value = data;
                }
            })
            .catch((e) => console.error('An unexpected error occurred while fetching clusters:', e));

        /*cluster.value = await powerSyncDB.getAll('SELECT * from cluster');
        console.log('Fetched clusters:', cluster.value.length);
        if (cluster.value.length > 0) {
            //rowData.value = _groupByClusterId(records.value);
            //rowData.value = _preRenderRecords(records);
        } else {
            console.warn('No cluster found');
        }*/
    }
    async function _requestOrganizations() {
        organizations.value = [];
        
        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - using fallback data');
          return;
        }

        organizations.value = await powerSyncDB.getAll('SELECT * from organizations');
        if (organizations.value.length > 0) {
            //rowData.value = _groupByClusterId(records.value);
            //rowData.value = _preRenderRecords(records);
        } else {
            console.warn('No organizations found');
        }
    }
    async function _requestTroops() {
        troops.value = [];
        
        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - using fallback data');
          return;
        }
        
        troops.value = await powerSyncDB.getAll('SELECT * from troop');
        if (troops.value.length > 0) {
            //rowData.value = _groupByClusterId(records.value);
            //rowData.value = _preRenderRecords(records);
        } else {
            console.warn('No troops found');
        }
    }
    async function _requestPlots() {
        console.log('Requesting plots for organization:', props.organization_id);

        rowData.value = [];

        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - loading will remain true');
          return;
        }

        /*const { data: records, error } = await supabase
            .from('records')
            .select('*')
            .or(`responsible_state.eq.${props.organization_id},responsible_provider.eq.${props.organization_id},responsible_administration.eq.${props.organization_id}`)
            .order('cluster_name', { ascending: true });

        if(error){
            console.log(error)
        }
        
        rowData.value = _preRenderRecords(records);
        console.log(rowData.value);*/
        const records = await powerSyncDB.getAll('SELECT * from records WHERE responsible_state = ? OR responsible_provider = ? OR responsible_administration = ? ORDER BY cluster_name asc', [
            props.organization_id,
            props.organization_id,
            props.organization_id
        ]);

        if (records.length > 0) {
            rowData.value = _preRenderRecords(records);
            console.log('no DATA')
            //records.value = records;
            //rowData.value = _groupByClusterId(records.value);
        } else {
            console.warn('No records found for the organization:', props.organization_id);
        }
        /*    .then((l) => {
                rowData.value = _preRenderRecords(l);
                console.log('Fetched records:', l.length);
                //records.value = l;
                //rowData.value = _groupByClusterId(records.value);
            })
            .catch((e) => console.error(e))
            .finally(() => {
                loading.value = false;
            });*/
    }

    function onSelectionChanged(event) {
        selectedRows.value = event.api.getSelectedRows();
        // Perform actions based on the selected rows
    }

    function assignTo(selected){
        if (!selected || selected === '' || !selected.id) {
            console.warn('No selection made');
            return;
        }
        const losId = selected.id;

        //console.log(`[${selectedRows.value.map(row => row.id).join(',')}]`, losId);
        const clusterNames = selectedRows.value.map(row => row.cluster_name).join(', ');
        const clusterIds = selectedRows.value.map(row => row.cluster_id).join(', ');
        const uniqueClusterIds = [...new Set(selectedRows.value.map(row => row.cluster_id))];
        console.log(losId);

        supabase
            .from('organizations_lose')
            .update({
                cluster_ids: uniqueClusterIds
            })
            .eq('id', losId)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error updating organizations_lose:', error);
                } else {
                    console.log('Successfully assigned rows to los:', data);
                    
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while assigning rows:', e);
            });
        
        /*powerSyncDB.execute('UPDATE organizations_lose SET cluster_ids = ? WHERE id = ?', [
            `[${uniqueClusterIds.join(',')}]`,
            losId
        ])
        .catch((e) => {
            console.error('Error assigning rows:', e);
        });*/
        selectedLos.value = null;

        console.log('Assigning', selectedRows.value.length, 'rows to', selected);

        //selectedLos.value = null;
    }
    function _requestLose(organizationId) {
        if (!organizationId) {
            console.error('Error: organization_id is required.');
            return;
        }

        supabase
            .from('organizations_lose')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching lose:', error);
                } else {
                    selectableLose.value = data.map(lose => ({
                        id: lose.id,
                        name: lose.name,
                        raw: lose
                    }));
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while fetching lose:', e);
            });
    }
    watch(selectedLos, (newValue) => {
        assignTo(newValue);
    });

    function exportSelected() {
        if (selectedRows.value.length === 0) {
            console.warn('No rows selected for export');
            return;
        }
        console.log(currentGrid.value.api);
        currentGrid.value.api.exportDataAsCsv({
            fileName: `selected_records_${new Date().toISOString()}.csv`,
            onlySelected: true,
            skipColumnGroupHeaders: true,
            skipHeaders: false
        });

    }

    onMounted(async () => {
        //console.log('powerSyncDB not ready');
        powerSyncDB = await waitForDb();
        //console.log('powerSyncDB ready');

        loading.value = true;

        await _requestLose(props.organization_id);

        //await _requestcluster();
        console.log('cluster:', cluster.value.length);
        await _requestOrganizations();
        console.log('Organizations:', organizations.value.length);
        await _requestTroops();
        console.log('Troops:', troops.value.length);
        await _requestAllLookupTables();
        console.log('Lookup tables loaded');
        await _requestPlots();
        console.log('Plots:', rowData.value.length);

        loading.value = false;
        //totalRecords.value = await _countRecords();
        //pages.value = Math.ceil(totalRecords.value / rowsPerPage.value);
    });
</script>

<template>
    <!-- The AG Grid component -->
    <v-card>
        <v-toolbar density="comfortable" class="mb-4">
            <v-chip
                class="ma-2"
                color="primary"
                text-color="white"
                variant="tonal"
                rounded="xl"
            >
                {{ selectedRows.length }} selected rows
            </v-chip>
            <v-toolbar-title>Auswahl</v-toolbar-title>
            <template v-slot:append>
                <v-btn
                    class="ma-2"
                    variant="tonal"
                    prepend-icon="mdi-file-download"
                    @click="exportSelected"
                    rounded="xl"
                >
                .csv
                </v-btn>
                Los zuordnen
                <v-select 
                    :items="selectableLose" 
                    item-title="name" 
                    label="Los" 
                    v-model="selectedLos"
                    return-object
                >
                    <template v-slot:selection="{ item }">
                        {{ item.raw.name }}
                    </template>
                </v-select>
            </template>
        </v-toolbar>
        <ag-grid-vue
            ref="currentGrid"
            v-if="!loading"
            @selection-changed="onSelectionChanged"
            :gridOptions="gridOptions"
            :theme="currentTheme"
            :pagination="true"
            :rowData="rowData"
            :columnDefs="colDefs"
            style="height: 700px"
        >
        </ag-grid-vue>
        <div v-else-if="loading" class="text-center ma-11">
            <v-progress-circular
                indeterminate
                color="primary"
                size="40"
                width="3"
            ></v-progress-circular>
            <p>Loading records...</p>
        </div>

    </v-card>
</template>