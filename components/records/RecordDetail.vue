<script setup>
    import { ref, computed, watch, getCurrentInstance } from 'vue';
    import JsonViewer from './JsonViewer.vue';
    import GridView from './GridView.vue';
    import PositionMap from './PositionMap.vue';
    import RecordMessages from './RecordMessages.vue';
    import TabErrorsDialog from './TabErrorsDialog.vue';
    import VersionSelection from '../validation/VersionSelection.vue';
    import Ajv from 'ajv';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;
    const url = instance.appContext.config.globalProperties.$url;
    const apikey = instance.appContext.config.globalProperties.$apikey;

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validatorCache = new Map();

    const selectedVersion = ref(null);
    const loadingVersion = ref(false);
    const internalSchema = ref(null);
    const internalValidate = ref(null);
    const internalTfm = ref(null);
    const internalStyleMap = ref(null);

    const dataTab = ref('CI2027');
    const contentTab = ref(null);

    const props = defineProps({
        record: {
            type: Object,
            required: true
        },
        records: {
            type: Array,
            required: false,
            default: () => []
        },
        schema: {
            type: Object,
            required: false,
            default: null
        },
        styleMap: {
            type: Object,
            required: false,
            default: null
        },
        validate: {
            type: Function,
            required: false,
            default: null
        },
        tfm: {
            type: Object,
            required: false,
            default: null
        }
    });

    const toggleDataView = ref(0);

    const schema = computed(() => {
        if (internalSchema.value) return internalSchema.value;
        if (props.schema) return props.schema;
        if (props.record?.tfm?.schema) return props.record.tfm.schema;
        return null;
    });

    const currentData = computed(() => {
        return dataTab.value === 'BWI2022'
            ? props.record?.previous_properties
            : props.record?.properties;
    });

    const styleMapTabs = computed(() => (internalStyleMap.value || props.styleMap)?.layout?.items ?? null);

    const activeValidate = computed(() => internalValidate.value || props.validate || null);
    const activeTfm = computed(() => internalTfm.value || props.tfm || null);

    const isDataTab = computed(() => {
        const item = styleMapTabs.value?.find(t => t.id === contentTab.value);
        return item && item.component !== 'messages_chat' && item.id !== 'position_column';
    });

    function collectTopLevelFields(node) {
        const fields = new Set();
        if (!node) return fields;
        if (node.component === 'datagrid' && node.property) {
            fields.add(node.property.split('.')[0]);
            return fields;
        }
        if (node.type === 'form' && node.property) {
            fields.add(node.property.split('.')[0]);
            return fields;
        }
        if (node.type === 'form' && node.properties) {
            node.properties.forEach(p => { if (p.name) fields.add(p.name); });
            return fields;
        }
        if (node.property) fields.add(node.property.split('.')[0]);
        if (Array.isArray(node.items)) {
            node.items.forEach(item => {
                collectTopLevelFields(item).forEach(f => fields.add(f));
            });
        }
        return fields;
    }

    const errorCountByTab = ref({});
    const warningCountByTab = ref({});
    const errorsByTab = ref({ validation: {}, plausibility: {} });
    const errorDialogOpen = ref(false);
    const errorDialogTabId = ref(null);
    const lastClickedTab = ref(null);

    const errorDialogTabLabel = computed(() => {
        const item = styleMapTabs.value?.find(t => t.id === errorDialogTabId.value);
        return item?.label || item?.id || '';
    });

    const errorDialogValidation = computed(() => errorsByTab.value.validation[errorDialogTabId.value] || []);
    const errorDialogPlausibility = computed(() => errorsByTab.value.plausibility[errorDialogTabId.value] || []);

    const globalDialogOpen = ref(false);
    const globalValidationErrors = computed(() => errorsByTab.value.validation['_global'] || []);
    const globalPlausibilityErrors = computed(() => errorsByTab.value.plausibility['_global'] || []);
    const globalErrorCount = computed(() => (errorCountByTab.value['_global'] || 0));
    const globalWarningCount = computed(() => (warningCountByTab.value['_global'] || 0));

    function parseErrorField(field) {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
            try {
                const parsed = JSON.parse(field);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error('Error parsing stored error field:', e);
            }
        }
        return [];
    }

    function normalizePath(path) {
        if (path == null || path === '') return 'root';
        return path;
    }

    function getErrorKey(instancePath, schemaPath, message, source) {
        return `${normalizePath(instancePath)}-${normalizePath(schemaPath)}-${message}-${source}`;
    }

    function getSavedErrorMessage(error) {
        return error?.message || error?.error?.text || error?.rawError?.text || null;
    }

    function getSavedErrorNote(error) {
        return error?.note || error?.rawError?.note || error?.error?.note || null;
    }

    const savedAcknowledgedErrors = computed(() => {
        const errorMap = new Map();

        const validationErrs = parseErrorField(props.record?.validation_errors);
        for (const err of validationErrs) {
            const source = err?.source || 'ajv';
            const message = getSavedErrorMessage(err);
            if (!message) continue;
            const key = getErrorKey(err?.instancePath, err?.schemaPath, message, source);
            errorMap.set(key, { ...err, source, message });
        }

        const plausibilityErrs = parseErrorField(props.record?.plausibility_errors);
        for (const err of plausibilityErrs) {
            const source = err?.source || 'tfm';
            const message = getSavedErrorMessage(err);
            if (!message) continue;
            const key = getErrorKey(err?.instancePath, err?.schemaPath, message, source);
            errorMap.set(key, { ...err, source, message });
        }

        return errorMap;
    });

    function getSavedNote(instancePath, schemaPath, message, source) {
        if (!message) return null;

        const exactKey = getErrorKey(instancePath, schemaPath, message, source);
        let savedError = savedAcknowledgedErrors.value.get(exactKey);

        if (!savedError && instancePath && instancePath !== '' && instancePath !== 'root') {
            const fallbackKey = getErrorKey('', schemaPath, message, source);
            savedError = savedAcknowledgedErrors.value.get(fallbackKey);
        }

        if (!savedError) {
            for (const err of savedAcknowledgedErrors.value.values()) {
                if (err?.message === message && err?.source === source) {
                    savedError = err;
                    break;
                }
            }
        }

        return savedError ? getSavedErrorNote(savedError) : null;
    }

    function normalizePlausibilityInstancePath(path) {
        if (!path) return '';
        if (path.startsWith('/plot/0/')) {
            return path.slice('/plot/0'.length);
        }
        if (path === '/plot/0') {
            return '';
        }
        return path;
    }

    function getPlausibilityMessage(error) {
        return error?.error?.text || error?.message || error?.rawError?.text || null;
    }

    function getPlausibilityType(error) {
        return error?.error?.type || error?.type || error?.rawError?.type || 'error';
    }

    function getPlausibilitySchemaPath(error) {
        return error?.schemaPath || error?.rawError?.schemaPath || null;
    }

    function withSavedPlausibilityNote(error) {
        const message = getPlausibilityMessage(error);
        const schemaPath = getPlausibilitySchemaPath(error);
        const source = error?.source || 'tfm';
        const savedNote = getSavedNote(error?.instancePath, schemaPath, message, source);
        return savedNote ? { ...error, savedNote } : error;
    }

    function onTabClick(tabId) {
        if (lastClickedTab.value === tabId && (errorCountByTab.value[tabId] || warningCountByTab.value[tabId])) {
            errorDialogTabId.value = tabId;
            errorDialogOpen.value = true;
        }
        lastClickedTab.value = tabId;
    }

    function countErrorsByTab(errors, fieldToTab, counts) {
        for (const error of errors) {
            let field = null;
            if (error.instancePath) {
                const parts = error.instancePath.split('/').filter(Boolean);
                if (parts.length > 0) field = parts[0];
            }
            if (!field && error.keyword === 'required' && error.params?.missingProperty) {
                field = error.params.missingProperty;
            }
            const tid = (field && fieldToTab[field]) ? fieldToTab[field] : '_global';
            counts[tid] = (counts[tid] || 0) + 1;
        }
    }

    function clearValidationUiState() {
        errorCountByTab.value = {};
        warningCountByTab.value = {};
        errorsByTab.value = { validation: {}, plausibility: {} };
        errorDialogOpen.value = false;
        globalDialogOpen.value = false;
        errorDialogTabId.value = null;
    }

    watch([
        dataTab,
        currentData,
        styleMapTabs,
        activeValidate,
        activeTfm,
        () => props.record?.validation_errors,
        () => props.record?.plausibility_errors
    ], async () => {
        if (dataTab.value === 'BWI2022') {
            clearValidationUiState();
            return;
        }

        if (!activeValidate.value || !currentData.value || !styleMapTabs.value) {
            clearValidationUiState();
            return;
        }

        const fieldToTab = {};
        for (const tab of styleMapTabs.value) {
            collectTopLevelFields(tab).forEach(f => { fieldToTab[f] = tab.id; });
        }

        const counts = {};

        // Validation errors (AJV)
        activeValidate.value(currentData.value);
        const rawErrors = activeValidate.value.errors || [];
        // Deduplicate
        const seen = new Set();
        const validationErrors = rawErrors.filter(err => {
            const key = `${err.instancePath}|${err.schemaPath}|${err.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map(err => {
            const savedNote = getSavedNote(err.instancePath, err.schemaPath, err.message, 'ajv');
            return savedNote ? { ...err, savedNote } : err;
        });
        countErrorsByTab(validationErrors, fieldToTab, counts);

        // Store validation errors per tab
        const valByTab = {};
        for (const err of validationErrors) {
            let field = null;
            if (err.instancePath) {
                const parts = err.instancePath.split('/').filter(Boolean);
                if (parts.length > 0) field = parts[0];
            }
            if (!field && err.keyword === 'required' && err.params?.missingProperty) {
                field = err.params.missingProperty;
            }
            const tid = (field && fieldToTab[field]) ? fieldToTab[field] : '_global';
            if (!valByTab[tid]) valByTab[tid] = [];
            valByTab[tid].push(err);
        }

        // Plausibility errors (TFM + stored acknowledged)
        if (activeTfm.value && props.record) {
            try {
                const result = await activeTfm.value.runPlots(
                    [currentData.value],
                    '/plot',
                    [dataTab.value === 'BWI2022' ? props.record.properties : props.record.previous_properties]
                );
                const rawPlaus = Array.isArray(result) ? result : [];
                const livePlausibility = rawPlaus
                    .map(err => ({
                        ...err,
                        instancePath: normalizePlausibilityInstancePath(err?.instancePath)
                    }))
                    .map(withSavedPlausibilityNote);

                const storedPlausibility = parseErrorField(props.record?.plausibility_errors)
                    .map(err => ({
                        ...err,
                        source: err?.source || 'tfm',
                        instancePath: normalizePlausibilityInstancePath(err?.instancePath)
                    }))
                    .map(withSavedPlausibilityNote);

                const plausResults = [];
                const seenPlausibility = new Set();

                function pushUniquePlausibility(error) {
                    const message = getPlausibilityMessage(error);
                    if (!message) return;
                    const source = error?.source || 'tfm';
                    const schemaPath = getPlausibilitySchemaPath(error);
                    const key = getErrorKey(error?.instancePath, schemaPath, message, source);
                    if (seenPlausibility.has(key)) return;
                    seenPlausibility.add(key);
                    plausResults.push(error);
                }

                livePlausibility.forEach(pushUniquePlausibility);
                storedPlausibility.forEach(pushUniquePlausibility);

                const plausByTab = {};
                const warnCounts = {};
                for (const err of plausResults) {
                    let field = null;
                    if (err.instancePath) {
                        const parts = err.instancePath.split('/').filter(Boolean);
                        for (const part of parts) {
                            if (fieldToTab[part]) {
                                field = part;
                                break;
                            }
                        }
                    }
                    const tid = (field && fieldToTab[field]) ? fieldToTab[field] : '_global';
                    if (getPlausibilityType(err) === 'warning') {
                        warnCounts[tid] = (warnCounts[tid] || 0) + 1;
                    } else {
                        counts[tid] = (counts[tid] || 0) + 1;
                    }
                    if (!plausByTab[tid]) plausByTab[tid] = [];
                    plausByTab[tid].push(err);
                }
                errorsByTab.value = { validation: valByTab, plausibility: plausByTab };
                warningCountByTab.value = warnCounts;
            } catch (e) {
                console.error('Error running plausibility for tab counts:', e);
                errorsByTab.value = { validation: valByTab, plausibility: {} };
                warningCountByTab.value = {};
            }
        } else {
            errorsByTab.value = { validation: valByTab, plausibility: {} };
            warningCountByTab.value = {};
        }

        errorCountByTab.value = counts;
    }, { immediate: true });

    watch(styleMapTabs, (tabs) => {
        if (tabs?.length > 0 && !contentTab.value) {
            contentTab.value = tabs[0].id;
        }
    }, { immediate: true });

    watch(selectedVersion, () => loadValidationResources());

    async function loadValidationResources() {
        const versionDir = selectedVersion.value?.directory;
        if (!versionDir) {
            internalSchema.value = null;
            internalValidate.value = null;
            internalTfm.value = null;
            internalStyleMap.value = null;
            return;
        }
        if (validatorCache.has(versionDir)) {
            const cached = validatorCache.get(versionDir);
            internalSchema.value = cached.schema;
            internalValidate.value = cached.validate;
            internalTfm.value = cached.tfm;
            internalStyleMap.value = cached.styleMap || null;
            loadingVersion.value = false;
            return;
        }
        loadingVersion.value = true;
        const [schemaResult, plausibilityResult] = await Promise.all([
            supabase.storage.from('validation').download(`${versionDir}/validation.json`),
            supabase.storage.from('validation').download(`${versionDir}/bundle.umd.js`)
        ]);
        if (schemaResult.error || plausibilityResult.error) {
            loadingVersion.value = false;
            console.error('Error fetching validation resources:', schemaResult.error || plausibilityResult.error);
            return;
        }
        try {
            const schemaTxt = await schemaResult.data.text();
            const plausibilityTxt = await plausibilityResult.data.text();
            const schemaJson = JSON.parse(schemaTxt);
            const schemaItems = schemaJson.properties?.plot?.items || null;
            await new Promise(resolve => setTimeout(resolve, 100));
            const compiledValidate = ajv.compile(schemaItems);
            eval(plausibilityTxt);
            const tfmInstance = new TFM(url + '/', apikey);
            const { data: schemaRow } = await supabase
                .from('schemas')
                .select('style_default')
                .eq('id', selectedVersion.value.id)
                .single();
            const fetchedStyleMap = schemaRow?.style_default || null;
            validatorCache.set(versionDir, {
                schema: schemaItems,
                validate: compiledValidate,
                tfm: tfmInstance,
                styleMap: fetchedStyleMap
            });
            internalSchema.value = schemaItems;
            internalValidate.value = compiledValidate;
            internalTfm.value = tfmInstance;
            internalStyleMap.value = fetchedStyleMap;
            loadingVersion.value = false;
        } catch (error) {
            loadingVersion.value = false;
            console.error('Error parsing/compiling validation resources:', error);
        }
    }
</script>

<template>
    <div>
        <!-- Top bar: always shown so VersionSelection always mounts and triggers initial load -->
        <div class="d-flex align-center justify-space-between px-3 py-2">
            <v-btn-toggle v-model="dataTab" density="compact" rounded="xl" variant="outlined" mandatory>
                <v-btn value="CI2027" size="small">CI2027</v-btn>
                <v-btn value="BWI2022" size="small">BWI2022</v-btn>
            </v-btn-toggle>
            <div class="flex-grow-1"></div>
            <VersionSelection
                size="small"
                class="flex-grow-0"
                v-model="selectedVersion"
                :is_loading="loadingVersion"
                :default_schema_id="props.record?.schema_id_validated_by"
                :key="props.record?.id"
            />
            <v-btn-toggle
                density="compact"
                v-model="toggleDataView"
                rounded="xl"
                variant="outlined"
            >
                <v-btn size="small"><v-icon>mdi-view-list</v-icon></v-btn>
                <v-btn size="small"><v-icon>mdi-code-braces</v-icon></v-btn>
            </v-btn-toggle>
        </div>

        <!-- === STYLE-MAP LAYOUT === -->
        <template v-if="styleMapTabs">
            <!-- Content tabs from styleMap -->
            <div class="d-flex align-center" v-if="toggleDataView === 0">
                <v-tooltip v-if="globalErrorCount + globalWarningCount > 0" :text="`${globalErrorCount + globalWarningCount} globale Fehler/Warnungen`">
                    <template v-slot:activator="{ props: tooltipProps }">
                        <v-btn
                            v-bind="tooltipProps"
                            variant="text"
                            density="compact"
                            size="small"
                            class="mx-1"
                            @click="globalDialogOpen = true"
                        >
                            <v-badge :content="globalErrorCount + globalWarningCount" color="error" floating>
                                <v-icon :color="globalErrorCount > 0 ? 'red' : 'orange'">
                                    {{ globalErrorCount > 0 ? 'mdi-alert-octagon' : 'mdi-alert-circle' }}
                                </v-icon>
                            </v-badge>
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tabs v-model="contentTab" show-arrows class="flex-grow-1">
                    <v-tab
                        v-for="item in styleMapTabs"
                        :key="item.id"
                        :value="item.id"
                        @click="onTabClick(item.id)"
                    >
                        <v-icon v-if="item.icon" :icon="'mdi-' + item.icon" start size="small" />
                        {{ item.label || item.id }}
                        <v-badge
                            v-if="(errorCountByTab[item.id] || 0) + (warningCountByTab[item.id] || 0) > 0"
                            :content="(errorCountByTab[item.id] || 0) + (warningCountByTab[item.id] || 0)"
                            color="error"
                            inline
                        />
                    </v-tab>
                </v-tabs>
            </div>
            <v-divider />

            <v-tabs-window v-model="contentTab" v-if="toggleDataView === 0">
                <v-tabs-window-item
                    v-for="item in styleMapTabs"
                    :key="item.id"
                    :value="item.id"
                    :eager="item.id === 'messages'"
                >
                    <!-- Messages chat -->
                    <RecordMessages
                        v-if="item.component === 'messages_chat'"
                        :inline="true"
                        :recordsId="props.record.id"
                    />
                    <!-- Position map -->
                    <PositionMap
                        v-else-if="item.id === 'position_column'"
                        :record="props.record"
                        :records="props.records"
                    />
                    <!-- JSON view for data tabs -->
                    <v-card-text v-else-if="toggleDataView === 1">
                        <JsonViewer :data="currentData" :schema="schema" />
                    </v-card-text>
                    <!-- Grid view for data tabs -->
                    <GridView
                        v-else-if="schema && currentData"
                        :data="currentData"
                        :schema="schema"
                        :style-tab="item"
                        :key="item.id + '_' + dataTab"
                        :validation-errors="errorsByTab.validation[item.id] || []"
                        :plausibility-errors="errorsByTab.plausibility[item.id] || []"
                    />
                </v-tabs-window-item>
            </v-tabs-window>

                <!-- JSON view when toggled -->
            <v-card-text v-if="toggleDataView === 1">
                <JsonViewer :data="currentData" :schema="schema" />
            </v-card-text>

            <TabErrorsDialog
                v-model="errorDialogOpen"
                :tab-label="errorDialogTabLabel"
                :validation-errors="errorDialogValidation"
                :plausibility-errors="errorDialogPlausibility"
            />
            <TabErrorsDialog
                v-model="globalDialogOpen"
                tab-label="Allgemein"
                :validation-errors="globalValidationErrors"
                :plausibility-errors="globalPlausibilityErrors"
            />
        </template>

        <!-- === LEGACY LAYOUT (no style-map) === -->
        <template v-else>
            <v-list-item
                :title="props.record.record_id
                    ? new Date(props.record.created_at).toLocaleDateString() + ' ' + new Date(props.record.created_at).toLocaleTimeString()
                    : new Date(props.record.updated_at).toLocaleDateString() + ' ' + new Date(props.record.updated_at).toLocaleTimeString()"
                subtitle="letzte Änderung">
            </v-list-item>

            <v-tabs v-model="dataTab" align-tabs="center" class="mb-3">
                <v-tab value="CI2027">CI2027</v-tab>
                <v-tab value="BWI2022">BWI2022</v-tab>
            </v-tabs>
            <v-divider />

            <v-tabs-window v-model="dataTab">
                <v-tabs-window-item value="CI2027">
                    <v-card-text v-if="toggleDataView === 1">
                        <JsonViewer :data="props.record.properties" :schema="schema" />
                    </v-card-text>
                    <GridView v-if="toggleDataView === 0 && schema" :data="props.record.properties" :schema="schema" />
                </v-tabs-window-item>
                <v-tabs-window-item value="BWI2022">
                    <v-card-text v-if="toggleDataView === 1">
                        <JsonViewer :data="props.record.previous_properties" :schema="schema" />
                    </v-card-text>
                    <GridView v-if="toggleDataView === 0 && schema" :data="props.record.previous_properties" :schema="schema" />
                </v-tabs-window-item>
            </v-tabs-window>
        </template>
    </div>
</template>