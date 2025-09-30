<script setup>
    import { ref, computed } from 'vue';
    import JsonViewer from './JsonViewer.vue';
    import GridView from './GridView.vue';

    const tab = ref(null);
    const items = ['CI2027', 'BWI2022'];

    const props = defineProps({
        record: {
            type: Object,
            required: true
        },
        schema: {
            type: Object,
            required: false,
            default: null
        }
    });

    const toggle_data_view = ref(0);

    const schema = computed(() => {
        if (props.record && props.record.tfm && props.record.tfm.schema) {
            return props.record.tfm.schema;
        }
        return null;
    });
</script>

<template>
    <div>
        <v-toolbar color="transparent">
            <v-toolbar-title v-if="props.record.record_id">{{ new Date(props.record.created_at).toLocaleDateString() }} {{ new Date(props.record.created_at).toLocaleTimeString() }}</v-toolbar-title>
            <v-toolbar-title v-else>{{ new Date(props.record.updated_at).toLocaleDateString() }} {{ new Date(props.record.updated_at).toLocaleTimeString() }}</v-toolbar-title>
            
            <template v-slot:append>
                <v-btn-toggle density="compact" v-model="toggle_data_view" rounded="xl" variant="outlined">
                    <v-btn>
                        <v-icon>mdi-view-list</v-icon>
                    </v-btn>
                    <v-btn>
                        <v-icon>mdi-code-braces</v-icon>
                    </v-btn>
                </v-btn-toggle>
            </template>
            <template v-slot:extension>
                <v-tabs
                    v-model="tab"
                    align-tabs="center"
                >
                    <v-tab
                        v-for="item in items"
                        :key="item"
                        :text="item"
                        :value="item"
                    ></v-tab>
                </v-tabs>
            </template>
        </v-toolbar>
        <v-tabs-window v-model="tab">
            <v-tabs-window-item :key="items[0]" :value="items[0]">
                <v-card-text v-if="toggle_data_view === 1">
                    <JsonViewer :data="props.record.properties" :schema="props.schema" />
                </v-card-text>
                <GridView v-if="toggle_data_view === 0 && props.schema" :data="props.record.properties" :schema="props.schema" />
            </v-tabs-window-item>
            <v-tabs-window-item :key="items[1]" :value="items[1]">
                <v-card-text v-if="toggle_data_view === 1">
                    <JsonViewer :data="props.record.previous_properties" :schema="props.schema" />
                </v-card-text>
                <GridView v-if="toggle_data_view === 0 && props.schema" :data="props.record.previous_properties" :schema="props.schema" />
            </v-tabs-window-item>
        </v-tabs-window>
    </div>
</template>