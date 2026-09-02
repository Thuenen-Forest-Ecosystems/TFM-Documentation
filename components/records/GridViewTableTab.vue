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
        gridHeight: {
            type: Number,
            default: 700
        },
        // Column list from style-map datagrid item: ordered array of
        // {name, pinned, display, columnGroupShow, ...} / {type: 'group', label, items}
        // or the dict form {fieldName: config}. Defines column order, grouping and
        // visibility; the schema still supplies titles, enums, units and formatting.
        styleColumns: {
            type: [Array, Object],
            default: null
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

    function getValidationMessage(err) {
        return err?.message || null;
    }

    function getValidationNote(err) {
        return err?.savedNote || err?.note || err?.rawError?.note || null;
    }

    function getPlausibilityType(err) {
        return err?.error?.type || err?.type || err?.rawError?.type || 'error';
    }

    function getPlausibilityMessage(err) {
        return err?.error?.text || err?.message || null;
    }

    function getPlausibilityNote(err) {
        return err?.savedNote || err?.note || err?.rawError?.note || err?.error?.note || null;
    }

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
    // Base column definition for a schema property: title, formatting, error styling.
    // Shared by the schema-driven and the style-map-driven column builders.
    function createBaseColDef(key, property) {
        const formConfig = property?.$tfm?.form || {};

        // Check if the field should be hidden
        const hide = formConfig?.['ui:options']?.display === false;

        // Check if the property has an enum and a corresponding name_de
        const hasEnum = Array.isArray(property.enum);
        const hasNameDe = property?.$tfm?.name_de && Array.isArray(property.$tfm.name_de);

        // Check if the property has a unit_short
        const unitShort = property?.$tfm?.unit_short;

        // Get pinned configuration
        const pinned = formConfig?.['ui:options']?.pinned || null;

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
            }
        };
    }

    function createColumnDefsFromJsonSchema(jsonSchema) {

        if (!jsonSchema || !jsonSchema.properties) return;

        // First, create column definitions with metadata
        const columns = Object.keys(jsonSchema.properties).map((key, index) => {
            const property = jsonSchema.properties[key];
            const formConfig = property?.$tfm?.form || {};

            // Get sortBy for ordering - if not specified, use large number + schema index to preserve order
            const hasSortBy = formConfig?.sortBy !== undefined;
            const sortBy = hasSortBy ? formConfig.sortBy : 10000 + index;

            return {
                ...createBaseColDef(key, property),
                // Metadata for processing
                _sortBy: sortBy,
                _groupBy: formConfig?.groupBy || null
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
                // Translate TFM semantics ('open' = always visible, unset = only when
                // expanded) to AG Grid's (unset = always visible, 'open' = only when expanded)
                const groupShow = toAgGroupShow(col._groupBy.columnGroupShow);
                if (groupShow) {
                    col.columnGroupShow = groupShow;
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

        gridOptions.value.columnDefs = [createErrorIndicatorCol(), ...dataCols];
    }

    // TFM config semantics for columnGroupShow are the reverse of AG Grid's:
    // TFM 'open' = always visible, unset = only visible while the group is expanded;
    // AG Grid unset = always visible, 'open' = only visible while expanded.
    function toAgGroupShow(tfmValue) {
        if (tfmValue === 'open') return undefined;
        if (tfmValue) return tfmValue;
        return 'open';
    }

    // Normalize both style-map column shapes to an ordered array:
    // array form [{name, ...}, {type: 'group', ...}] stays as-is,
    // dict form {fieldName: config} becomes [{name: fieldName, ...config}]
    // (object key order is preserved and defines the column order).
    function normalizeStyleColumns(styleColumns) {
        if (Array.isArray(styleColumns)) return styleColumns;
        if (styleColumns && typeof styleColumns === 'object') {
            return Object.entries(styleColumns).map(([name, config]) => ({ name, ...(config || {}) }));
        }
        return [];
    }

    // Compiled `expression` functions of calculated columns, keyed by expression
    // and variable list so each one is parsed only once per session.
    const calculatedExpressions = new Map();

    // Turn a style-map `expression` into a function of its declared variables.
    // Only identifiers, numbers, arithmetic and parentheses are accepted: the
    // tokenizer drops everything else, so a rebuilt string that no longer equals
    // the original means the expression contains something we refuse to run.
    function compileExpression(expression, variableNames) {
        const cacheKey = `${expression}||${variableNames.join(',')}`;
        if (calculatedExpressions.has(cacheKey)) return calculatedExpressions.get(cacheKey);

        let fn = null;
        const tokens = expression.match(/[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?|[+\-*/()]|\s+/g) || [];
        const isSafe = tokens.join('') === expression
            && tokens.filter(t => /^[A-Za-z_$]/.test(t)).every(t => variableNames.includes(t));
        if (isSafe) {
            try {
                fn = new Function(...variableNames, `"use strict"; return (${expression});`);
            } catch (error) {
                fn = null;
            }
        }
        calculatedExpressions.set(cacheKey, fn);
        return fn;
    }

    // Calculated columns exist only in the style-map — they have no stored value
    // and are computed per row from `expression` over `variables`. Only
    // `currentData` variables work here; this view has no previous-inventory row,
    // and `calculatedFunction` columns need app-side code we do not have.
    function createCalculatedColDef(item) {
        const key = item.name;
        const variables = Array.isArray(item.variables) ? item.variables : [];
        if (!item.expression || variables.length === 0) return null;
        if (variables.some(variable => variable?.source !== 'currentData')) return null;

        const variableNames = variables.map(variable => variable?.name).filter(Boolean);
        const evaluate = compileExpression(item.expression, variableNames);
        if (!evaluate) {
            console.warn(`Unsupported calculated expression for column "${key}":`, item.expression);
            return null;
        }

        return {
            headerName: item.title || key,
            colId: key,
            sortable: true,
            filter: true,
            cellClass: 'ag-right-aligned-cell',
            headerTooltip: item.expression,
            valueGetter: params => {
                if (!params.data) return null;
                const values = variableNames.map(name => params.data[name]);
                // A missing input makes the whole result meaningless — show nothing
                if (values.some(value => value === null || value === undefined || value === '')) return null;
                const numbers = values.map(Number);
                if (numbers.some(number => Number.isNaN(number))) return null;

                const result = evaluate(...numbers);
                if (typeof result !== 'number' || !Number.isFinite(result)) return null;
                return Math.round(result * 100) / 100;
            },
            valueFormatter: params => {
                if (params.value === null || params.value === undefined) return '';
                return item.unit_short ? `${params.value} ${item.unit_short}` : `${params.value}`;
            }
        };
    }

    function createColDefFromStyleItem(item, jsonSchema) {
        const key = item?.name;
        if (!key) return null;
        const property = jsonSchema?.properties?.[key];
        // Columns without a schema property are either calculated (computed per row
        // from the style-map) or have no stored value to show at all.
        const col = property
            ? createBaseColDef(key, property)
            : (item.type === 'calculated' ? createCalculatedColDef(item) : null);
        if (!col) return null;

        if (item.display === false) col.hide = true;
        if (item.pinned) col.pinned = item.pinned === true ? 'left' : item.pinned;
        if (item.width) col.width = item.width;
        return col;
    }

    // Build column definitions in the order defined by the style-map's column list.
    // Returns [] when no usable style columns exist so callers can fall back to the schema.
    function createColumnDefsFromStyleColumns(styleColumns, jsonSchema) {
        const defs = [];
        for (const item of normalizeStyleColumns(styleColumns)) {
            if (item?.type === 'group') {
                const children = (item.items || [])
                    .map(child => {
                        const col = createColDefFromStyleItem(child, jsonSchema);
                        if (!col) return null;
                        const groupShow = toAgGroupShow(child.columnGroupShow);
                        if (groupShow) col.columnGroupShow = groupShow;
                        return col;
                    })
                    .filter(Boolean);
                if (children.length === 0) continue;

                // Keep at least one column visible while collapsed so the group
                // is openable and always has visible content
                if (!children.some(col => !col.columnGroupShow)) {
                    delete children[0].columnGroupShow;
                }

                const group = {
                    headerName: item.label || '',
                    children,
                    marryChildren: true, // Keep group header when columns are moved
                    openByDefault: false // Groups are collapsed by default
                };
                // If any child is pinned, pin the entire group
                const pinnedChild = children.find(col => col.pinned);
                if (pinnedChild) {
                    group.pinned = pinnedChild.pinned;
                    children.forEach(col => { col.pinned = pinnedChild.pinned; });
                }
                defs.push(group);
            } else {
                const col = createColDefFromStyleItem(item, jsonSchema);
                if (col) defs.push(col);
            }
        }
        return defs;
    }

    // Style-map columns define order and visibility when provided; otherwise the schema does
    function rebuildColumnDefs() {
        const styleDefs = createColumnDefsFromStyleColumns(props.styleColumns, props.schema);
        if (styleDefs.length > 0) {
            gridOptions.value.columnDefs = [createErrorIndicatorCol(), ...styleDefs];
        } else {
            createColumnDefsFromJsonSchema(props.schema);
        }
    }

    // Pinned error-indicator column — click opens a dialog with all error messages
    function createErrorIndicatorCol() {
        return {
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
                if (params.data?._errorTooltip || (params.data?._errorDetails?.length || 0) > 0) {
                    errorDialogMessages.value = (params.data?._errorDetails || []).length > 0
                        ? params.data._errorDetails
                        : params.data._errorTooltip.split('\n').map(msg => ({
                            text: msg.replace(/^Notiz:\s*/, ''),
                            isNote: /^Notiz:\s*/.test(msg)
                        }));
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
    }
    function createRowDataFromData(data){
        if (!data) return [];
        const rows = Array.isArray(data) ? data : [data];
        const errMap = rowErrorMap.value;
        const prefix = props.propertyName ? `/${props.propertyName}/` : '/';

        // Build per-row dialog entries (deduplicated)
        const detailMap = {};
        function addDetail(rowIdx, text, kind = 'message') {
            if (!text) return;
            const rowKey = String(rowIdx);
            const list = (detailMap[rowKey] ??= []);
            const alreadyThere = list.some(item => item.kind === kind && item.text === text);
            if (!alreadyThere) list.push({ kind, text });
        }

        for (const err of props.validationErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const rowIdx = rest.split('/')[0];
            if (!rowIdx) continue;
            const msg = getValidationMessage(err);
            const note = getValidationNote(err);
            addDetail(rowIdx, msg, 'message');
            if (note && note !== msg) addDetail(rowIdx, note, 'note');
        }

        for (const err of props.plausibilityErrors) {
            const p = err.instancePath || '';
            const rest = props.propertyName ? p.replace(prefix, '') : p.replace(/^\//, '');
            const rowIdx = rest.split('/')[0];
            if (!rowIdx) continue;
            const msg = getPlausibilityMessage(err);
            const note = getPlausibilityNote(err);
            addDetail(rowIdx, msg, 'message');
            if (note && note !== msg) addDetail(rowIdx, note, 'note');
        }

        return rows.map((row, index) => {
            const idxStr = String(index);
            const details = detailMap[idxStr] || [];
            return {
                ...row,
                _errorIndicator: errMap[idxStr]?.hasError ? 'error' : errMap[idxStr]?.hasWarning ? 'warning' : null,
                _errorTooltip: details.length
                    ? details.map(item => item.kind === 'note' ? `Notiz: ${item.text}` : item.text).join('\n')
                    : null,
                _errorDetails: details.map(item => ({ text: item.text, isNote: item.kind === 'note' }))
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
            if (rowIdx !== '') addEntry(rowIdx, getPlausibilityType(err) === 'error');
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
            if (parts.length >= 2) addEntry(parts[0], parts[1], getPlausibilityType(err) === 'error');
        }
        return map;
    });

    onMounted(() => {

        rebuildColumnDefs();
        gridOptions.value.rowData = createRowDataFromData(props.data);

        // Auto-size all columns after the grid is ready
        nextTick(() => {
            currentGrid.value.api.sizeColumnsToFit();
        });
    });

    // Rebuild columns and row data when schema, style columns or data change
    watch(() => [props.data, props.schema, props.styleColumns], () => {
        rebuildColumnDefs();
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
            :style="{ height: `${props.gridHeight}px` }"
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
                    <div v-for="(msg, i) in errorDialogMessages" :key="i" class="mb-2">
                        <div v-if="msg.isNote" class="error-note">
                            <span class="error-note-label">Notiz:</span>
                            <span>{{ msg.text }}</span>
                        </div>
                        <div v-else>{{ msg.text }}</div>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn @click="errorDialogOpen = false">Schließen</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
    .error-note {
        padding: 6px 8px;
        border-radius: 6px;
        border-left: 3px solid rgb(var(--v-theme-warning));
        background-color: rgba(var(--v-theme-warning), 0.16);
        color: rgba(var(--v-theme-on-surface), 0.95);
        line-height: 1.35;
    }

    .error-note-label {
        font-weight: 700;
        margin-right: 4px;
    }
</style>