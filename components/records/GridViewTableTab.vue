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
            minWidth: 100,
            resizable: true,
            suppressMovable: true
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

        // First, create column definitions with metadata
        const columns = Object.keys(jsonSchema.properties).map((key, index) => {
            const property = jsonSchema.properties[key];
            const formConfig = property?.$tfm?.form || {};
            
            console.log('Mounted GridViewTableTab with data:', formConfig);
            // Check if the field should be hidden
            const hide = formConfig?.['ui:options']?.display === false;

            // Check if the property has an enum and a corresponding name_de
            const hasEnum = Array.isArray(property.enum);
            const hasNameDe = property?.$tfm?.name_de && Array.isArray(property.$tfm.name_de);

            // Check if the property has a unit_short
            const unitShort = property?.$tfm?.unit_short;

            // Get pinned configuration
            const pinned = formConfig?.['ui:options']?.pinned || null;

            // Get sortBy for ordering - if not specified, use large number + schema index to preserve order
            const hasSortBy = formConfig?.sortBy !== undefined;
            const sortBy = hasSortBy ? formConfig.sortBy : 10000 + index;

            // Get groupBy configuration
            const groupBy = formConfig?.groupBy || null;

            return {
                headerName: property.title || key,
                field: key,
                sortable: true,
                filter: true,
                hide, // Set hide to true if display is false
                pinned, // AG Grid supports 'left' or 'right'
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
                },
                // Metadata for processing
                _sortBy: sortBy,
                _groupBy: groupBy
            };
        });

        // Group columns if they have groupBy configuration
        const grouped = {};
        const ungrouped = [];

        columns.forEach(col => {
            if (col._groupBy) {
                const groupName = col._groupBy.headerName || 'Group';
                if (!grouped[groupName]) {
                    grouped[groupName] = {
                        headerName: groupName,
                        children: [],
                        _groupSortBy: col._groupBy.sortBy ?? Infinity,
                        marryChildren: true, // Keep group header when columns are moved
                        pinned: null, // Will be set if any child is pinned
                        openByDefault: false // Groups are collapsed by default
                    };
                }
                // If this column is pinned, pin the entire group
                if (col.pinned) {
                    grouped[groupName].pinned = col.pinned;
                }
                // Get columnGroupShow from schema - don't set a default
                // undefined = always visible, 'open' = only when expanded, 'closed' = only when collapsed
                if (col._groupBy.columnGroupShow) {
                    col.columnGroupShow = col._groupBy.columnGroupShow;
                }
                grouped[groupName].children.push(col);
            } else {
                ungrouped.push(col);
            }
        });

        // Sort children within each group by their sortBy
        Object.values(grouped).forEach(group => {
            group.children.sort((a, b) => a._sortBy - b._sortBy);
            
            // If group is pinned, ensure all children are pinned the same way
            if (group.pinned) {
                group.children.forEach(col => {
                    col.pinned = group.pinned;
                });
            }
            
            // Handle columnGroupShow for collapsed groups
            // Note: 'closed' = visible only when collapsed, 'open' = visible only when expanded
            // No property = always visible (recommended for most cases)
            // By default, all columns should be always visible unless explicitly set in schema
            const hasAlwaysVisibleColumn = group.children.some(col => !col.columnGroupShow);
            
            // If ALL columns have explicit 'open' or 'closed', make first column always visible
            // This ensures the group is always openable and has visible content
            if (!hasAlwaysVisibleColumn && group.children.length > 0) {
                delete group.children[0].columnGroupShow;
            }
            
            // Clean up metadata
            group.children.forEach(col => {
                delete col._sortBy;
                delete col._groupBy;
            });
        });

        // Sort ungrouped columns by sortBy
        ungrouped.sort((a, b) => a._sortBy - b._sortBy);
        
        // Separate ungrouped into those with sortBy and those without BEFORE cleaning metadata
        const ungroupedWithSort = ungrouped.filter(col => col._sortBy < 10000);
        const ungroupedWithoutSort = ungrouped.filter(col => col._sortBy >= 10000);
        
        // Clean up metadata from ungrouped columns
        ungrouped.forEach(col => {
            delete col._sortBy;
            delete col._groupBy;
        });

        // Sort groups by their groupSortBy
        const sortedGroups = Object.values(grouped).sort((a, b) => a._groupSortBy - b._groupSortBy);
        sortedGroups.forEach(group => {
            delete group._groupSortBy;
        });

        // Combine: columns with sortBy, then grouped columns, then columns without sortBy
        gridOptions.value.columnDefs = [...ungroupedWithSort, ...sortedGroups, ...ungroupedWithoutSort];
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