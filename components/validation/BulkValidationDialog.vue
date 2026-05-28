<script setup>
    import { computed, getCurrentInstance, inject, ref, watch } from 'vue';
    import { AgGridVue } from 'ag-grid-vue3';
    import { AllCommunityModule, ModuleRegistry, TooltipModule, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
    import { AG_GRID_LOCALE_DE } from '@ag-grid-community/locale';
    import Ajv from 'ajv';
    import localize from 'ajv-i18n';

    import VersionSelection from './VersionSelection.vue';

    ModuleRegistry.registerModules([AllCommunityModule, TooltipModule]);

    const ajv = new Ajv({
        allErrors: true,
        strict: false
    });

    const validatorCache = new Map();
    let validationRunId = 0;

    const props = defineProps({
        modelValue: {
            type: Boolean,
            required: false,
            default: false
        },
        selectedIds: {
            type: Array,
            required: false,
            default: () => []
        }
    });

    const emit = defineEmits(['update:modelValue']);

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;
    const url = instance.appContext.config.globalProperties.$url;
    const apikey = instance.appContext.config.globalProperties.$apikey;

    const globalIsDark = inject('globalIsDark');
    const currentTheme = computed(() => globalIsDark?.value ? themeQuartz.withPart(colorSchemeDark) : themeQuartz.withPart(colorSchemeLight));

    const dialogModel = computed({
        get: () => props.modelValue,
        set: (value) => emit('update:modelValue', value)
    });

    const selectedVersion = ref(null);

    const records = ref([]);
    const loadingRecords = ref(false);
    const loadingVersion = ref(false);
    const isValidating = ref(false);

    const validate = ref(null);
    const tfm = ref(null);

    const validationRows = ref([]);
    const validationProgress = ref({ done: 0, total: 0 });

    const hasValidationDependencies = computed(() => !!validate.value && !!tfm.value);
    const normalizedSelectedIds = computed(() => normalizeIds(props.selectedIds));
    const progressPercent = computed(() => {
        if (!validationProgress.value.total) return 0;
        return Math.round((validationProgress.value.done / validationProgress.value.total) * 100);
    });

    const gridOptions = {
        localeText: AG_GRID_LOCALE_DE,
        suppressCellFocus: true,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            wrapText: true,
            autoHeight: true,
            tooltipValueGetter: (params) => typeof params.value === 'string' ? params.value : null
        }
    };

    const colDefs = ref([
        {
            field: 'cluster_name',
            headerName: 'Trakt',
            pinned: 'left',
            width: 110
        },
        {
            field: 'plot_name',
            headerName: 'Ecke',
            pinned: 'left',
            width: 95
        },
        {
            field: 'source',
            headerName: 'Quelle',
            width: 140
        },
        {
            field: 'severity',
            headerName: 'Level',
            width: 120,
            filter: false,
            cellRenderer: (params) => renderStatusIcon(params.value)
        },
        {
            field: 'code',
            headerName: 'Code',
            width: 160
        },
        {
            field: 'message',
            headerName: 'Fehlermeldung',
            minWidth: 520,
            flex: 1
        },
        {
            field: 'path',
            headerName: 'Pfad',
            minWidth: 260,
            flex: 1
        }
    ]);

    function sortByPlotName(a, b) {
        const aNumber = Number(a.plot_name);
        const bNumber = Number(b.plot_name);

        if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
            return aNumber - bNumber;
        }

        return `${a.plot_name ?? ''}`.localeCompare(`${b.plot_name ?? ''}`, 'de');
    }

    function normalizeIds(ids) {
        if (!Array.isArray(ids)) return [];
        return [...new Set(ids.filter((id) => id !== null && id !== undefined && id !== ''))];
    }

    function renderStatusIcon(status) {
        if (status === 'OK') {
            return '<span class="mdi mdi-check-circle" style="color:#2e7d32;"></span> OK';
        }
        if (status === 'WARNING') {
            return 'WARNUNG';
        }
        return 'FEHLER';
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function dedupeAjvErrors(rawErrors) {
        const localized = rawErrors ? [...rawErrors] : [];
        localize.de(localized);

        const seen = new Set();
        return localized.filter((err) => {
            const key = `${err.instancePath || ''}|${err.schemaPath || ''}|${err.message || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function toSchemaMessage(err) {
        const path = err.instancePath && err.instancePath.length > 0 ? err.instancePath : '/';
        return `${path}: ${err.message}`;
    }

    function toPlausibilityMessage(err) {
        const type = err?.error?.type || 'error';
        const code = err?.error?.code ? ` (${err.error.code})` : '';
        const note = err?.error?.note || '';
        const text = err?.error?.text || '';
        return `${type}${code}: ${note}${text ? ` - ${text}` : ''}`.trim();
    }

    function csvEscape(value) {
        const text = value == null ? '' : String(value);
        if (/[;"\n\r]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    function downloadCsv() {
        if (!validationRows.value.length) {
            return;
        }

        const headers = ['Trakt', 'Ecke', 'Quelle', 'Level', 'Code', 'Fehlermeldung', 'Pfad'];
        const rows = validationRows.value.map((row) => [
            row.cluster_name,
            row.plot_name,
            row.source,
            row.severity,
            row.code,
            row.message,
            row.path
        ]);

        const csvContent = [headers, ...rows]
            .map((line) => line.map(csvEscape).join(';'))
            .join('\n');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const csvUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = csvUrl;
        link.download = `bulk_validation_${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(csvUrl);
    }

    async function fetchRecordsByField(ids, fieldName) {
        const fetchedRecords = [];
        const batchSize = 100;

        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);

            const { data, error } = await supabase
                .from('records')
                .select('id, plot_id, plot_name, cluster_id, cluster_name, properties, previous_properties, schema_id_validated_by')
                .in(fieldName, batch);

            if (error) {
                console.error(`Error fetching records by ${fieldName}:`, error);
                continue;
            }

            fetchedRecords.push(...(data || []));
        }

        return fetchedRecords;
    }

    async function fetchSelectedRecords() {
        const ids = normalizedSelectedIds.value;
        if (ids.length === 0) {
            records.value = [];
            validationRows.value = [];
            return;
        }

        loadingRecords.value = true;

        try {
            let fetchedRecords = await fetchRecordsByField(ids, 'plot_id');

            // Fallback when caller passes record ids instead of plot ids.
            if (fetchedRecords.length === 0) {
                fetchedRecords = await fetchRecordsByField(ids, 'id');
            }

            records.value = fetchedRecords.sort(sortByPlotName);
        } catch (error) {
            console.error('Error fetching selected records:', error);
            records.value = [];
            validationRows.value = [];
        } finally {
            loadingRecords.value = false;
        }
    }

    async function loadValidationResources() {
        const versionDir = selectedVersion.value?.directory;
        if (!versionDir) {
            validate.value = null;
            tfm.value = null;
            loadingVersion.value = false;
            return;
        }

        if (validatorCache.has(versionDir)) {
            const cached = validatorCache.get(versionDir);
            validate.value = cached.validate;
            tfm.value = cached.tfm;
            loadingVersion.value = false;
            return;
        }

        loadingVersion.value = true;

        try {
            const [schemaResult, plausibilityResult] = await Promise.all([
                supabase.storage.from('validation').download(`${versionDir}/validation.json`),
                supabase.storage.from('validation').download(`${versionDir}/bundle.umd.js`)
            ]);

            if (schemaResult.error || plausibilityResult.error) {
                console.error('Error fetching validation resources:', schemaResult.error || plausibilityResult.error);
                return;
            }

            const schemaTxt = await schemaResult.data.text();
            const plausibilityTxt = await plausibilityResult.data.text();

            const schemaJson = JSON.parse(schemaTxt);
            const schemaItems = schemaJson.properties?.plot?.items || null;
            const compiledValidate = ajv.compile(schemaItems);

            const tfmConstructor = eval(`
${plausibilityTxt}
;(() => {
    if (typeof TFM !== 'undefined') return TFM;
    if (typeof globalThis !== 'undefined' && globalThis.TFM) return globalThis.TFM;
    if (typeof window !== 'undefined' && window.TFM) return window.TFM;
    return null;
})()
`);

            if (!tfmConstructor) {
                throw new Error('TFM constructor not found in plausibility bundle.');
            }

            const tfmInstance = new tfmConstructor(url + '/', apikey);

            validatorCache.set(versionDir, {
                validate: compiledValidate,
                tfm: tfmInstance
            });

            validate.value = compiledValidate;
            tfm.value = tfmInstance;
        } catch (error) {
            console.error('Error parsing/compiling validation resources:', error);
            validate.value = null;
            tfm.value = null;
        } finally {
            loadingVersion.value = false;
        }
    }

    async function validateRecord(record) {
        const schemaOk = validate.value(record.properties);
        const schemaErrors = dedupeAjvErrors(validate.value.errors || []);

        let plausibilityErrors = [];
        try {
            const result = await tfm.value.runPlots(
                [record.properties],
                '/plot',
                [record.previous_properties]
            );
            plausibilityErrors = Array.isArray(result) ? result : [];
        } catch (error) {
            plausibilityErrors = [{
                error: {
                    type: 'error',
                    code: 'runtime',
                    note: 'Plausibility execution failed',
                    text: error?.message || 'Unknown error'
                }
            }];
        }

        const baseData = {
            cluster_name: record.cluster_name || '-',
            plot_name: record.plot_name || '-'
        };

        const schemaRows = schemaErrors.map((err, index) => ({
            id: `${record.id}_schema_${index}`,
            ...baseData,
            source: 'Validierung',
            severity: 'ERROR',
            code: err.keyword || '-',
            message: toSchemaMessage(err),
            path: err.instancePath || '/'
        }));

        const plausibilityRows = plausibilityErrors.map((err, index) => ({
            id: `${record.id}_plausibility_${index}`,
            ...baseData,
            source: 'Plausibilitaet',
            severity: err?.error?.type === 'error' ? 'ERROR' : 'WARNING',
            code: err?.error?.code || '-',
            message: toPlausibilityMessage(err),
            path: err?.instancePath || '/'
        }));

        if (schemaOk && schemaRows.length === 0 && plausibilityRows.length === 0) {
            return [{
                id: `${record.id}_ok`,
                ...baseData,
                source: 'Validierung',
                severity: 'OK',
                code: '-',
                message: 'Keine Fehler',
                path: '/'
            }];
        }

        return [...schemaRows, ...plausibilityRows];
    }

    async function runBulkValidation() {
        if (!props.modelValue || !hasValidationDependencies.value || records.value.length === 0) {
            validationRows.value = [];
            validationProgress.value = { done: 0, total: 0 };
            return;
        }

        const runId = ++validationRunId;
        isValidating.value = true;
        validationRows.value = [];
        validationProgress.value = { done: 0, total: records.value.length };

        const nextRows = [];
        let processedRecords = 0;
        for (const record of records.value) {
            const recordRows = await validateRecord(record);

            if (runId !== validationRunId) {
                isValidating.value = false;
                return;
            }

            nextRows.push(...recordRows);
            processedRecords += 1;
            validationRows.value = [...nextRows];
            validationProgress.value = {
                done: processedRecords,
                total: records.value.length
            };
        }

        if (runId === validationRunId) {
            isValidating.value = false;
        }
    }

    watch(selectedVersion, () => {
        loadValidationResources();
    }, { immediate: true });

    watch(() => props.modelValue, async (isOpen) => {
        if (!isOpen) return;
        await fetchSelectedRecords();
    });

    watch(() => props.selectedIds, async () => {
        if (!props.modelValue) return;
        await fetchSelectedRecords();
    }, { deep: true });

    watch([records, validate, tfm, () => props.modelValue], async ([nextRecords, nextValidate, nextTfm, isOpen]) => {
        if (!isOpen) return;
        if (!nextRecords.length || !nextValidate || !nextTfm) {
            validationRows.value = [];
            validationProgress.value = { done: 0, total: 0 };
            return;
        }
        await runBulkValidation();
    });
</script>

<template>
    <v-dialog v-model="dialogModel" max-width="1500" scrollable>
        <v-card>
            <v-toolbar flat density="comfortable">
                <v-toolbar-title>Bulk Validation</v-toolbar-title>
                <template v-slot:append>
                    <v-btn icon="mdi-close" variant="text" @click="dialogModel = false" />
                </template>
            </v-toolbar>

            <v-card-text>
                <div class="d-flex flex-wrap ga-3 align-center mb-4">
                    <VersionSelection
                        v-model="selectedVersion"
                        :is_loading="loadingVersion"
                        :key="'bulk_validation_' + (records[0]?.id || 'none')"
                    />
                    <v-btn
                        class="ms-auto"
                        variant="tonal"
                        prepend-icon="mdi-download"
                        :disabled="!validationRows.length || isValidating"
                        @click="downloadCsv"
                    >
                        CSV herunterladen
                    </v-btn>
                </div>

                <v-alert
                    v-if="normalizedSelectedIds.length === 0"
                    type="warning"
                    variant="tonal"
                    class="mb-3"
                    text="Keine IDs ausgewaehlt."
                />

                <v-progress-linear
                    v-if="loadingRecords || loadingVersion"
                    indeterminate
                    color="primary"
                    class="mb-3"
                />

                <v-alert
                    v-if="!loadingRecords && normalizedSelectedIds.length > 0 && records.length === 0"
                    type="warning"
                    variant="tonal"
                    class="mb-3"
                    text="Keine passenden Datensaetze fuer die ausgewaehlten IDs gefunden."
                />

                <v-alert
                    v-if="records.length > 0 && !loadingVersion && !hasValidationDependencies"
                    type="info"
                    variant="tonal"
                    class="mb-3"
                    text="Bitte eine Version auswaehlen, um die Validierung zu starten."
                />

                <div v-if="isValidating" class="mb-2 text-caption">
                    Validiere {{ validationProgress.done }} / {{ validationProgress.total }}
                </div>

                <v-progress-linear
                    v-if="isValidating"
                    :model-value="progressPercent"
                    color="warning"
                    class="mb-3"
                />

                <ag-grid-vue
                    v-if="records.length > 0 && hasValidationDependencies"
                    :gridOptions="gridOptions"
                    :columnDefs="colDefs"
                    :rowData="validationRows"
                    :theme="currentTheme"
                    style="height: 580px; width: 100%;"
                />
            </v-card-text>
        </v-card>
    </v-dialog>
</template>
