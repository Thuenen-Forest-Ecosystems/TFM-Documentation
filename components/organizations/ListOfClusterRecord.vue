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
    import ClusterActions from '../cluster/ClusterActions.vue';


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

    const selectedClusterIdsInput = ref([]);
    const searchInput = ref('');
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

    const loadingSelection = ref(false);

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
        },
        records: {
            type: Array,
            default: null
        },
        tab_active: {
            type: Boolean,
            default: true
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
    //const dbData = ref([]);
    const geojsonFeatureCollection = ref({
        type: "FeatureCollection",
        features: []
    });
    const selectedLos = ref(null);

    // Grid Options
    const gridOptions = {
        localeText: AG_GRID_LOCALE_DE,
        getRowId: (params) => params.data.plot_id,
        isRowSelectable: (node) => {
            // Example condition: Only allow rows where `is_valid` is true
            return node.data ? node.data.is_selectable : false;
        },
        suppressRowHoverHighlight: false,
        suppressCellFocus: true,
        columnHoverHighlight: true,
        suppressMovableColumns: false,
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
            wrapHeaderText: false,
            autoHeaderHeight: false
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
                headerCheckboxSelection: true, //(params) => params.data?.completed_at_state === null, // Conditional logic
                checkboxSelection: true, //(params) => params.data?.completed_at_state === null, // Conditional logic
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
                width: 70,
                sortable: true,
                sort: 'asc',
                filter: 'statusFilter',
                filterParams: {
                    values: workflows.map(wf => wf.id),
                    workflows: workflows
                },
                //sortingOrder: ['asc', 'desc'],
                tooltipValueGetter: (params) => workflows.find(wf => wf.id === params.value)?.tooltip || params.value,
                valueGetter: (params) => params.data?.state_by_user,
                cellRenderer: (params) => {
                    const workflow = workflows.find(wf => wf.id === params.value);
                    const color = workflow?.searchText || 'transparent';
                    const icon = color === 'red' ? 'mdi-close-octagon' : color === 'yellow' ? 'mdi-alert' : color === 'green' ? 'mdi-check' : '';
                    return `<div style="height: 100%; display: flex; align-items: center; justify-content: center;"><span class="mdi ${icon}" style="font-size: 18px; color: ${color};" title="${workflow?.tooltip || ''}"></span></div>`;
                }
            },
            /*{ 
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
            },*/
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
                field: "responsible_provider",
                headerName: "Dienstleister",
                filter: true,
                sortable: true,
                tooltipField: "responsible_provider",
                pinned: 'right',
                //type: "string",
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
                        editable: false,
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
                        editable: false,
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
                        cellDataType: "date",
                        filter: "agDateColumnFilter",
                        valueGetter: (params) => {
                            if (!params.data.completed_at_troop) return null;
                            const date = new Date(params.data.completed_at_troop);
                            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        },
                        valueFormatter: (params) => params.data.completed_at_troop ? params.data.completed_at_troop.toLocaleString() : '',
                    },
                ]
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
                field: "accessibility",
                headerName: "Begehbarkeit 2022", // https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/issues/47#event-19265086339
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.accessibility",
                tooltipField: "accessibility"
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
                field: "forest_office",
                headerName: "Forstamt",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.plot.forest_status",
                tooltipField: "forest_office"
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
                field: "updated_at",
                headerName: "letzte Änderung",
                filter: true,
                sortable: true,
                tooltipField: "updated_at",
                cellDataType: "date",
                filter: "agDateColumnFilter",
                valueGetter: (params) => {
                    if (!params.data.updated_at) return null;
                    const date = new Date(params.data.updated_at);
                    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                },
                valueFormatter: (params) => params.data.updated_at ? params.data.updated_at.toLocaleString() : '',
            },
            {
                field: "state_responsible",
                headerName: "Verantwortlichkeit 2022",
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.state_responsible",
                tooltipField: "state_responsible",
                //type: "string",
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
                field: "grid_density",
                headerName: "Rasterdichte",
                filter: true,
                tooltipField: "grid_density",
                sortable: true,
                //type: "string",
                headerTooltip: "inventory_archive.cluster.grid_density",
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
                field: "states_affected",
                headerName: "Betroffene Bundesländer", // Affected States
                filter: true,
                sortable: true,
                headerTooltip: "inventory_archive.cluster.states_affected"
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
                field: "plot_name",
                headerName: "Ecke",
                filter: true,
                sortable: true,
                pinned: 'left',
                headerTooltip: "inventory_archive.plot.plot_name",
                width: 80,
                //type: "number"
            },
            {
                field: 'completed_at_state',
                headerName: "Akzeptiert (Landesinventurleitung)",
                filter: true,
                sortable: true,
                headerTooltip: "records.completed_at_state",
                tooltipField: "completed_at_state",
                cellDataType: "date",
                filter: "agDateColumnFilter",
                valueGetter: (params) => {
                    if (!params.data.completed_at_state) return null;
                    const date = new Date(params.data.completed_at_state);
                    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                },
                valueFormatter: (params) => params.data.completed_at_state ? params.data.completed_at_state.toLocaleString() : '',
            },
            {
                field: 'completed_at_administration',
                headerName: "Akzeptiert (Bundesinventurleitung)",
                filter: true,
                sortable: true,
                headerTooltip: "records.completed_at_administration",
                tooltipField: "completed_at_administration",
                cellDataType: "date",
                filter: "agDateColumnFilter",
                valueGetter: (params) => {
                    if (!params.data.completed_at_administration) return null;
                    const date = new Date(params.data.completed_at_administration);
                    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                },
                valueFormatter: (params) => params.data.completed_at_administration ? params.data.completed_at_administration.toLocaleString() : '',
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
                return `${code} | ${entry.name_de}`;
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
    function computeSelectable(record) {
        if( props.organization_type === 'provider' && record.completed_at_state === null && record.completed_at_administration === null){
            return true;
        }
        if( props.organization_type === 'country' && record.completed_at_administration === null){
            return true;
        }
        if( props.organization_type === 'root'){
            return true;
        }
        return false;
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
                is_selectable: computeSelectable(record),

                plot_id: record.plot_id,

                state_by_user: stateByOrganizationType(props.organization_id, props.organization_type, record).id,
                cluster_id: record.cluster_id,
                cluster_name: record.cluster_name,
                plot_name: record.plot_name,

                validity: record.is_valid ? (record.is_plausible ? true : false) : false,

                updated_at: record.updated_at ? new Date(record.updated_at) : null,
                completed_at_state: record.completed_at_state ? new Date(record.completed_at_state) : null,
                completed_at_administration: record.completed_at_administration ? new Date(record.completed_at_administration) : null,
                completed_at_troop: record.completed_at_troop ? new Date(record.completed_at_troop) : null,

                
                note: record.note,

                responsible_state: organizationsIDMap.get(record.responsible_state) || record.responsible_state,
                responsible_provider: organizationsIDMap.get(record.responsible_provider) || record.responsible_provider,
                responsible_troop: troop ? troop.name + (troop.is_control_troop ? ' (KT)' : ' (AT)') : record.responsible_troop,

                //administration_los: record.administration_los,
                //state_los: record.state_los,
                //provider_los: record.provider_los,
                
                
                is_training: clusterData?.is_training,
                cluster_status: _renderLookupOptimized(lookupMaps, 'lookup_cluster_status', record.cluster_status),
                cluster_situation: _renderLookupOptimized(lookupMaps, 'lookup_cluster_situation', record.cluster_situation),
                
                state_responsible: _renderLookupOptimized(lookupMaps, 'lookup_state', record.state_responsible), //_renderClusterOptimized(clusterData, 'state_responsible', lookupMaps, 'lookup_state'),
                states_affected: record.states_affected, //clusterData?.['states_affected'] || 'not defined',
                
                
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
                grid_density: _renderLookupOptimized(lookupMaps, 'lookup_grid_density', record.grid_density)//_renderClusterOptimized(clusterData, 'grid_density', lookupMaps, 'lookup_grid_density')
            
            
            };
        });
        
        return processedRecords;
    }
   
    async function _requestAllLookupTables(){
        // Get Browser language
        const language = navigator.language || navigator.userLanguage || 'de-DE';
        const languageCode = language.split('-')[0]; // Extract language code (e.g., 'de' from 'de-DE')
        const languageVariable = languageCode === 'en' ? 'name_en' : 'name_de';

        // Lade alle Lookup-Tabellen parallel und warte auf alle Ergebnisse,
        // damit lookupTablesValue vollständig ist bevor _preRenderRecords ausgeführt wird.
        const promises = listOfLookupTables.map(async (table) => {
            try {
                const { data, error } = await supabase
                    .schema('lookup')
                    .from(table)
                    .select(`name_de:${languageVariable}, code`);

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
                .select('id, name, is_control_troop');
                //.eq('organization_id', organizationId);
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
    async function fetchAllDataPaginated(tableName, organizationId, companyType) {
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
                    note,
                    cluster_status,
                    cluster_situation,
                    state_responsible,
                    states_affected,
                    grid_density
                `)
                .eq(companyType, organizationId)
                .order('cluster_id', { ascending: true })
                .range(start, end); // <<-- deterministic order

            if (error) {
                console.error('Error fetching paginated data:', error);
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
        console.log('Creating GeoJSON Feature Collection with records:', records.length);
        geojsonFeatureCollection.value.features = records.map(record => ({
            type: "Feature",
            geometry: record.center_location,
            properties: {
                isSelected: false,
                isFiltered: false,
                state_by_user: stateByOrganizationType(props.organization_id, props.organization_type, record).searchText,
                ...record
            }
        }));

    }
    async function _requestPlots(organizationType, organizationId) {


        let companyType = null; //'responsible_state'; // responsible_administration

        switch (organizationType) {
            case 'root':
                companyType = 'responsible_administration';
                break;
            case 'country':
                companyType = 'responsible_state';
                break;
            case 'provider':
                companyType = 'responsible_provider';
                break;
        }
        if (!companyType) {
            console.warn('No company type or filter row defined for organization type:', organizationType);
            return;
        }

        const records = await fetchAllDataPaginated('view_records_details', organizationId, companyType)

        if (records && records.length > 0) {

            snackbarText.value = `${records.length} Datensätze erfolgreich geladen.`;
            snackbarColor.value = 'success';
            snackbar.value = true;

        } else {
            snackbarText.value = 'Keine Datensätze gefunden für die Organisation.';
            snackbarColor.value = 'warning';
            snackbar.value = true;
        }

        return records || [];
    }

    function onSelectionChanged(event) {
        loadingSelection.value = true;
        
        // Use requestAnimationFrame to avoid blocking UI
        requestAnimationFrame(() => {
            selectedRows.value = currentGrid.value.api.getSelectedRows();
            
            // Create a Set of selected plot_ids for fast lookup
            const selectedPlotIds = new Set(selectedRows.value.map(row => row.plot_id));

            // Update each feature's isSelected property
            geojsonFeatureCollection.value.features.forEach(feature => {
                feature.properties.isSelected = selectedPlotIds.has(feature.properties.plot_id);
            });
            
            loadingSelection.value = false;
        });
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
        /*switch (props.organization_type) {
            case 'root':
                update.administration_los = losId;
                break;
            case 'country':
                update.state_los = losId;
                break;
            case 'provider':
                update.provider_los = losId;
                break;
        }*/


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
    // watch tab_active
    watch(() => props.tab_active, (newValue) => {
        if (newValue) {
            nextTick(async () => {

                organizations.value = await _getOrganizations();
                troops.value = await _getTroops(props.organization_id);
                console.log('Organizations and Troops loaded on tab active', troops.value);

                const records = props.records || await _requestPlots(props.organization_type, props.organization_id);

                rowData.value = _preRenderRecords(records);
                createGeojsonFeatureCollection(records);
                
            });
        }
    }, { immediate: true });

    function exportSelected() {
        if (selectedRows.value.length === 0) {
            console.warn('No rows selected for export');
            return;
        }

        currentGrid.value.api.exportDataAsCsv({
            fileName: `selected_records_${new Date().toISOString()}.csv`,
            onlySelected: true,
            skipColumnGroupHeaders: true,
            skipHeaders: false,
            columnSeparator: ';'
        });

    }
    function exportSelectedGeoJson(){ // 
        if (selectedRows.value.length === 0) {
            console.warn('No rows selected for export');
            return;
        }

        const filteredFeatures = geojsonFeatureCollection.value.features.filter(feature => 
            selectedRows.value.some(row => row.plot_id === feature.properties.plot_id)
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

     watch(() => props.records, (newRecords) => {

        rowData.value = _preRenderRecords(newRecords);
        createGeojsonFeatureCollection(newRecords);
    }, { immediate: true });

    onMounted(async () => {

        loading.value = true;

        //organizations.value = await _getOrganizations();
        //troops.value = await _getTroops(props.organization_id);

        setColDefs();

        const records = props.records || await _requestPlots(props.organization_type, props.organization_id);

         // Ensure lookup tables are fully loaded before processing
        await _requestAllLookupTables();

        rowData.value = _preRenderRecords(records);
        createGeojsonFeatureCollection(records);

        usersPermissions.value = await getUsersPermissions(supabase, props.organization_id);

        loading.value = false;
    });

    function onGridReady(params) {
        nextTick(() => {
            // Restore grid state from localStorage
            const savedState = localStorage.getItem('agGridState_' + props.organization_type);
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    currentGrid.value.api.applyColumnState({ state: state.columnState, applyOrder: true });
                    if (state.filterModel) {
                        currentGrid.value.api.setFilterModel(state.filterModel);
                    }
                } catch (e) {
                    console.error('Error restoring grid state:', e);
                }
            }
            
            setTimeout(() => {
                updateDisplayedRows(); // Initial update of displayed rows
            }, 100);
        });
    }
    
    function saveGridState() {
        if (!currentGrid.value?.api) return;
        
        const state = {
            columnState: currentGrid.value.api.getColumnState(),
            filterModel: currentGrid.value.api.getFilterModel()
        };
        
        localStorage.setItem('agGridState_' + props.organization_type, JSON.stringify(state));
    }
    function onFilterChanged(filter) {
        if (!currentGrid.value || !currentGrid.value.api) {
            console.error('Grid API not available');
            return;
        }
        filteredRows.value = currentGrid.value.api.getFilterModel();
        
        updateDisplayedRows();
        saveGridState(); // Save state when filter changes
    }
    
    function onSortChanged() {
        saveGridState(); // Save state when sort changes
    }
    
    function onColumnMoved() {
        saveGridState(); // Save state when columns are reordered
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
            feature.properties.isFiltered = displayedPlotIds.has(feature.properties.plot_id);
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

            // Add to selectedClusterIdsInput
            selectedClusterIdsInput.value = numbersAsInt;
            //selectByClusterIds(numbersAsInt);

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
            return `${code} | ${entry.name_de}`;
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
    async function _handleFinished(updatedRecords) {
        updateRowDataFromRecords(updatedRecords);
        responsibleDialog.value = false;
    };
    async function updateRowDataFromRecords(updatedRecords) {
        if (!updatedRecords || updatedRecords.length === 0) {
            console.warn('No records to merge');
            return;
        }

        // Update props.records if it exists
        if (props.records) {
            updatedRecords.forEach(updatedRecord => {
                const index = props.records.findIndex(r => r.plot_id === updatedRecord.plot_id);
                if (index !== -1) {
                    props.records[index] = { ...props.records[index], ...updatedRecord };
                    console.log('Updated props.records for plot_id:', updatedRecord.plot_id);
                }
            });
        }

        // _preRenderRecords to match grid format
        const updatedRecordsRendered = _preRenderRecords(updatedRecords);

        updatedRecordsRendered.forEach(updatedRecord => {
            const rowNode = currentGrid.value.api.getRowNode(updatedRecord.plot_id);
            if (rowNode) {
                // Merge updated fields into existing row data
                const existingData = rowNode.data;
                const newData = { ...existingData, ...{
                    responsible_state: updatedRecord.responsible_state,
                    responsible_provider: updatedRecord.responsible_provider,
                    responsible_troop: updatedRecord.responsible_troop,
                    note: updatedRecord.note,
                    completed_at_state: updatedRecord.completed_at_state,
                    completed_at_administration: updatedRecord.completed_at_administration,
                    completed_at_troop: updatedRecord.completed_at_troop,
                    updated_at: updatedRecord.updated_at,
                    is_selectable: updatedRecord.is_selectable,
                    state_by_user: updatedRecord.state_by_user
                } };
                rowNode.setData(newData);
            }
        });
    };
    async function _handleConfirm (selectedCompany, selectedTroop, additionalNote) {

        const update = {
            responsible_troop: selectedTroop || null,
            note: additionalNote || null
        }


        switch (props.organization_type) {
            case 'root':
                update.responsible_state = selectedCompany || null;
                update.responsible_provider = null;
                update.completed_at_administration = null; // reset completed at administration
                update.completed_at_state = null; // reset completed at state
                update.completed_at_troop = null; // reset completed at troop
                break;
            case 'country':
                update.responsible_provider = selectedCompany || null;
                update.completed_at_state = null; // reset completed at state
                update.completed_at_troop = null; // reset completed at troop
                break;
            case 'provider':
                update.completed_at_troop = null; // reset completed at troop
                break;
            default:    
                console.error('Unknown organization type:', props.organization_type);
                return;
        };

        const selectedLos = currentGrid.value.api.getSelectedRows();
        const clusterIds = selectedLos.map(row => row.cluster_id);
        // Get unique plot IDs from selected rows
        const uniqueClusterIds = [...new Set(clusterIds)];


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

                // update grid
                updateRowDataFromRecords(data);
            }
        }
    }
    function _toggleMap() {
        mapDialog.value = !mapDialog.value;
    }
    const selectedCluster = ref(null);
    function _selectedOnMap(clickedFeature) { // toggle selection on map click

        const jsonObject = clickedFeature; //JSON.parse(clickedFeature);
        selectedCluster.value = jsonObject;
        recordsDialog.value = true;
        return;
    }

    function _handlePolygonSelection(selectedFeatures) {
        if (!currentGrid.value?.api || !selectedFeatures || selectedFeatures.length === 0) return;
        
        // Get plot IDs from selected features and convert to Set for O(1) lookup
        const plotIdSet = new Set(selectedFeatures.map(feature => feature.plot_id));
        
        // Use AG Grid's efficient batch selection API
        const nodesToToggle = [];
        
        currentGrid.value.api.forEachNode((node) => {
            if (plotIdSet.has(node.data.plot_id)) {
                nodesToToggle.push(node);
            }
        });
        
        // Batch toggle using AG Grid's setNodesSelected (much faster than individual setSelected)
        if (nodesToToggle.length > 0) {
            // Determine if we should select or deselect based on first node
            const shouldSelect = !nodesToToggle[0].isSelected();
            
            // Use AG Grid's batch API - this is orders of magnitude faster
            currentGrid.value.api.setNodesSelected({
                nodes: nodesToToggle,
                newValue: shouldSelect
            });
            
            // Trigger selection changed after batch operation
            onSelectionChanged();
        }
    }

    // Map drawer resizing
    const mapDrawerWidth = ref(600);
    const isResizing = ref(false);

    function startResize(event) {
        isResizing.value = true;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        event.preventDefault();
    }

    function handleResize(event) {
        if (!isResizing.value) return;
        
        const newWidth = window.innerWidth - event.clientX;
        
        // Set min and max width constraints
        if (newWidth >= 300 && newWidth <= 1200) {
            mapDrawerWidth.value = newWidth;
        }
    }

    function stopResize() {
        isResizing.value = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }

    function addToSelection() {
        const input = searchInput.value.trim();
        
        if (!input) {
            return;
        }
        
        // Split input by commas, spaces, or semicolons and filter out empty strings
        const inputs = input.split(/[,\s;]+/).filter(str => str.length > 0);
        
        const validNumbers = [];
        const invalidInputs = [];
        const duplicates = [];
        
        inputs.forEach(str => {
            const num = Number(str);
            
            // Check if it's a valid number
            if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
                invalidInputs.push(str);
                return;
            }
            
            // Check if already in the list
            if (selectedClusterIdsInput.value.includes(num)) {
                duplicates.push(num);
                return;
            }
            
            validNumbers.push(num);
        });
        
        // Add all valid numbers
        if (validNumbers.length > 0) {
            selectedClusterIdsInput.value.push(...validNumbers);
            searchInput.value = ''; // Clear input after adding
            
            //snackbarText.value = `${validNumbers.length} Trakt${validNumbers.length > 1 ? 'e' : ''} zur Auswahl hinzugefügt.`;
            //snackbarColor.value = 'success';
            //snackbar.value = true;
        }
        
        // Show warnings for invalid inputs
        if (invalidInputs.length > 0) {
            snackbarText.value = `Ungültige Eingaben: ${invalidInputs.join(', ')}`;
            snackbarColor.value = 'error';
            snackbar.value = true;
            return;
        }
        
        // Show warnings for duplicates
        if (duplicates.length > 0 && validNumbers.length === 0) {
            snackbarText.value = `Diese Nummern sind bereits vorhanden: ${duplicates.join(', ')}`;
            snackbarColor.value = 'warning';
            snackbar.value = true;
        }
    }
    function removeFromSelection(index) {
        selectedClusterIdsInput.value.splice(index, 1);
    }

    function clearSelection() {
        selectedClusterIdsInput.value = [];
    }

    function selectFromInputList() {
        if (selectedClusterIdsInput.value.length === 0) {
            snackbarText.value = 'Keine Trakt-IDs eingegeben.';
            snackbarColor.value = 'warning';
            snackbar.value = true;
            return;
        }
        
        selectByClusterIds(selectedClusterIdsInput.value);
    }
</script>

<template>


    <!-- Replace v-app-bar with v-toolbar or v-card-title -->
    <v-card class="my-2" rounded="xl">
        <v-toolbar density="comfortable" v-if="Object.keys(filteredRows).length" class="pa-2" >
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
                    <v-icon icon="mdi-close-circle" start></v-icon>
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
        ref="currentGrid"
        v-if="!loading"
        @selection-changed="onSelectionChanged"
        @filter-changed="onFilterChanged"
        @sort-changed="onSortChanged"
        @column-moved="onColumnMoved"
        @grid-ready="onGridReady"
        :gridOptions="gridOptions"
        :theme="currentTheme"
        :pagination="true"
        :rowData="rowData"
        :columnDefs="colDefs"
        style="height: 700px"
    >
    </ag-grid-vue>
    <div v-if="loading" class="text-center">
        <v-skeleton-loader  type="table" />
    </div>

    <!--<div class="d-flex mt-4 align-center"  v-if="!loading" >
        <div class="flex-grow-1">
            <v-file-input
                accept=".csv, text/plain"
                label="Auswahl durch Komma separierte Liste (.csv/.txt) mit Trakt-Namen"
                @change="handleFileUpload"
                class="ma-2"
                rounded="xl"
                variant="solo"
                density="compact"
                ></v-file-input>
        </div>
        <div style="align-self: flex-start;" class="ma-2">
            <VimeoPlayer vimeoId="1121223526" h="94c0033551" btnTitle="Hilfe" title="Export/Import von Trakt-Auswahl nach Koordinaten" :iconOnly="false" />
        </div>
    </div>-->
    <v-card variant="outlined" class="mt-2 pa-2" rounded="lg">
        <v-toolbar color="transparent">
            <v-toolbar-title>Vorauswahl von Trakten treffen</v-toolbar-title>
            <VimeoPlayer vimeoId="1121223526" h="94c0033551" btnTitle="Anleitung GIS" title="Export/Import von Trakt-Auswahl nach Koordinaten" :iconOnly="false" />
        </v-toolbar>
        <div class="d-flex align-center ga-11 mt-2" v-if="!loading">
            <div class="flex-grow-1 d-flex flex-row ga-2">
                
                <v-text-field
                    v-model="searchInput"
                    label="Nummern von Trakten eingeben"
                    placeholder="Z.B. 45675, 45676, 45677 oder 45675 45676 45677"
                    type="text"
                    rounded="xl"
                    variant="solo"
                    density="comfortable"
                    autocomplete="off"
                    @keydown.enter.prevent="addToSelection"
                    @click:append-inner="addToSelection"
                >
                    <template v-slot:prepend-inner>
                        <v-icon>mdi-numeric</v-icon>
                    </template>
                    <template v-slot:details>
                        Manuelle Eingabe (mehrere Nummern mit Komma oder Leerzeichen getrennt)
                    </template>
                </v-text-field>
                <v-btn
                    append-icon="mdi-arrow-left-bottom"
                    @click="addToSelection"
                    rounded="xl"
                >
                    Hinzufügen
                </v-btn>
            </div>
            <div>
                <v-file-input
                    accept=".csv, text/plain"
                    label="Datei auswählen"
                    @change="handleFileUpload"
                    class="ma-2"
                    rounded="xl"
                    variant="solo"
                    density="compact"
                    prepend-icon="mdi-file-delimited"
                >
                    <template v-slot:details>
                        Komma separierte Liste (.csv/.txt) mit Trakt-Namen
                    </template>
                </v-file-input>
            </div>
        </div>
        <div>
            <div v-if="selectedClusterIdsInput.length > 0">
                <div class="d-flex flex-wrap align-center ga-2 mb-2">
                    <v-chip
                        v-for="(id, index) in selectedClusterIdsInput"
                        :key="id"
                        closable
                        variant="tonal"
                        :color="rowData.some(row => row.cluster_name === id) ? 'success' : 'error'"
                        @click:close="removeFromSelection(index)"
                    >
                        {{ id }}
                    </v-chip>
                </div>
                
                <!-- Aktions-Buttons -->
                <v-card-actions>
                    <v-btn
                        variant="flat"
                        prepend-icon="mdi-delete"
                        @click="clearSelection"
                        rounded="xl"
                    >
                        Vorauswahl entfernen
                    </v-btn>
                    <v-spacer></v-spacer>
                    <v-btn
                        color="primary"
                        variant="elevated"
                        prepend-icon="mdi-check"
                        @click="selectFromInputList"
                        rounded="xl"
                    >
                        Auswählen ({{ selectedClusterIdsInput.length }})
                    </v-btn>
                </v-card-actions>
            </div>
        </div>
    </v-card>
    
    <v-card v-if="!loading" class="position-fixed bottom-0 left-0 w-100" style="z-index: 12; border-top: 1px solid rgba(150, 150, 150, 0.12);">
        <v-card-text>
            <v-row class="ma-1">
                <v-btn
                    variant="tonal"
                    icon="mdi-map"
                    @click="_toggleMap"
                    :disabled="!geojsonFeatureCollection.features.length"
                    density="compact"
                    class="ma-1"
                ></v-btn>
                <div v-if="selectedRows.length > 0">
                    <v-btn-toggle rounded="xl" divided density="compact" variant="outlined">
                        <!--<v-btn icon="mdi-download"></v-btn>-->
                        <v-btn
                            @click="exportSelected"
                        >
                            .csv
                        </v-btn>
                        <v-btn
                            @click="exportSelectedGeoJson"
                        >
                            .geojson
                        </v-btn>
                    </v-btn-toggle>
                </div>
                <v-chip
                    class="ma-1"
                    color="primary"
                    text-color="white"
                    variant="tonal"
                    rounded="xl"
                >
                    {{ selectedRows.length }} ausgewählt von {{ displayedRows.length }} gefilterten Ecken
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
                <v-spacer></v-spacer>
                <div v-if="selectedRows.length > 0">
                    <v-btn
                        v-if="usersPermissions.find(perm => perm.is_organization_admin)"
                        class="mx-2"
                        variant="elevated"
                        prepend-icon="mdi-security"
                        @click="responsibleDialog = true"
                        rounded="xl"
                        color="primary"
                    >
                        Verantwortlichkeit ändern
                    </v-btn>
                    <v-btn
                        class="mx-2"
                        variant="elevated"
                        prepend-icon="mdi-bookmark-check"
                        @click="finishDialog = true"
                        rounded="xl"
                        color="primary"
                    >
                        Aufnahmen akzeptieren
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
            </v-row>
        </v-card-text>
    </v-card>

    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
    <div v-if="selectedRows.length > 0 && props.organization_id && props.organization_type && props.organization_type !== 'troop'">
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
    </div>
    <v-navigation-drawer
        location="right"
        v-model="mapDialog"
        :width="mapDrawerWidth"
        floating
        style="z-index: 11;"
        class="mt-16"
    >   
        <!-- Resize Handle -->
        <div
            @mousedown="startResize"
            style="
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 6px;
                cursor: ew-resize;
                background: rgba(var(--v-theme-primary), 0.9);
                z-index: 13;
                transition: background 0.2s;
            "
            @mouseenter="$event.target.style.background = 'rgba(var(--v-theme-primary), 0.9)'"
            @mouseleave="$event.target.style.background = isResizing ? 'rgba(var(--v-theme-primary), 0.9)' : 'rgba(var(--v-theme-primary), 0.9)'"
        ></div>
        
        <v-btn icon="mdi-close" @click="_toggleMap" class="ma-2 position-absolute top-0 start-0" style="z-index: 12;" density="compact"></v-btn>
        <GeoJsonMap
            :geojson="geojsonFeatureCollection" style="height: 100%; width: 100%;"
            :modelValue="mapDialog"
            @update:selected="_selectedOnMap"
            @polygonSelection="_handlePolygonSelection"
            />
    </v-navigation-drawer>
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
                    <ClusterActions
                            :clusterId="selectedCluster.cluster_id"
                            :cluster="selectedCluster"
                            :organizationId="props.organization_id"
                            :organizationType="props.organization_type" />
                    
                    
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
.v-navigation-drawer__scrim {
    display: none !important;
}
</style>