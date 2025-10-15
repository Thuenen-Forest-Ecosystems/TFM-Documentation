<script setup>
    import { ref, watch, inject, onMounted, nextTick } from 'vue';

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
            required: false
        },
        schema: {
            type: Object,
            required: true
        }
    });

    const gridOptions = ref({
        autoSizeStrategy: {
            type: 'fitCellContents',
            skipHeader: false
        },
        defaultColDef: {
            flex: 1,
            minWidth: 100,
            resizable: true
        },
        columnDefs: [],
        rowData: []
    });

    /*function createColumnDefsFromJsonSchema(jsonSchema){
        
        if (!jsonSchema || !jsonSchema.properties) return;

        gridOptions.value.columnDefs = Object.keys(jsonSchema.properties).map(key => {
            const property = jsonSchema.properties[key];

            // Check if the field should be hidden
            const hide = property?.$tfm?.form?.['ui:options']?.display === false;

            return {
                headerName: property.title || key,
                field: key,
                sortable: true,
                filter: true,
                hide // Set hide to true if display is false
            };
        });
    }*/
    function createColumnDefsFromJsonSchema(jsonSchema) {
        if (!jsonSchema || !jsonSchema.properties) return;

        gridOptions.value.columnDefs = Object.keys(jsonSchema.properties).map(key => {
            const property = jsonSchema.properties[key];

            // Check if the field should be hidden
            const hide = property?.$tfm?.form?.['ui:options']?.display === false;

            // Check if the property has an enum and a corresponding name_de
            const hasEnum = Array.isArray(property.enum);
            const hasNameDe = property?.$tfm?.name_de && Array.isArray(property.$tfm.name_de);

            // Check if the property has a unit_short
            const unitShort = property?.$tfm?.unit_short;

            return {
                headerName: property.title || key,
                field: key,
                sortable: true,
                filter: false,
                hide, // Set hide to true if display is false
                headerTooltip: property.description || '', // Add tooltip if description exists
                valueFormatter: params => {
                    let value = params.value;

                    // If the property has an enum and name_de, map the value
                    if (hasEnum && hasNameDe) {
                        const index = property.enum.indexOf(params.value);
                        value = index !== -1 ? property.$tfm.name_de[index] : params.value;
                    }

                    // Append unit_short if it exists
                    if (unitShort) {
                        value = `${value} ${unitShort}`;
                    }

                    // Append raw value in parentheses if different from displayed value
                    if (hasEnum && hasNameDe && property.enum.includes(params.value) && value !== params.value) {
                        value = `${value} (${params.value})`;
                    }

                    return value;
                }
            };
        });
    }
    function createRowDataFromData(data){
        if (!data) return [];
        return Array.isArray(data) ? data : [data];
    }

    onMounted(() => {
        createColumnDefsFromJsonSchema(props.schema);
        gridOptions.value.rowData = createRowDataFromData(props.data);

        // Auto-size all columns after the grid is ready
        nextTick(() => {
            currentGrid.value.api.sizeColumnsToFit();
        });
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