<script setup>
    import { ref, computed, watch } from 'vue';
    import JsonViewer from './JsonViewer.vue';
    import GridView from './GridView.vue';
    import PositionMap from './PositionMap.vue';
    import RecordMessages from './RecordMessages.vue';

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
                >
                    <v-icon v-if="item.icon" :icon="'mdi-' + item.icon" start size="small" />
                    {{ item.label || item.id }}
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