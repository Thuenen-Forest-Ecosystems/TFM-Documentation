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
        }
    });

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
            //type: "number",
            pinned: 'left'
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
        }
    ]);


    async function fetchRecords(losId) {
        console.log('Fetching records for LOS ID:', losId);
        try {
            // Limit to reasonable batch size to avoid performance issues

            if (!losId) {
                rowData.value = [];
                return;
            }
            console.log('Fetching records for LOS ID:', losId);
            console.log('request database for records');
            const {data:records, error} = await supabase
                .from('records')
                .select('cluster_id, cluster_name, plot_name, responsible_troop, responsible_provider, responsible_state')
                .eq('administration_los', losId);
            
            if (error) {
                console.error('Error fetching records:', error);
                rowData.value = [];
                return;
            }
            rowData.value = records;
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
        try{
            deleting.value = true;
            for (let i = 0; i < uniqueClusterIds.length; i += bulkSize) {
                const batch = uniqueClusterIds.slice(i, i + bulkSize);
                // Use Supabase to update the records
                const {data, error} = await supabase.from('records').update({administration_los: null}).in('cluster_id', batch);
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
        >
            Cluster hinzufügen
        </v-btn>
    </v-card-actions>
    <v-dialog fullscreen scrollable v-model="addClusterDialog" max-width="500" @click:outside="cancelAction">
        <v-card>
            <v-toolbar>
                <v-toolbar-title>Noch nicht zugewiesene Cluster</v-toolbar-title>
                <v-btn icon="mdi-close" variant="text" @click="cancelAction"></v-btn>
            </v-toolbar>
            
            <ListOfClusterRecord :organization_id="props.organization_id" :organization_type="props.organization_type" :los="props.los" @confirm="cancelUpdate" />
        </v-card>
    </v-dialog>
</template>