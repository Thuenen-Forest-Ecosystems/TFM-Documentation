<script setup>
    import { onMounted, ref, getCurrentInstance, inject, nextTick, watch, defineEmits} from 'vue';
    import { AllCommunityModule, ModuleRegistry, TooltipModule } from 'ag-grid-community';
    ModuleRegistry.registerModules([AllCommunityModule, TooltipModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
    import ActionCellRenderer from './ActionCellRenderer.vue';
    import DialogResponsible from './DialogResponsible.vue';
    import GeoJsonMap from '../map/GeoJsonMap.vue';

    //import { listOfLookupTables } from '../../.vitepress/theme/powersync-schema';
const listOfLookupTables = [
    //'lookup_browsing',
    'lookup_cluster_situation',
    'lookup_cluster_status',
    //'lookup_dead_wood_type',
    //'lookup_decomposition',
    //'lookup_edge_status',
    //'lookup_edge_type',
    //'lookup_elevation_level',
    //'lookup_exploration_instruction',
    'lookup_ffh_forest_type',
    //'lookup_forest_community',
    'lookup_forest_office',
    'lookup_forest_status',
    //'lookup_gnss_quality',
    'lookup_grid_density',
    'lookup_growth_district',
    //'lookup_land_use',
    //'lookup_management_type',
    //'lookup_marker_profile',
    //'lookup_marker_status',
    //'lookup_property_size_class',
    'lookup_property_type',
    //'lookup_pruning',
    //'lookup_sampling_stratum',
    //'lookup_stand_development_phase',
    //'lookup_stand_layer',
    //'lookup_stand_structure',
    'lookup_state',
    //'lookup_stem_breakage',
    //'lookup_stem_form',
    'lookup_terrain',
    //'lookup_terrain_form',
    //'lookup_tree_size_class',
    //'lookup_tree_species_group',
    //'lookup_tree_status',
    //'lookup_trees_less_4meter_layer',
    //'lookup_trees_less_4meter_mirrored',
    //'lookup_trees_less_4meter_origin',
    //'lookup_natur_schutzgebiet',
    //'lookup_vogel_schutzgebiet',
    //'lookup_natur_park',
    //'lookup_national_park',
    'lookup_ffh',
    //'lookup_biosphaere',
    //'lookup_biogeographische_region',
    //'lookup_basal_area_factor',
    //'lookup_biotope',
    //'lookup_harvest_restriction',
    //'lookup_harvest_condition',
    //'lookup_harvest_type',
    //'lookup_harvest_reason',
    //'lookup_harvest_method',
    'lookup_accessibility'
];

    const darkTheme = themeQuartz.withPart(colorSchemeDark);
    const lightTheme = themeQuartz.withPart(colorSchemeLight);
    const globalIsDark = inject('globalIsDark');
    const currentTheme = globalIsDark?.value ? darkTheme : lightTheme;

    import { useDatabase } from '../../.vitepress/theme/composables/useDatabase'

    //const { waitForDb } = useDatabase()
    const lookupTablesValue = ref({});
    let currentGrid = ref(null);
    let selectedRows = ref([]);
    let selectableLose = ref([]);
    const assigning = ref(false);
    const mapDialog = ref(false);

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    const responsibleDialog = ref(false);

    const emit = defineEmits(['confirm']);


    const props = defineProps({
        organization_id: {
            type: String,
            required: true
        },
        organization_type: {
            type: String,
            default: null
        },
        los: {
            type: Object,
            default: null
        },
        cluster: {
            type: Array,
            default: () => []
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
    const dbData = ref([]);
    const geojsonFeatureCollection = ref({
        type: "FeatureCollection",
        features: []
    });
    const selectedLos = ref(null);

    // Grid Options
    const gridOptions = {
        //rowModelType: 'infinite', // Enable infinite scrolling
        //cacheBlockSize: 100, // Number of rows per block
        //maxBlocksInCache: 10, // Maximum number of blocks to cache
        suppressMovableColumns: true,
        tooltipShowDelay: 500,
        rowSelection: {
            mode: 'multiRow',
            selectAll: 'filtered',
            enableClickSelection: true
        },
        components: {
            actionCellRenderer: ActionCellRenderer // Register the custom cell renderer
        },
        onCellValueChanged: async (event) => {
            const columnId = event.colDef.field;
            const data = event.data;

            console.log(data)

            if(event.newValue === event.oldValue || !data.plot_id) return;

            

            const newValue = event.newValue;
            const newValueId = troops.value.find(troop => troop.name === newValue)?.id;
            // confirm()
            if(confirm(`Change Aufnahmetrupp to ${newValue}?`)) {
                saveTroopResponsible('responsible_troop', newValueId || null, data.plot_id);
            }else{
                // set to old without triggering onCellValueChanged
                console.log('revert', dbData.value)
                rowData.value = JSON.parse(JSON.stringify(dbData.value));
                refreshCells();
            }

        }
    }
    async function saveTroopResponsible(column, value, id){
        const {data, error} = await supabase
            .from('records')
            .update({ [column]: value })
            .eq('plot_id', id);

        if (error) {
            snackbar.value = true;
            snackbarText.value = 'Fehler beim Aktualisieren';
            snackbarColor.value = 'error';
        } else {
            snackbar.value = true;
            snackbarText.value = 'Ecke wurde aktualisiert';
            snackbarColor.value = 'success';
        }

    }
    const colDefs = ref([]);
    function setColDefs(){
        colDefs.value = [
            {
                cellRenderer: 'actionCellRenderer', // Custom cell renderer
                pinned: 'left',
                width: 50
            },
            { 
                field: "plot_id",
                headerName: "Plot Id",
                filter: true,
                sortable: true,
                //type: "number",
                pinned: 'left',
                hide: true // Hide by default, can be shown if needed
            },
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
                headerName: "Trakt",
                filter: true,
                sortable: true,
                //type: "number",
                pinned: 'left',
                headerTooltip: "inventory_archive.cluster.cluster_name",
                width: 95,
            },
            {
                field: "responsible_troop",
                headerName: "Aufnahmetrupp",
                filter: true,
                sortable: true,
                pinned: 'right',
                tooltipField: "responsible_troop",
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: [...troops.value.map(troop => troop.name), null],
                }
                //type: "string",
            },
            {
                field: "responsible_state",
                headerName: "Landesinventurleitung",
                filter: true,
                sortable: true,
                tooltipField: "responsible_state",
                //type: "string",
            },
            {
                field: "responsible_provider",
                headerName: "Dienstleister",
                filter: true,
                sortable: true,
                tooltipField: "responsible_provider",
                //type: "string",
            },
            { 
                field: "plot_name",
                headerName: "Ecke",
                filter: true,
                sortable: true,
                pinned: 'left',
                headerTooltip: "inventory_archive.plot.plot_name",
                width: 90,
                //type: "number"
            },

            {
                field: "cluster_status",
                headerName: "Cluster Status",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.cluster_status",
                tooltipField: "cluster_status",
                //type: "string",
            },
            {
                field: "cluster_situation",
                headerName: "Cluster Situation",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.cluster_situation",
                tooltipField: "cluster_situation",
                //type: "string",
            },
            {
                field: "state_responsible",
                headerName: "state_responsible",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.state_responsible",
                tooltipField: "state_responsible",
                //type: "string",
            },
            {
                field: "forest_status_bwi2022",
                headerName: "Wald Status (BWI 2022)",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.forest_status",
                tooltipField: "forest_status_bwi2022"
            },
            {
                field: "forest_status_ci2017",
                headerName: "Wald Status (CI 2017)",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.forest_status",
                tooltipField: "forest_status_ci2017"
            },
            {
                field: "forest_status_ci2012",
                headerName: "Wald Status (CI 2012)",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.forest_status",
                tooltipField: "forest_status_ci2012"
            },
            {
                field: "forest_office",
                headerName: "Forstamt",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.forest_status",
                tooltipField: "forest_office"
            },
            {
                field: "growth_district",
                headerName: "Wuchsbezirk",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.growth_district",
                tooltipField: "growth_district"
            },
            {
                field: "ffh_forest_type",
                headerName: "FFH Waldlebensraumtyp",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.ffh_forest_type",
                tooltipField: "ffh_forest_type"
            },
            {
                field: "accessibility",
                headerName: "Begehbarkeit 2022", // https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/issues/47#event-19265086339
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.accessibility",
                tooltipField: "accessibility"
            },
            {
                field: "federal_state",
                headerName: "Bundesland",
                filter: true,
                sortable: true,
                //type: "string",
                headerTooltip: "inventory_archive.plot.federal_state",
                tooltipField: "federal_state"
            },
            {
                field: "property_type",
                headerName: "Eigentumsart",
                filter: true,
                sortable: true,
                //type: "string",
                headerTooltip: "inventory_archive.plot.property_type",
                tooltipField: "property_type"
            },
            {
                field: "grid_density",
                headerName: "Rasterdichte",
                filter: true,
                tooltipField: "grid_density",
                sortable: true,
                //type: "string",
                headerTooltip: "inventory_archive.cluster.grid_density",
            },
            {
                field: "states_affected",
                headerName: "Affected States",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.states_affected"
            }
        ]
    }
    function _renderLookup(tableName, fieldName, code) {
        if (!code) return null;

        if (code) {
            const lookupTable = lookupTablesValue.value[tableName];
            // Find by "code" field
            const entry = lookupTable?.find(item => item.code === code.toString());

            if (entry) {
                // Return the German name or the raw value
                return `${entry.name_de}  (${code})`;
            }
            // If no entry found, return the raw value
            return `no lookup value | ${code} (${tableName})`;
        }
        return null;
    }
    function _renderCluster(tableName, cluster_id, lookupTableName = null) {
        if (!cluster_id) return 'not defined';
        const clusterData = cluster.value.find(c => c.id === cluster_id);
        if (clusterData) {
            if(lookupTableName) {
                return `${ _renderLookup(lookupTableName, tableName, clusterData[tableName]) }`;
            }else{
                return `${ clusterData[tableName] }`;
            }
        }
        return `coming soon`;
    }
    function _preRenderRecords(records) {

        if (!records || records.length === 0) {
            console.warn('No records to render');
            return [];
        }

        // Pre-compute all lookup maps once
        const clusterMap = new Map(cluster.value.map(c => [c.id, c]));

        // Pre-compute lookup table maps for faster access
        const lookupMaps = {};
        Object.keys(lookupTablesValue.value).forEach(tableName => {
            lookupMaps[tableName] = new Map(
                lookupTablesValue.value[tableName]?.map(item => [item.code?.toString(), item]) || []
            );
        });


        const processedRecords = records.map(record => {
            const clusterData = clusterMap.get(record.cluster_id);
            const organizationsIDMap = new Map(organizations.value.map(org => [org.id, org.name]));

            return {
                plot_id: record.plot_id,
                cluster_id: record.cluster_id,
                cluster_name: record.cluster_name,
                plot_name: record.plot_name,

                responsible_state: organizationsIDMap.get(record.responsible_state) || record.responsible_state,
                responsible_provider: organizationsIDMap.get(record.responsible_provider) || record.responsible_provider,
                responsible_troop: troops.value.find(troop => troop.id === record.responsible_troop)?.name || record.responsible_troop,

                administration_los: record.administration_los,
                state_los: record.state_los,
                provider_los: record.provider_los,
                
                cluster_status: _renderLookupOptimized(lookupMaps, 'lookup_cluster_status', clusterData?.['cluster_status']),
                cluster_situation: _renderClusterOptimized(clusterData, 'cluster_situation', lookupMaps, 'lookup_cluster_situation'),
                
                state_responsible: _renderClusterOptimized(clusterData, 'state_responsible', lookupMaps, 'lookup_state'),
                states_affected: clusterData?.['states_affected'] || 'not defined',
                
                
                is_valid: record.is_valid,
                
                forest_status_bwi2022: _renderLookupOptimized(lookupMaps, 'lookup_forest_status', record.forest_status_bwi2022),
                forest_status_ci2017: _renderLookupOptimized(lookupMaps, 'lookup_forest_status', record.forest_status_ci2017),
                forest_status_ci2012: _renderLookupOptimized(lookupMaps, 'lookup_forest_status', record.forest_status_ci2012),
                
                forest_office: _renderLookupOptimized(lookupMaps, 'lookup_forest_office', record.forest_office),
                growth_district: _renderLookupOptimized(lookupMaps, 'lookup_growth_district', record.growth_district),
                federal_state: _renderLookupOptimized(lookupMaps, 'lookup_state', record.federal_state),
                ffh_forest_type: _renderLookupOptimized(lookupMaps, 'lookup_ffh_forest_type', record.ffh_forest_type_field),
                accessibility: _renderLookupOptimized(lookupMaps, 'lookup_accessibility', record.accessibility),
                property_type: _renderLookupOptimized(lookupMaps, 'lookup_property_type', record.property_type),
                grid_density: _renderClusterOptimized(clusterData, 'grid_density', lookupMaps, 'lookup_grid_density')
            };
        });

        // Enhanced debugging for nordrhein count
        const nordrheinRows = processedRecords.filter(row => {
            const v = row.state_responsible;
            return v && v.toString().toLowerCase().startsWith('nordrhein');
        });
        
        console.log(`Nordrhein count: ${nordrheinRows.length}`);
        console.log('Sample nordrhein entries:', nordrheinRows.slice(0, 3));

        return processedRecords;
    }
   
    async function _requestAllLookupTables(){
        // Lade alle Lookup-Tabellen parallel und warte auf alle Ergebnisse,
        // damit lookupTablesValue vollständig ist bevor _preRenderRecords ausgeführt wird.
        const promises = listOfLookupTables.map(async (table) => {
            try {
                const { data, error } = await supabase
                    .schema('lookup')
                    .from(table)
                    .select('*');

                if (error) {
                    console.error(`Error loading ${table}:`, error);
                    return { table, data: [] };
                }
                return { table, data: data || [] };
            } catch (e) {
                console.error(`Error loading ${table}:`, e);
                return { table, data: [] };
            }
        });

        const results = await Promise.all(promises);
        results.forEach(({ table, data }) => {
            lookupTablesValue.value[table] = data;
        });
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
    async function _getOrganizations() {
        organizations.value = [];
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name');
            if (error) {
                console.error('Error fetching organizations:', error);
                return [];
            }
            return data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching organizations:', e);
            return [];
        }
    }
    async function _getTroops(organizationId) {
        try {
            const { data, error } = await supabase
                .from('troop')
                .select('id, name')
                .eq('organization_id', organizationId);
            if (error) {
                console.error('Error fetching troops:', error);
                return [];
            }
            return data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching troops:', e);
            return [];
        }
    }
    async function fetchAllDataPaginated(tableName, organizationId, companyType, filterRow) {
        let allData = [];
        let currentPage = 0;
        const pageSize = 10000; // Choose an appropriate page size
        console.log('companyType', companyType, organizationId);
        while (true) {
            const start = currentPage * pageSize;
            const end = start + pageSize - 1;

            const { data, error } = await supabase
                .from(tableName)
                .select(`
                    cluster_id,
                    cluster_name,
                    plot_name,
                    plot_id,
                    responsible_state,
                    responsible_provider,
                    responsible_administration,
                    responsible_troop,
                    is_valid,
                    administration_los,
                    state_los,
                    provider_los,
                    troop_los,
                    federal_state,
                    growth_district,
                    forest_status_bwi2022,
                    forest_status_ci2017,
                    forest_status_ci2012,
                    accessibility,
                    forest_office,
                    property_type,
                    ffh_forest_type_field,
                    previous_properties->plot_coordinates
                `)
                .eq(companyType, organizationId)
                //.is(filterRow, null) // Ensure the filterRow is null
                //.is('troop_los', null) // Ensure troop_los is also null
                .range(start, end) // Use range for pagination
                .order('cluster_id', { ascending: true }); // <<-- deterministic order

            if (error) {
                console.error('Error fetching data:', error);
            return null;
            }

            if (data.length === 0) {
                break; // No more data
            }

            allData = allData.concat(data);
            currentPage++;
        }

        return allData;
    }
    function createGeojsonFeatureCollection(records) {
        console.log(records[0]);
        geojsonFeatureCollection.value.features = records.map(record => ({
            type: "Feature",
            geometry: record.plot_coordinates[0].center_location,
            properties: {
                id: record.id,
                name: record.name
            }
        }));
    }
    async function _requestPlots() {

        //rowData.value = [];

        // Check if PowerSync is available
        if (!powerSyncDB) {
          console.warn('PowerSync not available - loading will remain true');
          return;
        }

        let companyType = null; //'responsible_state'; // responsible_administration
        let filterRow = null; //'provider_los'; 

        switch (props.organization_type) {
            case 'root':
                companyType = 'responsible_administration';
                filterRow = 'administration_los';
                break;
            case 'country':
                companyType = 'responsible_state';
                filterRow = 'state_los';
                break;
            case 'provider':
                companyType = 'responsible_provider';
                filterRow = 'provider_los';
                break;
        }
        if (!companyType || !filterRow) {
            console.warn('No company type or filter row defined for organization type:', props.organization_type);
            return;
        }
        console.log(companyType, filterRow);
        
        fetchAllDataPaginated('view_records_details', props.organization_id, companyType, filterRow)
            .then(async (records) => {
                
                if (records && records.length > 0) {
                    loading.value = true;

                    // show last record
                    const lastRecord = records[records.length - 1];

                    // Ensure lookup tables are fully loaded before processing
                    await _requestAllLookupTables();

                    rowData.value = _preRenderRecords(records);
                    dbData.value = JSON.parse(JSON.stringify(rowData.value)); // Deep copy for reset purposes
                    createGeojsonFeatureCollection(records);

                    snackbarText.value = `${records.length} Datensätze erfolgreich geladen.`;
                    snackbarColor.value = 'success';
                    snackbar.value = true;

                } else {
                    snackbarText.value = 'Keine Datensätze gefunden für die Organisation.';
                    snackbarColor.value = 'warning';
                    snackbar.value = true;
                }
            })
            .catch((error) => {
                console.error('Error fetching records:', error);
            }).finally(() => {
                loading.value = false;
            });
    }

    function onSelectionChanged(event) {
        selectedRows.value = event.api.getSelectedRows();
        // Perform actions based on the selected rows
    }

    async function addToLos(){
        console.log(selectedRows.value.length);
        assignTo(props.los.id);
    }
    async function assignTo(losId){
        if (!losId) {
            console.error('Error: losId is required.');
            snackbarText.value = 'Fehler: Los ID ist erforderlich.';
            snackbarColor.value = 'error';
            snackbar.value = true;
            return;// 6934
        }

        const uniqueClusterIds = [...new Set(selectedRows.value.map(row => row.cluster_id))];

        if (uniqueClusterIds.length === 0) {
            snackbarText.value = 'Keine Cluster IDs in der Auswahl gefunden.';
            snackbarColor.value = 'warning';
            snackbar.value = true;
            return;
        }

        console.log(`Starting batch assignment of ${uniqueClusterIds.length} clusters to LOS: ${losId}`);
        assigning.value = true;
        
        const batchSize = 75; // Reduced batch size for more reliability
        let processedCount = 0;
        let failedClusters = [];
        let totalBatches = Math.ceil(uniqueClusterIds.length / batchSize);

        const update = {};
        switch (props.organization_type) {
            case 'root':
                update.administration_los = losId;
                break;
            case 'country':
                update.state_los = losId;
                break;
            case 'provider':
                update.provider_los = losId;
                break;
        }

        console.log(`Organization Type: ${JSON.stringify(update)}`);

        try {
            // Process all batches and track progress
            for (let i = 0; i < uniqueClusterIds.length; i += batchSize) {
                const batch = uniqueClusterIds.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                
                snackbarText.value = `Verarbeite ${batchNumber}/${totalBatches}`;
                snackbarColor.value = 'info';
                snackbar.value = true;
                
                try {
                    // Use count option to get the number of affected rows
                    const { count, error } = await supabase
                        .from('records')
                        .update(update)
                        .in('cluster_id', batch)
                        .select('cluster_id');  // Request actual affected rows
                    
                    if (error) {
                        console.error(`Error in batch ${batchNumber}:`, error);
                        failedClusters.push(...batch);
                    } else {
                        processedCount += count || 0;
                    }
                } catch (batchError) {
                    console.error(`Unexpected error in batch ${batchNumber}:`, batchError);
                    failedClusters.push(...batch);
                }
                
                // Add a small delay between batches
                if (i + batchSize < uniqueClusterIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Handle any failed clusters with auto-retry once
            if (failedClusters.length > 0) {
                console.warn(`${failedClusters.length} clusters failed. Attempting auto-retry...`);
                
                // Break failed clusters into smaller batches for retry
                const retryBatchSize = Math.floor(batchSize / 2);
                
                for (let i = 0; i < failedClusters.length; i += retryBatchSize) {
                    const retryBatch = failedClusters.slice(i, i + retryBatchSize);
                    
                    try {
                        const { count, error } = await supabase
                            .from('records')
                            .update(update)
                            .in('cluster_id', retryBatch)
                            .select('cluster_id');
                            
                        if (!error) {
                            processedCount += count || 0;
                        }
                    } catch (retryError) {
                        console.error('Retry error:', retryError);
                    }
                    
                    // Longer delay for retries
                    if (i + retryBatchSize < failedClusters.length) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            const successRate = Math.round((processedCount / uniqueClusterIds.length) * 100);
            snackbarText.value = `Zuordnung abgeschlossen: ${processedCount} von ${uniqueClusterIds.length} Clustern (${successRate}%) erfolgreich zugeordnet.`;
            snackbarColor.value = processedCount === uniqueClusterIds.length ? 'success' : 'warning';
            snackbar.value = true;
            
        } catch (error) {
            console.error('Unexpected error during batch assignment:', error);
            snackbarText.value = `Fehler bei der Zuordnung: ${error.message}`;
            snackbarColor.value = 'error';
            snackbar.value = true;
        } finally {
            assigning.value = false;
            emit('confirm');
            selectedLos.value = null;
        }
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
        assignTo(newValue.id);
    });

    function exportSelected() {
        if (selectedRows.value.length === 0) {
            console.warn('No rows selected for export');
            return;
        }

        currentGrid.value.api.exportDataAsCsv({
            fileName: `selected_records_${new Date().toISOString()}.csv`,
            onlySelected: true,
            skipColumnGroupHeaders: true,
            skipHeaders: false
        });

    }

    onMounted(async () => {

        //powerSyncDB = await waitForDb();

        loading.value = true;

        //await _requestLose(props.organization_id);
        if(props.cluster && props.cluster.length){
            cluster.value = props.cluster;
        }else{
             await _requestcluster();
        }
        //console.log('cluster:', cluster.value.length);
        //await _requestOrganizations();
        //console.log('Organizations:', organizations.value.length);
        organizations.value = await _getOrganizations();
        troops.value = await _getTroops(props.organization_id);
        //console.log('Troops:', troops.value.length);

        setColDefs();

        //await _requestAllLookupTables();

        //console.log('Lookup tables loaded');
        await _requestPlots();
        console.log('Plots:', rowData.value.length);
        
    });
    let filteredRows = ref({});
    function onFilterChanged(filter) {
        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        filteredRows.value = currentGrid.value.api.getFilterModel();
    }
    function refreshCells(){
        currentGrid.value.api.refreshCells();
    }
    function clearFilters() {
        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        currentGrid.value.api.setFilterModel(null);
        filteredRows.value = {};
    }
    function clearFilter(filterKey) {
        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        if (filterKey && filteredRows.value[filterKey]) {
            currentGrid.value.api.setFilterModel({
                ...currentGrid.value.api.getFilterModel(),
                [filterKey]: null
            });
            delete filteredRows.value[filterKey];
        } else {
            console.warn('No filter key provided or filter not found');
        }

    }
    function selectByClusterIds(clusterIds) {
        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        if (!Array.isArray(clusterIds) || clusterIds.length === 0) {
            console.warn('No cluster IDs provided for selection');
            snackbarText.value = 'Keine Cluster IDs zum Auswählen angegeben.';
            snackbarColor.value = 'error';
            snackbar.value = true;
            return;
        }

        let selectedRows = 0;
        currentGrid.value.api.forEachNode((node) => {
            if (clusterIds.includes(node.data.cluster_name)) {
                node.setSelected(true);
                selectedRows++;
            }
        });

        // count selected rows
        //const selectedCount = currentGrid.value.api.getSelectedRows().length;
        snackbarText.value = `${selectedRows} Ecken ausgewählt.`;
        snackbarColor.value = 'success';
        snackbar.value = true;

    }
    async function handleFileUpload(fileInputEvent){
        const file = fileInputEvent.target.files[0];
        if (!file) {
            snackbarText.value = 'Keine Datei ausgewählt.';
            snackbarColor.value = 'error';
            snackbar.value = true;
            return;
        }

        try {
            const text = await file.text();
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            const numbers = lines.flatMap(line => line.split(',').map(v => v.trim()).filter(v => /^\d+$/.test(v)));

            if (numbers.length === 0) {
                console.warn('No valid cluster IDs found in the file');
                return;
            }

            // array string to number
            const numbersAsInt = numbers.map(Number);

            selectByClusterIds(numbersAsInt);

        } catch (e) {
            console.error('Error processing file:', e);
            snackbarText.value = 'Fehler beim Verarbeiten der Datei: ' + e.message;
            snackbarColor.value = 'error';
            snackbar.value = true;
        } finally {
            loading.value = false;
        }

    }
    function _renderLookupOptimized(lookupMaps, tableName, code) {
        if (!code) return null;
        
        const lookupMap = lookupMaps[tableName];
        if (!lookupMap) return `no lookup table | ${code} (${tableName})`;
        
        const entry = lookupMap.get(code.toString());
        if (entry) {
            return `${entry.name_de} (${code})`;
        }
        
        return `no lookup value | ${code} (${tableName})`;
    }

    function _renderClusterOptimized(clusterData, fieldName, lookupMaps, lookupTableName = null) {
        if (!clusterData) return 'not defined';
        
        const value = clusterData[fieldName];
        if (!value) return 'not defined';
        
        if (lookupTableName) {
            return _renderLookupOptimized(lookupMaps, lookupTableName, value);
        }
        
        return value.toString();
    }
    function _handleClose () {
        responsibleDialog.value = false;
    };
    async function _handleConfirm (selectedCompany, selectedTroop) {

        let updateField = null;

        switch (props.organization_type) {
            case 'root':
                updateField = 'responsible_state';
                break;
            case 'country':
                updateField = 'responsible_provider';
                break;
        };

        const selectedLos = currentGrid.value.api.getSelectedRows();
        const plotIds = selectedLos.map(row => row.plot_id);

        const update = {
            responsible_troop: selectedTroop || null
        }
        if(selectedCompany) {
            update[updateField] = selectedCompany;
        }

        for (const plotId of plotIds) {
            const { data, error } = await supabase
                .from('records')
                .update(update)
                .eq('plot_id', plotId)
                .select()
                .single();

            if (error) {
                snackbarText.value = 'Error updating responsible users: ' + error.message;
                snackbarColor.value = 'error';
                snackbar.value = true;
            } else {
                responsibleDialog.value = false; // Close the dialog
                snackbarText.value = 'Responsible users updated successfully.';
                snackbarColor.value = 'success';
                snackbar.value = true;
                //_requestData(props.organization_id); // Refresh the list
            }
        }
        // _requestPlots();
    }
</script>

<template>
    <v-card-text class="pa-0">
    <!-- The AG Grid component -->
    <v-file-input v-if="!loading" 
        accept=".csv, text/plain"
        label="Komma separierte Liste von Trakt Namen"
        @change="handleFileUpload"
        class="ma-2"
        rounded="xl"
        variant="solo"></v-file-input>

    <!-- Replace v-app-bar with v-toolbar or v-card-title -->
    <v-card class="mx-4 mt-4 mb-1">
        <v-toolbar density="compact" v-if="Object.keys(filteredRows).length" >
            <template v-slot:prepend>
                <v-icon>mdi-filter</v-icon>
            </template>
            <v-toolbar-title>Aktive Filter ({{ Object.keys(filteredRows).length }})</v-toolbar-title>
            <template v-slot:append>
                <v-chip
                    v-for="(value, key) in filteredRows"
                    :key="key"
                    class="ma-1"
                    color="primary"
                    text-color="white"
                    variant="tonal"
                    rounded="xl"
                    @click="clearFilter(key)"
                >
                    {{ key }}: {{ value.filter }}
                </v-chip>
                <v-btn @click="clearFilters" variant="outlined" prepend-icon="mdi-delete" rounded="xl">
                    Alle zurücksetzen
                </v-btn>
            </template>
        </v-toolbar>
    </v-card>
    <!--
    <v-card class="mx-4 mt-4 mb-1">
        <v-toolbar density="compact" v-if="rowData.length" >
            <template v-slot:prepend>
                <v-icon>mdi-update</v-icon>
            </template>
            <template v-slot:append>
                <v-btn @click="updateGrid" variant="outlined" prepend-icon="mdi-delete" rounded="xl">
                    Update Grid from existing data
                </v-btn>
            </template>
        </v-toolbar>
    </v-card>-->
    <ag-grid-vue
        class="mx-4"
        ref="currentGrid"
        v-if="!loading"
        @selection-changed="onSelectionChanged"
        @filter-changed="onFilterChanged"
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
            size="30"
            width="2"
        ></v-progress-circular>
        <p class="mt-2">Cluster laden...</p>
    </div>
    </v-card-text>
    <v-card-actions v-if="!loading">
            <v-btn
                variant="tonal"
                icon="mdi-map"
                @click="mapDialog = true"
                :disabled="!geojsonFeatureCollection.features.length"
                density="compact"
            ></v-btn>
            {{ geojsonFeatureCollection.features.length }} GeoJSON-Features
            <v-chip
                class="ma-2"
                color="primary"
                text-color="white"
                variant="tonal"
                rounded="xl"
            >
                {{ selectedRows.length }} ausgewählte Ecken
            </v-chip>
            <v-toolbar-title></v-toolbar-title>
            <div v-if="selectedRows.length > 0">
                <v-btn
                    class="mx-2"
                    variant="tonal"
                    prepend-icon="mdi-file-download"
                    @click="exportSelected"
                    rounded="xl"
                >
                    als .csv herunterladen
                </v-btn>
                <v-btn
                    class="mx-2"
                    variant="tonal"
                    prepend-icon="mdi-security"
                    @click="responsibleDialog = true"
                    rounded="xl"
                >
                    Berechtigung zuweisen
                </v-btn>
                
                <!--<v-select
                    v-if="!props.los"
                    :items="selectableLose" 
                    item-title="name" 
                    label="Los zuordnen" 
                    v-model="selectedLos"
                    return-object
                    :disable="assigning"
                    class="pa-2"
                    rounded="xl"
                    variant="solo"
                    
                >
                    <template v-slot:selection="{ item }">
                        {{ item.raw.name }}
                    </template>
                </v-select>-->
                <v-btn
                    v-if="props.los"
                    class="mx-2"
                    variant="tonal"
                    rounded="xl"
                    @click="addToLos"
                    :disable="assigning"
                    :loading="assigning"
                    :loading-text="'Cluster zuweisen...'"
                >
                    Zu "{{ props.los.name }}" hinzufügen
                </v-btn>
            </div>
    </v-card-actions>
    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
    <DialogResponsible
        v-model="responsibleDialog"
        :selected="selectedLos"
        :organizationId="props.organization_id"
        @close="_handleClose"
        @confirm="_handleConfirm"
    />
    <v-dialog v-model="mapDialog" max-width="500">
        <v-card>
            <GeoJsonMap :geojson="geojsonFeatureCollection" />
        </v-card>
    </v-dialog>
</template>