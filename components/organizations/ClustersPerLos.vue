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

    import { useDatabase } from '../../.vitepress/theme/composables/useDatabase'
    const { waitForDb } = useDatabase()

    const rowData = ref([]);
    let powerSyncDB = ref(null); 
    let loading = ref(true);
    let currentGrid = ref(null);
    let selectedRows = ref([]);

    // props 
    const props = defineProps({
        records_Ids: {
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
        }
        //{ field: "more", headerName: "Details", pinned: 'right', width: 50 },
    ]);


    async function fetchRecords(ListOfRecordIds) {
        try {
            let first100 = ListOfRecordIds.slice(0, 100000000);
            //console.log(first100);
            // Ensure the array is passed as individual values
            const query = `SELECT * FROM records WHERE cluster_id IN (${first100.map(() => '?').join(', ')}) GROUP BY cluster_id`;
            const params = first100;

            //console.log('Executing query:', query, 'with params:', params);
            const result = await powerSyncDB.getAll(query, params);
            rowData.value = result;
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            loading.value = false;
        }
    }
    function onCellClicked(event) {
        console.log('Cell clicked:', event);
        // You can handle cell click events here if needed
    }
    function onSelectionChanged(event) {
        selectedRows.value = event.api.getSelectedRows();
        // Perform actions based on the selected rows
    }

    onMounted(async () => {
        loading.value = true;
        powerSyncDB = await waitForDb();
        await fetchRecords(props.records_Ids);
        loading.value = false;

    });
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
                prepend-icon="mdi-file-download"
                @click="currentGrid.api.exportDataAsCsv()"
                rounded="xl"
            >
            .csv
            </v-btn>
            <v-btn
            class="ma-2"
                variant="tonal"
                rounded="xl"
                @click="currentGrid.api.deselectAll()"
                append-icon="mdi-delete"
            >
                remove
            </v-btn>
        </div>
    </div>
    <div v-else class="text-center ma-11">
        <v-progress-circular
            indeterminate
            color="primary"
            size="40"
            width="3"
        ></v-progress-circular>
        <p>Loading records...</p>
    </div>
</template>