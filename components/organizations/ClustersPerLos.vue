<script setup>
import { onMounted, ref, getCurrentInstance, inject, nextTick } from 'vue';
    import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
    ModuleRegistry.registerModules([AllCommunityModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
    import ActionCellRenderer from './ActionCellRenderer.vue';


    const darkTheme = themeQuartz.withPart(colorSchemeDark);
    const lightTheme = themeQuartz.withPart(colorSchemeLight);
    const globalIsDark = inject('globalIsDark');
    const currentTheme = globalIsDark?.value ? darkTheme : lightTheme;

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    import { useDatabase } from '../../.vitepress/theme/composables/useDatabase'
    import ListOfClusterRecord from './ListOfClusterRecord.vue';
    const { waitForDb } = useDatabase()

    const rowData = ref([]);
    let powerSyncDB = ref(null); 
    let loading = ref(true);
    let currentGrid = ref(null);
    let selectedRows = ref([]);
    const addClusterDialog = ref(false);

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    // props 
    const props = defineProps({
        records_Ids: {
            type: Array,
            default: () => []
        },
        los: {
            type: Object,
            default: () => ({})
        },
        organization_id: {
            type: String,
            default: ''
        },
        organization_type: {
            type: String,
            default: null
        },
        cluster: {
            type: Array,
            default: () => []
        },
        organizations: {
            type: Array,
            default: () => []
        }
    });

    // Grid Options
    const gridOptions = {
        rowSelection: {
            mode: 'multiRow',
            selectAll: 'filtered',
            enableClickSelection: true,
        },
        components: {
            actionCellRenderer: ActionCellRenderer // Register the custom cell renderer
        }
    }

    const colDefs = ref([
        {
            cellRenderer: 'actionCellRenderer', // Custom cell renderer
            pinned: 'left',
            width: 50
        },
        { 
            field: "cluster_name",
            headerName: "Trakt",
            filter: true,
            sortable: true,
            //type: "number",
            pinned: 'left',
            width: 100
        },
        // To History Button
        { 
            field: "plot_name",
            headerName: "Ecke",
            filter: true,
            sortable: true,
            //type: "number",
            pinned: 'left',
            width: 100
        },
        {
            field: "responsible_troop",
            headerName: "Aufnahmetrupp",
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
            field: "responsible_state",
            headerName: "Landesinventurleitung",
            filter: true,
            sortable: true,
            //type: "string",
        }
    ]);

    async function _getTroops(troopIds) {
        if (!troopIds || troopIds.length === 0) return [];
        try {
            const { data, error } = await supabase
                .from('troop')
                .select('id, name')
                .in('id', troopIds);
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

    async function renameColumns(rawData){
        const organizationsIDMap = new Map(props.organizations.map(org => [org.id, org.name]));
        const troopIdsArray = Array.from(new Set(rawData.map(record => record.responsible_troop))).filter(Boolean);
        const troops = await _getTroops(troopIdsArray);
        console.log('organizations', troops);
        return rawData.map(record => {
            
            if (!record) return null; // Handle null records
            return {
                cluster_id: record.cluster_id,
                cluster_name: record.cluster_name || '',
                plot_name: record.plot_name || '',
                responsible_troop: troops.find(troop => troop.id === record.responsible_troop)?.name || record.responsible_troop,
                responsible_provider: organizationsIDMap.get(record.responsible_provider) || record.responsible_provider,
                responsible_state: organizationsIDMap.get(record.responsible_state) || record.responsible_state
            };
        });
    }
    async function fetchRecords(losId) {
        
        try {
            // Limit to reasonable batch size to avoid performance issues

            if (!losId) {
                rowData.value = [];
                return;
            }

            let filterRow = null;
            switch (props.organization_type) {
                case 'root':
                    //companyType = 'responsible_administration';
                    filterRow = 'administration_los';
                    break;
                case 'country':
                    //companyType = 'responsible_state';
                    filterRow = 'state_los';
                    break;
                case 'provider':
                    //companyType = 'responsible_troop';
                    filterRow = 'provider_los';
                    break;
            }

            if(!filterRow) {
                console.error('No filter row found for organization type:', props.organization_type);
                rowData.value = [];
                return;
            }

            const {data:records, error} = await supabase
                .from('records')
                .select('cluster_id, cluster_name, plot_name, responsible_troop, responsible_provider, responsible_state')
                .eq(filterRow, losId);

            if (error) {
                console.error('Error fetching records:', error);
                rowData.value = [];
                return;
            }
            rowData.value = await renameColumns(records);
            return;
            
            // Use parameterized query for better performance
            const query = `SELECT cluster_name, plot_name, responsible_troop, responsible_provider, responsible_state FROM records WHERE administration_los = ?`;
            const result = await powerSyncDB.getAll(query, [losId]);
            
            rowData.value = result;
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            loading.value = false;
        }
    }
    function onSelectionChanged(event) {
        selectedRows.value = event.api.getSelectedRows();
    }
    const deleting = ref(false);
    async function removeSelected() {
        const selecteClusterNames = selectedRows.value.map(row => row.cluster_name);
        const selecteClusterIds = rowData.value
            .filter(row => selecteClusterNames.includes(row.cluster_name))
            .map(row => row.cluster_id);
        
        const uniqueClusterIds = [...new Set(selecteClusterIds)];
        const bulkSize = 100; // Adjust batch size as needed

        const update = {};
        switch (props.organization_type) {
            case 'root':
                update.administration_los = null;
                break;
            case 'country':
                update.state_los = null;
                break;
            case 'provider':
                update.provider_los = null;
                break;
        }

        try{
            deleting.value = true;
            for (let i = 0; i < uniqueClusterIds.length; i += bulkSize) {
                const batch = uniqueClusterIds.slice(i, i + bulkSize);
                // Use Supabase to update the records
                const {data, error} = await supabase.from('records').update(update).in('cluster_id', batch);
                if (error) {
                    console.error('Error removing selected clusters:', error);
                    deleting.value = false;
                    return;
                }
            }
            deleting.value = false;
        } catch (error) {
            deleting.value = false;
            console.error('Error removing selected clusters:', error);
            return;
        }
        
        //console.log('Successfully removed selected clusters:', data);
        await fetchRecords(props.los.id);
    }

    onMounted(async () => {
        console.log(props.organization_id);
        loading.value = true;
        //powerSyncDB = await waitForDb();
        await fetchRecords(props.los.id);
        loading.value = false;

    });
    function cancelAction() {
        addClusterDialog.value = false; // Close the dialog
    }
    function cancelUpdate() {
        addClusterDialog.value = false; // Close the dialog
        fetchRecords(props.los.id); // Refresh the records
    }
</script>


<template>
    <div v-if="!loading">
        <ag-grid-vue
            ref="currentGrid"
            @selection-changed="onSelectionChanged"
            :gridOptions="gridOptions"
            :theme="currentTheme"
            :pagination="true"
            :rowData="rowData"
            :columnDefs="colDefs"
            style="height: 500px"
        ></ag-grid-vue>
        
        <div v-if="selectedRows.length > 0" class="d-flex">
            <v-chip
                class="ma-2"
                color="primary"
                text-color="white"
                variant="tonal"
                rounded="xl"
            >
                {{ selectedRows.length }} selected rows
            </v-chip>
            <v-spacer></v-spacer>
            <v-btn
                class="ma-2"
                variant="tonal"
                rounded="xl"
                @click="removeSelected"
                append-icon="mdi-delete"
                :disabled="deleting"
                :loading="deleting"
                :loading-text="'Entferne Auswahl...'"
            >
                Auswahl aus Los entfernen
            </v-btn>
        </div>
    </div>
    <div v-else class="text-center ma-11">
        <v-progress-circular
            indeterminate
            color="primary"
            size="30"
            width="2"
        ></v-progress-circular>
        <p class="mt-2">Lade Plots...</p>
    </div>
    <v-card-actions v-if="props.organization_id && props.los.id">
        <v-spacer></v-spacer>
        <v-btn
            variant="tonal"
            rounded="xl"
            @click=" addClusterDialog = true"
            prepend-icon="mdi-plus"
            :disabled="!props.cluster || props.cluster.length === 0"
        >
            Cluster hinzufügen
        </v-btn>
    </v-card-actions>
    <v-dialog v-if="props.cluster && props.cluster.length" fullscreen scrollable v-model="addClusterDialog" max-width="500" @click:outside="cancelAction">
        <v-card>
            <v-toolbar>
                <v-toolbar-title>Noch nicht zugewiesene Cluster</v-toolbar-title>
                <v-btn icon="mdi-close" variant="text" @click="cancelAction"></v-btn>
            </v-toolbar>

            <ListOfClusterRecord :organization_id="props.organization_id" :organization_type="props.organization_type" :los="props.los" @confirm="cancelUpdate" :cluster="props.cluster" />
        </v-card>
    </v-dialog>
    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>