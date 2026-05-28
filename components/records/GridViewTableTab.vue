<script setup>
    import { ref, watch, inject, onMounted, nextTick, computed } from 'vue';

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
        },
        propertyName: {
            type: String,
            default: ''
        },
        validationErrors: {
            type: Array,
            default: () => []
        },
        plausibilityErrors: {
            type: Array,
            default: () => []
        },
    });

    const gridOptions = ref({
        autoSizeStrategy: {
            type: 'fitCellContents',
            skipHeader: false
        },
        defaultColDef: {
            minWidth: 100,
            resizable: true,
            suppressMovable: true,
            wrapHeaderText: false,
            autoHeaderHeight: false
        },
        columnDefs: [],
        rowData: [],
    });

    const errorDialogOpen = ref(false);
    const errorDialogMessages = ref([]);
    const errorDialogType = ref('error');

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

            // Check if the property is numeric (number or integer) but not an enum
            const isNumeric = !hasEnum && (property.type === 'number' || property.type === 'integer' || 
                (Array.isArray(property.type) && (property.type.includes('number') || property.type.includes('integer'))));

            return {
                headerName: property.title || key,
                field: key,
                sortable: true,
                filter: true,
                hide, // Set hide to true if display is false
                pinned, // AG Grid supports 'left' or 'right'
                headerTooltip: property.description || '', // Add tooltip if description exists
                cellClass: isNumeric ? 'ag-right-aligned-cell' : '',
                cellStyle: params => {
                    const k = `${params.rowIndex}_${key}`;
                    const cell = cellErrorMap.value[k];
                    if (!cell) return null;
                    if (cell.hasError) return { backgroundColor: 'rgba(239,83,80,0.15)', borderLeft: '3px solid #ef5350' };
                    if (cell.hasWarning) return { backgroundColor: 'rgba(255,167,38,0.15)', borderLeft: '3px solid #ffa726' };
                    return null;
                },
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
                        value = `${params.value} | ${value}`;
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
        const dataCols = [...ungroupedWithSort, ...sortedGroups, ...ungroupedWithoutSort];

        // Prepend pinned error-indicator column — click opens a dialog with all error messages
        const errorIndicatorCol = {
            headerName: '',
            field: '_errorIndicator',
            width: 40,
            minWidth: 40,
            maxWidth: 40,
            pinned: 'left',
            sortable: false,
            filter: false,
            resizable: false,
            suppressMovable: true,
            suppressSizeToFit: true,
            suppressAutoSize: true,
            onCellClicked: params => {
                if (params.data?._errorTooltip) {
                    errorDialogMessages.value = params.data._errorTooltip.split('\n');
                    errorDialogType.value = params.data._errorIndicator;
                    errorDialogOpen.value = true;
                }
            },
            cellRenderer: params => {
                if (!params.value) return '';
                const color = params.value === 'error' ? '#ef5350' : '#ffa726';
                return `<div style="display:flex;align-items:center;justify-content:center;height:100%;cursor:pointer;"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="${color}"/></svg></div>`;
            }
        };

        gridOptions.value.columnDefs = [errorIndicatorCol, ...dataCols];
    }
    function createRowDataFromData(data){
        if (!data) return [];
        const rows = Array.isArray(data) ? data : [data];
        const errMap = rowErrorMap.value;
        const prefix = props.propertyName ? `/${props.propertyName}/` : '/';

        // Build per-row tooltip messages (deduplicated)
        const tooltipMap = {};
        for (const err of props.validationErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const rowIdx = rest.split('/')[0];
            if (!rowIdx) continue;
            const msg = err.message;
            if (msg) (tooltipMap[rowIdx] ??= new Set()).add(msg);
        }
        for (const err of props.plausibilityErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const rowIdx = rest.split('/')[0];
            if (!rowIdx) continue;
            const msg = err.error?.text || err.error?.note;
            if (msg) (tooltipMap[rowIdx] ??= new Set()).add(msg);
        }

        return rows.map((row, index) => {
            const idxStr = String(index);
            const msgs = tooltipMap[idxStr];
            return {
                ...row,
                _errorIndicator: errMap[idxStr]?.hasError ? 'error' : errMap[idxStr]?.hasWarning ? 'warning' : null,
                _errorTooltip: msgs?.size ? [...msgs].join('\n') : null
            };
        });
    }

    // Reactive row error map: { '${rowIdx}': { hasError, hasWarning } }
    const rowErrorMap = computed(() => {
        const map = {};
        function addEntry(rowIdx, isError) {
            if (!map[rowIdx]) map[rowIdx] = { hasError: false, hasWarning: false };
            if (isError) map[rowIdx].hasError = true;
            else map[rowIdx].hasWarning = true;
        }
        const prefix = props.propertyName ? `/${props.propertyName}/` : '/';
        for (const err of props.validationErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const rowIdx = rest.split('/')[0];
            if (rowIdx !== '') addEntry(rowIdx, true);
        }
        for (const err of props.plausibilityErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const rowIdx = rest.split('/')[0];
            if (rowIdx !== '') addEntry(rowIdx, err.error?.type === 'error');
        }
        return map;
    });

    // Reactive cell error map: { '${rowIdx}_${field}': { hasError, hasWarning } }
    const cellErrorMap = computed(() => {
        const map = {};
        function addEntry(rowIdx, field, isError) {
            const k = `${rowIdx}_${field}`;
            if (!map[k]) map[k] = { hasError: false, hasWarning: false };
            if (isError) map[k].hasError = true;
            else map[k].hasWarning = true;
        }
        const prefix = props.propertyName ? `/${props.propertyName}/` : '/';
        for (const err of props.validationErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const parts = rest.split('/');
            if (parts.length >= 2) addEntry(parts[0], parts[1], true);
        }
        for (const err of props.plausibilityErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const parts = rest.split('/');
            if (parts.length >= 2) addEntry(parts[0], parts[1], err.error?.type === 'error');
        }
        return map;
    });

    onMounted(() => {
       
        createColumnDefsFromJsonSchema(props.schema);
        gridOptions.value.rowData = createRowDataFromData(props.data);

        // Auto-size all columns after the grid is ready
        nextTick(() => {
            currentGrid.value.api.sizeColumnsToFit();
        });
    });

    // Rebuild columns and row data when schema or data changes
    watch(() => [props.data, props.schema], () => {
        createColumnDefsFromJsonSchema(props.schema);
        gridOptions.value.rowData = createRowDataFromData(props.data);
        nextTick(() => {
            currentGrid.value?.api?.sizeColumnsToFit();
        });
    });

    // Rebuild rowData (embeds _errorIndicator) and re-evaluate cellStyle when errors change
    watch(() => [props.validationErrors, props.plausibilityErrors], () => {
        gridOptions.value.rowData = createRowDataFromData(props.data);
        nextTick(() => {
            currentGrid.value?.api?.refreshCells({ force: true });
        });
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

        <v-dialog v-model="errorDialogOpen" max-width="520">
            <v-card>
                <v-card-title class="d-flex align-center gap-2">
                    <v-icon :color="errorDialogType === 'error' ? 'error' : 'warning'" class="mr-2">
                        {{ errorDialogType === 'error' ? 'mdi-alert-circle' : 'mdi-alert' }}
                    </v-icon>
                    {{ errorDialogType === 'error' ? 'Fehler' : 'Warnung' }}
                </v-card-title>
                <v-card-text>
                    <div v-for="(msg, i) in errorDialogMessages" :key="i" class="mb-1">{{ msg }}</div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="errorDialogOpen = false">Schließen</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>