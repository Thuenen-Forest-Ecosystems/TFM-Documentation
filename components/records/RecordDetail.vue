<script setup>
    import { ref, computed, watch } from 'vue';
    import JsonViewer from './JsonViewer.vue';
    import GridView from './GridView.vue';
    import PositionMap from './PositionMap.vue';
    import RecordMessages from './RecordMessages.vue';
    import TabErrorsDialog from './TabErrorsDialog.vue';

    const dataTab = ref('CI2027');
    const contentTab = ref(null);

    const props = defineProps({
        record: {
            type: Object,
            required: true
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
        if (props.schema) return props.schema;
        if (props.record?.tfm?.schema) return props.record.tfm.schema;
        return null;
    });

    const currentData = computed(() => {
        return dataTab.value === 'BWI2022'
            ? props.record?.previous_properties
            : props.record?.properties;
    });

    const styleMapTabs = computed(() => props.styleMap?.layout?.items ?? null);

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
    const errorsByTab = ref({ validation: {}, plausibility: {} });
    const errorDialogOpen = ref(false);
    const errorDialogTabId = ref(null);
    const lastClickedTab = ref(null);

    const errorDialogTabLabel = computed(() => {
        const item = styleMapTabs.value?.find(t => t.id === errorDialogTabId.value);
        return item?.label || item?.id || '';
    });

    const errorDialogValidation = computed(() => {
        return errorsByTab.value.validation[errorDialogTabId.value] || [];
    });

    const errorDialogPlausibility = computed(() => {
        return errorsByTab.value.plausibility[errorDialogTabId.value] || [];
    });

    function onTabClick(tabId) {
        if (lastClickedTab.value === tabId && errorCountByTab.value[tabId]) {
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
            if (field && fieldToTab[field]) {
                counts[fieldToTab[field]] = (counts[fieldToTab[field]] || 0) + 1;
            }
        }
    }

    watch([currentData, styleMapTabs, () => props.validate, () => props.tfm], async () => {
        if (!props.validate || !currentData.value || !styleMapTabs.value) {
            errorCountByTab.value = {};
            return;
        }

        const fieldToTab = {};
        for (const tab of styleMapTabs.value) {
            collectTopLevelFields(tab).forEach(f => { fieldToTab[f] = tab.id; });
        }

        const counts = {};

        // Validation errors (AJV)
        props.validate(currentData.value);
        const rawErrors = props.validate.errors || [];
        // Deduplicate
        const seen = new Set();
        const validationErrors = rawErrors.filter(err => {
            const key = `${err.instancePath}|${err.schemaPath}|${err.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
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
            if (field && fieldToTab[field]) {
                const tid = fieldToTab[field];
                if (!valByTab[tid]) valByTab[tid] = [];
                valByTab[tid].push(err);
            }
        }

        // Plausibility errors (TFM)
        if (props.tfm && props.record) {
            try {
                const result = await props.tfm.runPlots(
                    [currentData.value],
                    '/plot',
                    [dataTab.value === 'BWI2022' ? props.record.properties : props.record.previous_properties]
                );
                const plausErrors = Array.isArray(result) ? result : [];
                const plausByTab = {};
                for (const err of plausErrors) {
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
                    if (field) {
                        const tid = fieldToTab[field];
                        counts[tid] = (counts[tid] || 0) + 1;
                        if (!plausByTab[tid]) plausByTab[tid] = [];
                        plausByTab[tid].push(err);
                    }
                }
                errorsByTab.value = { validation: valByTab, plausibility: plausByTab };
            } catch (e) {
                console.error('Error running plausibility for tab counts:', e);
                errorsByTab.value = { validation: valByTab, plausibility: {} };
            }
        } else {
            errorsByTab.value = { validation: valByTab, plausibility: {} };
        }

        errorCountByTab.value = counts;
    }, { immediate: true });

    watch(styleMapTabs, (tabs) => {
        if (tabs?.length > 0 && !contentTab.value) {
            contentTab.value = tabs[0].id;
        }
    }, { immediate: true });
</script>

<template>
    <div>
        <!-- === STYLE-MAP LAYOUT === -->
        <template v-if="styleMapTabs">
            <!-- Top bar: dataset selector + JSON toggle -->
            <div class="d-flex align-center justify-space-between px-3 py-2">
                <v-btn-toggle v-model="dataTab" density="compact" rounded="xl" variant="outlined" mandatory>
                    <v-btn value="CI2027" size="small">CI2027</v-btn>
                    <v-btn value="BWI2022" size="small">BWI2022</v-btn>
                </v-btn-toggle>
                <v-btn-toggle
                    v-if="isDataTab"
                    density="compact"
                    v-model="toggleDataView"
                    rounded="xl"
                    variant="outlined"
                >
                    <v-btn size="small"><v-icon>mdi-view-list</v-icon></v-btn>
                    <v-btn size="small"><v-icon>mdi-code-braces</v-icon></v-btn>
                </v-btn-toggle>
            </div>

            <!-- Content tabs from styleMap -->
            <v-tabs v-model="contentTab" show-arrows>
                <v-tab
                    v-for="item in styleMapTabs"
                    :key="item.id"
                    :value="item.id"
                    @click="onTabClick(item.id)"
                >
                    <v-icon v-if="item.icon" :icon="'mdi-' + item.icon" start size="small" />
                    {{ item.label || item.id }}
                    <v-badge
                        v-if="errorCountByTab[item.id]"
                        :content="errorCountByTab[item.id]"
                        color="error"
                        inline
                    />
                </v-tab>
            </v-tabs>
            <v-divider />

            <v-tabs-window v-model="contentTab">
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
                    />
                </v-tabs-window-item>
            </v-tabs-window>

            <TabErrorsDialog
                v-model="errorDialogOpen"
                :tab-label="errorDialogTabLabel"
                :validation-errors="errorDialogValidation"
                :plausibility-errors="errorDialogPlausibility"
            />
        </template>

        <!-- === LEGACY LAYOUT (no style-map) === -->
        <template v-else-if="!styleMapTabs">
            <v-list-item
                :title="props.record.record_id
                    ? new Date(props.record.created_at).toLocaleDateString() + ' ' + new Date(props.record.created_at).toLocaleTimeString()
                    : new Date(props.record.updated_at).toLocaleDateString() + ' ' + new Date(props.record.updated_at).toLocaleTimeString()"
                subtitle="letzte Änderung">
                <template v-slot:append>
                    <v-btn-toggle density="compact" v-model="toggleDataView" rounded="xl" variant="outlined">
                        <v-btn><v-icon>mdi-view-list</v-icon></v-btn>
                        <v-btn><v-icon>mdi-code-braces</v-icon></v-btn>
                    </v-btn-toggle>
                </template>
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