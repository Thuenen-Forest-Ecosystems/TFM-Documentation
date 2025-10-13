<script setup>
    import { onMounted, ref, getCurrentInstance, inject, nextTick, watch} from 'vue';
    import { AllCommunityModule, ModuleRegistry, TooltipModule } from 'ag-grid-community';
    ModuleRegistry.registerModules([AllCommunityModule, TooltipModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
    import { AG_GRID_LOCALE_DE } from '@ag-grid-community/locale';


    import ActionCellRenderer from './ActionCellRenderer.vue';
    import MoreCellRenderer from './MoreCellRenderer.vue';

    import DialogResponsible from './DialogResponsible.vue';
    import GeoJsonMap from '../map/GeoJsonMap.vue';
    import ClusterDetails from '../records/ClusterDetails.vue';

    import FinishDialog from './FinishDialog.vue';
    import { getUsersPermissions, stateByOrganizationType, workflows } from '../Utils';
    import StatusFilter from './customFilter/status.vue';

    import VimeoPlayer from '../../components/VimeoPlayer.vue';


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
    const usersPermissions = ref([]);

    //import { _ } from 'ajv';
   

    //const { waitForDb } = useDatabase()
    const lookupTablesValue = ref({});
    let currentGrid = ref(null);
    let selectedRows = ref([]);
    let filteredRows = ref({}); // Active Filter
    let displayedRows = ref([]); // Rows after filter and sort
    let selectableLose = ref([]);
    const assigning = ref(false);
    const mapDialog = ref(false);
    const recordsDialog = ref(false);

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    const responsibleDialog = ref(false);
    const finishDialog = ref(false);

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
        localeText: AG_GRID_LOCALE_DE,
        getRowId: (params) => params.data.plot_id,
        suppressRowHoverHighlight: false,
        suppressCellFocus: true,
        columnHoverHighlight: true,
        suppressMovableColumns: true,
        tooltipShowDelay: 500,
        /*rowSelection: {
            mode: 'multiRow',
            headerCheckbox: true,
            selectAll: 'filtered',
            enableClickSelection: true
        },*/
        rowSelection: 'multiple', // Use legacy string value for compatibility


        components: {
            actionCellRenderer: ActionCellRenderer, // Register the custom cell renderer
            moreCellRenderer: MoreCellRenderer,
            statusFilter: StatusFilter
        },
        defaultColDef: {
            initialWidth: 215,
            wrapHeaderText: true,
            autoHeaderHeight: true,
        },
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
                width: 60,
                sortable: false,
                filter: false,
                tooltipField: "note",
                cellRendererParams: {
                    onActionClick: (rowData) => {
                        selectedCluster.value = rowData;
                        recordsDialog.value = true;
                    },
                    has_note: (rowData) => !!rowData.note
                }
            },
            {
                headerCheckboxSelection: true, // Enables "select all" checkbox in header
                checkboxSelection: true, // Enables checkbox selection for rows
                headerCheckboxSelectionFilteredOnly: true, // This is the key for filtered-only selection
                //checkboxSelectionFilteredOnly: true, // This ensures only filtered rows are selectable
                pinned: 'left', // Pins the column to the left
                width: 50,
                sortable: false,
                filter: false,
                suppressHeaderMenuButton: true,
                lockPosition: 'left',
                suppressMovable: true
            },
            {
                field: 'state_by_user', // Custom cell renderer
                headerName: ' ',
                pinned: 'left',
                width: 55,
                sortable: true,
                //filter: 'statusFilter',
                tooltipValueGetter: (params) => workflows.find(wf => wf.id === params.value)?.tooltip || params.value,

                cellRenderer: (params) => {
                    return `<div style="height: 100%; display: flex; align-items: center; justify-content: center;"><span style="width: 15px; height: 15px; border-radius:100%; background-color: ${workflows.find(wf => wf.id === params.value)?.searchText || 'transparent'};"></span></div>`;
                }
            },
            { 
                field: "validity",
                headerName: "Gültigkeit",
                //filter: true,
                width: 100,
                //sortable: true,
                cellDataType: "boolean",
                pinned: 'left',
            },
            { 
                field: "is_training",
                headerName: "Schulungstrakt",
                filter: true,
                width: 108,
                //sortable: true,
                cellDataType: "boolean",
                pinned: 'left',
            },
            /*{
                cellRenderer: 'moreCellRenderer', // Custom cell renderer
                pinned: 'left',
                width: 50,
                sortable: false,
                filter: false
            },*/

            
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
                headerName: 'Trupps',
                children: [
                    {
                        columnGroupShow: 'closed',
                        field: "responsible_troop",
                        headerName: "Trupp",
                        filter: true,
                        sortable: true,
                        pinned: 'right',
                        tooltipField: "responsible_troop",
                        editable: true,
                        cellEditor: 'agSelectCellEditor',
                        cellEditorParams: {
                            values: [...troops.value.map(troop => troop.name), null],
                        }
                    },
                    {
                        columnGroupShow: 'open', 
                        field: "responsible_troop",
                        headerName: "Trupp",
                        filter: true,
                        sortable: true,
                        pinned: 'right',
                        tooltipField: "responsible_troop",
                        editable: true,
                        cellEditor: 'agSelectCellEditor',
                        cellEditorParams: {
                            values: [...troops.value.map(troop => troop.name), null],
                        }
                    },
                    {
                        columnGroupShow: 'open', 
                        field: 'completed_at_troop',
                        headerName: "Abgeschlossen",
                        filter: true,
                        sortable: true,
                        pinned: 'right',
                        headerTooltip: "records.completed_at_troop",
                        tooltipField: "completed_at_troop",
                        cellDataType: "dateTime",
                        filter: "agDateColumnFilter",
                        valueFormatter: (params) => Date.parse(params.value) ? new Date(params.value).toLocaleString() : params.value,
                    },
                ]
            },
            {
                field: "updated_at",
                headerName: "letzte Änderung",
                filter: true,
                sortable: true,
                tooltipField: "updated_at",
                cellDataType: "dateTime",
                filter: "agDateColumnFilter",
                valueFormatter: (params) => Date.parse(params.value) ? new Date(params.value).toLocaleString() : params.value,
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
                headerName: "Trakt Status",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.cluster_status",
                tooltipField: "cluster_status",
                //type: "string",
            },
            {
                field: "cluster_situation",
                headerName: "Trakt Situation",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.cluster_situation",
                tooltipField: "cluster_situation",
                //type: "string",
            },
            {
                field: "state_responsible",
                headerName: "Verantwortlichkeit",
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
                headerName: "Wald Status (BWI 2012)",
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
                headerName: "Betroffene Bundesländer", // Affected States
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.states_affected"
            },
            {
                field: 'completed_at_state',
                headerName: "Abgeschlossen (Landesinventurleitung)",
                filter: true,
                sortable: true,
                headerTooltip: "records.completed_at_state",
                tooltipField: "completed_at_state",
                cellDataType: "dateTime",
                filter: "agDateColumnFilter",
                valueFormatter: (params) => Date.parse(params.value) ? new Date(params.value).toLocaleString() : params.value,
            },
            {
                field: 'completed_at_administration',
                headerName: "Abgeschlossen (Bundesinventurleitung)",
                filter: true,
                sortable: true,
                headerTooltip: "records.completed_at_administration",
                tooltipField: "completed_at_administration",
                cellDataType: "dateTime",
                filter: "agDateColumnFilter",
                valueFormatter: (params) => Date.parse(params.value) ? new Date(params.value).toLocaleString() : params.value,
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

            const troop = troops.value.find(troop => troop.id === record.responsible_troop);

            return {
                plot_id: record.plot_id,

                state_by_user: stateByOrganizationType(props.organization_id, props.organization_type, record).id,
                cluster_id: record.cluster_id,
                cluster_name: record.cluster_name,
                plot_name: record.plot_name,

                validity: record.is_valid ? (record.is_plausible ? true : false) : false,

                updated_at: record.updated_at,
                completed_at_state: record.completed_at_state,
                completed_at_administration: record.completed_at_administration,
                completed_at_troop: record.completed_at_troop,

                
                note: record.note,

                responsible_state: organizationsIDMap.get(record.responsible_state) || record.responsible_state,
                responsible_provider: organizationsIDMap.get(record.responsible_provider) || record.responsible_provider,
                responsible_troop: troop ? troop.name + (troop.is_control_troop ? ' (KT)' : ' (AT)') : record.responsible_troop,

                administration_los: record.administration_los,
                state_los: record.state_los,
                provider_los: record.provider_los,
                
                
                is_training: clusterData.is_training,
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
    async function _requestclusterByPlots(records) {
        if (!records || !Array.isArray(records) || records.length === 0) {
            console.warn('No plots provided for cluster fetch', records);
            return;
        }

        const uniqueClusterIds = [...new Set(records.map(r => r.cluster_id).filter(id => id !== null && id !== undefined))];
        if (uniqueClusterIds.length === 0) {
            console.warn('No valid cluster IDs found in records');
            return;
        }

        cluster.value = [];
        const batchSize = 100; // Adjust batch size based on Supabase limits
        const totalBatches = Math.ceil(uniqueClusterIds.length / batchSize);

        for (let i = 0; i < uniqueClusterIds.length; i += batchSize) {
            const batch = uniqueClusterIds.slice(i, i + batchSize);

            try {
                const { data, error } = await supabase
                    .schema('inventory_archive')
                    .from('cluster')
                    .select('*')
                    .in('id', batch);

                if (error) {
                    console.error('Error fetching clusters by plots:', error);
                } else {
                    cluster.value = cluster.value.concat(data);
                }
            } catch (e) {
                console.error('An unexpected error occurred while fetching clusters by plots:', e);
            }
        }

        console.log('Finished fetching all clusters:', cluster.value.length);
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
                    updated_at,
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
                    center_location,
                    completed_at_state,
                    completed_at_administration,
                    completed_at_troop,
                    is_valid,
                    is_plausible,
                    note
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

        geojsonFeatureCollection.value.features = records.map(record => ({
            type: "Feature",
            geometry: record.center_location,
            properties: {
                isSelected: false,
                isFiltered: false,
                state_by_user: stateByOrganizationType(props.organization_id, props.organization_type, record).searchText,
                record: record
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
        
        fetchAllDataPaginated('view_records_details', props.organization_id, companyType, filterRow)
            .then(async (records) => {
                
                if (records && records.length > 0) {
                    loading.value = true;

                    await _requestclusterByPlots(records);

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
            }).finally(async () => {
                loading.value = false;
            });
    }

    function onSelectionChanged(event) {
        selectedRows.value = currentGrid.value.api.getSelectedRows();
        console.log('Selected Rows:', selectedRows.value);
        //selectedRows.value = event.api.getSelectedRows();
        geojsonFeatureCollection.value.features.forEach(feature => {
            feature.properties.isSelected = selectedRows.value.some(row => row.plot_id === feature.properties.record.plot_id);
        });
        // Perform actions based on the selected rows
    }

    async function addToLos(){
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
    function exportSelectedGeoJson(){ // 
        if (selectedRows.value.length === 0) {
            console.warn('No rows selected for export');
            return;
        }

        const filteredFeatures = geojsonFeatureCollection.value.features.filter(feature => 
            selectedRows.value.some(row => row.plot_id === feature.properties.record.plot_id)
        );

        const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features: filteredFeatures }, null, 2)], { type: 'application/vnd.geo+json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `selected_records_${new Date().toISOString()}.geojson`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    }

    onMounted(async () => {

        //powerSyncDB = await waitForDb();

        loading.value = true;

        //await _requestLose(props.organization_id);
        /*if(props.cluster && props.cluster.length){
            cluster.value = props.cluster;
        }else{
             await _requestcluster();
        }*/

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

        usersPermissions.value = await getUsersPermissions(supabase, props.organization_id);

    });

    function onGridReady(params) {
        nextTick(() => {
            setTimeout(() => {
                updateDisplayedRows(); // Initial update of displayed rows
            }, 100);
        });
    }
    function onFilterChanged(filter) {
        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        filteredRows.value = currentGrid.value.api.getFilterModel();
        
        updateDisplayedRows();
        
    }
    function updateDisplayedRows() {
        console.log('Updating displayed rows');

        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }

        // Clear displayedRows
        displayedRows.value = [];

        // Step 1: Collect all displayed rows
        currentGrid.value.api.forEachNodeAfterFilter((node) => {
            displayedRows.value.push(node.data);
        });

        // Step 2: Create a Set of plot_ids for faster lookup
        const displayedPlotIds = new Set(displayedRows.value.map(row => row.plot_id));

        // Step 3: Update geojsonFeatureCollection features
        geojsonFeatureCollection.value.features.forEach(feature => {
            feature.properties.isFiltered = displayedPlotIds.has(feature.properties.record.plot_id);
        });

        console.log('Displayed rows updated:', displayedRows.value.length);
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
            // Split lines and trim whitespace
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

            // Extract all numeric values (including quoted numbers) from each line
            const numbers = lines.reduce((acc, line) => {
                const matches = line.match(/"(\d+)"|\b\d+\b/g); // Match numbers inside quotes or standalone numbers
                if (matches) {
                    acc.push(...matches.map(num => num.replace(/"/g, ''))); // Remove quotes if present
                }
                return acc;
            }, []);

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

        if (!value){
            return 'not defined';
        }
        
        if (lookupTableName) {
            return _renderLookupOptimized(lookupMaps, lookupTableName, value);
        }
        
        return value.toString();
    }
    function _handleClose () {
        responsibleDialog.value = false;
    };
    async function _handleFinished(values) {
        console.log(values);
    };
    async function _handleConfirm (selectedCompany, selectedTroop, additionalNote) {

        let updateField = null;
        const update = {
            responsible_troop: selectedTroop || null,
            note: additionalNote || null
        }

        console.log('Selected Troop:', props.organization_type);

        switch (props.organization_type) {
            case 'root':
                update.responsible_state = selectedCompany || null;
                update.responsible_provider = null;
                //update.completed_at_administration = null; // reset completed at administration
                //update.completed_at_state = null; // reset completed at state
                //update.completed_at_troop = null; // reset completed at troop
                break;
            case 'country':
                update.responsible_provider = selectedCompany || null;
                //update.completed_at_state = null; // reset completed at state
                //update.completed_at_troop = null; // reset completed at troop
                break;
        };

        const selectedLos = currentGrid.value.api.getSelectedRows();
        const clusterIds = selectedLos.map(row => row.cluster_id);
        // Get unique plot IDs from selected rows
        const uniqueClusterIds = [...new Set(clusterIds)];

        console.log(selectedCompany, selectedTroop, selectedLos);

        for (const clusterId of uniqueClusterIds) {
            const { data, error } = await supabase
                .from('records')
                .update(update)
                .eq('cluster_id', clusterId)
                .select();

            if (error) {
                snackbarText.value = 'Error updating responsible users: ' + error.message;
                snackbarColor.value = 'error';
                snackbar.value = true;
            } else {
                responsibleDialog.value = false; // Close the dialog
                snackbarText.value = 'Responsible users updated successfully.';
                snackbarColor.value = 'success';
                snackbar.value = true;

                // TODO: Refresh
                //await _requestPlots();

                // update grid
                currentGrid.value.api.forEachNode((node) => {
                    if (uniqueClusterIds.includes(node.data.cluster_id)) {
                        if(selectedCompany) {
                            node.setDataValue(updateField, organizations.value.find(org => org.id === selectedCompany)?.name || selectedCompany);
                        }
                        node.setDataValue('responsible_troop', troops.value.find(troop => troop.id === selectedTroop)?.name || selectedTroop);
                    }
                });
            }
        }
         _requestPlots();
    }
    function _toggleMap() {
        mapDialog.value = !mapDialog.value;
    }
    const selectedCluster = ref(null);
    function _selectedOnMap(clickedFeature) { // toggle selection on map click

        const jsonObject = JSON.parse(clickedFeature.record);
        selectedCluster.value = jsonObject;
        recordsDialog.value = true;
        return;
        recordsDialog.value = true;
        selectedCluster.value = clickedFeature.properties.record;
        // Select the corresponding row in the grid
        /*if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        const rowNode = currentGrid.value.api.getRowNode(clickedFeature.plot_id);
        if (rowNode) {
            const isSelected = rowNode.isSelected();
            rowNode.setSelected(!isSelected);
        }*/
    }
</script>

<template>
    <v-card-text class="pa-0">
    <!-- The AG Grid component -->
    <div class="d-flex mt-4 align-center">
        <div class="flex-grow-1">
            <v-file-input v-if="!loading" 
                accept=".csv, text/plain"
                label="Komma separierte Liste von Trakt Namen"
                @change="handleFileUpload"
                class="ma-2"
                rounded="xl"
                variant="solo"></v-file-input>
        </div>
        <div>
            <VimeoPlayer vimeoId="1121223526" btnTitle="Hilfe" title="Export/Import von Trakt-Auswahl nach Koordinaten" :iconOnly="false" />
        </div>
    </div>

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
        @grid-ready="onGridReady"
        :gridOptions="gridOptions"
        :theme="currentTheme"
        :pagination="true"
        :rowData="rowData"
        :columnDefs="colDefs"
        style="height: 700px"
    >
    </ag-grid-vue>
    <div v-else-if="loading" class="text-center ma-11">
        <v-skeleton-loader  type="table" />
        <!--<v-progress-circular
            indeterminate
            color="primary"
            size="30"
            width="2"
        ></v-progress-circular>
        
        <p class="mt-2">Cluster laden...</p>-->
    </div>
    </v-card-text>
    <v-card-actions v-if="!loading">
            <v-btn
                variant="tonal"
                icon="mdi-map"
                @click="_toggleMap"
                :disabled="!geojsonFeatureCollection.features.length"
                density="compact"
            ></v-btn>
            <v-chip
                class="ma-2"
                color="primary"
                text-color="white"
                variant="tonal"
                rounded="xl"
            >
                {{ selectedRows.length }} ausgewählte Ecken
            </v-chip>
            <!--<v-chip
                class="ma-2"
                color="primary"
                text-color="white"
                variant="tonal"
                rounded="xl"
            >
                {{ displayedRows.length }} gefilterte Ecken
            </v-chip>-->
            <v-toolbar-title></v-toolbar-title>
            <div v-if="selectedRows.length > 0">
                Export:
                <v-btn-toggle rounded="xl" divided>
                    <v-btn
                        v-if="props.organization_type !== 'provider'"
                        @click="exportSelected"
                    >
                        .csv
                    </v-btn>
                    <v-btn
                        v-if="props.organization_type !== 'provider'"
                        @click="exportSelectedGeoJson"
                        
                    >
                        .geojson
                    </v-btn>
                </v-btn-toggle>
                <v-btn
                    v-if="props.organization_type !== 'provider' || usersPermissions.find(perm => perm.is_organization_admin)"
                    class="mx-2"
                    variant="tonal"
                    prepend-icon="mdi-security"
                    @click="responsibleDialog = true"
                    rounded="xl"
                >
                    Berechtigung vergeben
                </v-btn>
                <v-btn
                    v-if="props.organization_type !== 'provider' || !usersPermissions.find(perm => perm.is_organization_admin)"
                    class="mx-2"
                    variant="tonal"
                    prepend-icon="mdi-bookmark-check"
                    @click="finishDialog = true"
                    rounded="xl"
                >
                   Als abgeschlossen markieren
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
    <div v-if="props.organization_id && props.organization_type && props.organization_type !== 'troop'">
        <DialogResponsible
            v-model="responsibleDialog"
            :organizationId="props.organization_id"
            :organizationType="props.organization_type"
            :selectedRows="selectedRows"
            @close="_handleClose"
            @confirm="_handleConfirm"
        />

        <FinishDialog
            v-if="props.organization_type !== 'troop' && selectedRows.length > 0 && !props.los"
            v-model="finishDialog"
            :organizationId="props.organization_id"
            :organizationType="props.organization_type"
            :selectedRows="selectedRows"
            @close="finishDialog = false"
            @confirm="_handleFinished"
        />
        

        <v-navigation-drawer
            location="right"
            v-model="mapDialog"
            width="600"
            floating
            style="z-index: 10;"
            class="mt-16"
        >   
            <v-btn icon="mdi-close" @click="_toggleMap" class="ma-2 position-absolute top-0 start-0" style="z-index: 11;" density="compact"></v-btn>
            <GeoJsonMap
                :geojson="geojsonFeatureCollection" style="height: 100%; width: 100%;"
                :modelValue="mapDialog"
                @update:selected="_selectedOnMap"
                />
        </v-navigation-drawer>
    </div>
    <div v-if="selectedCluster">
        <v-dialog
        v-model="recordsDialog"
        fullscreen
        
        >
            <v-card>
                <v-toolbar>
                    <v-btn
                        icon="mdi-close"
                        @click="recordsDialog = false"
                    ></v-btn>

                    <v-toolbar-title>Trakt: {{ selectedCluster.cluster_name.toString() }}</v-toolbar-title>
                    
                    
                </v-toolbar>
                <ClusterDetails
                    :clusterId="selectedCluster.cluster_id"
                    :cluster="selectedCluster"
                    :organizationId="props.organization_id"
                    :organizationType="props.organization_type" />
            </v-card>
        </v-dialog>
    </div>
</template>

<style>
    /*.VPNavBar[data-v-84a11e99]:not(.has-sidebar) {
        background-color: var(--vp-nav-bg-color);
    }
    .v-navigation-drawer__scrim {
       display: none;
    }*/
</style>