<script setup>
    import { ref, watch, inject, onMounted } from 'vue';

    import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
    ModuleRegistry.registerModules([AllCommunityModule]);
    import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
    import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';

    const darkTheme = themeQuartz.withPart(colorSchemeDark);
    const lightTheme = themeQuartz.withPart(colorSchemeLight);
    const globalIsDark = inject('globalIsDark');
    const currentTheme = globalIsDark?.value ? darkTheme : lightTheme;

    const currentGrid = ref(null);

    const props = defineProps({
        data: {
            type: Object,
            required: true
        },
        schema: {
            type: Object,
            required: true
        }
    });

    /**
     * Exaple data
     * [{
    "id": "81ddcf59-87b2-43e1-a5be-3c2d67bbef73",
    "dbh": 794,
    "intkey": "-18897-2-11-_bwi2022",
    "azimuth": 104,
    "plot_id": "d7b52f6e-e4bd-43c2-a803-d89de69ba1e1",
    "pruning": 0,
    "distance": 1802,
    "tree_age": 65,
    "cave_tree": false,
    "stem_form": 0,
    "dbh_height": 130,
    "bark_pocket": false,
    "damage_dead": false,
    "stand_layer": 1,
    "stem_height": null,
    "tree_height": null,
    "tree_marked": false,
    "tree_number": 11,
    "tree_status": 1,
    "damage_other": false,
    "damage_resin": false,
    "tree_species": 221,
    "within_stand": true,
    "damage_beetle": false,
    "damage_fungus": false,
    "deadwood_used": false,
    "stem_breakage": 0,
    "bark_condition": null,
    "biotope_marked": false,
    "damage_logging": false,
    "crown_dead_wood": false,
    "damage_peel_new": false,
    "damage_peel_old": false,
    "tree_top_drought": false,
    "tree_height_azimuth": null,
    "tree_height_distance": null
}]
     */

    const gridOptions = ref({
        defaultColDef: {
            flex: 1,
            minWidth: 100,
            resizable: true
        },
        columnDefs: [],
        rowData: []
    });

    function createColumnDefsFromJsonSchema(jsonSchema){
        
        if (!jsonSchema || !jsonSchema.properties) return;

        gridOptions.value.columnDefs = Object.keys(jsonSchema.properties).map(key => ({
            headerName: jsonSchema.properties[key].title || key,
            field: key,
            sortable: true,
            filter: true
        }));
    }
    function createRowDataFromData(data){
        if (!data) return [];
        return Array.isArray(data) ? data : [data];
    }

    onMounted(() => {
        createColumnDefsFromJsonSchema(props.schema);
        gridOptions.value.rowData = createRowDataFromData(props.data);
    });

    watch(() => [props.data, props.schema], (newData) => {
        // Handle data changes
        createColumnDefsFromJsonSchema(props.schema);
        gridOptions.value.rowData = [props.data];

    });
</script>


<template>
    <div class="my-4">
        <ag-grid-vue
            class="mx-4"
            ref="currentGrid"
            :gridOptions="gridOptions"
            :theme="currentTheme"
            :pagination="false"
            :rowData="gridOptions.rowData"
            :columnDefs="gridOptions.columnDefs"
            style="height: 700px"
        ></ag-grid-vue>
    </div>
</template>