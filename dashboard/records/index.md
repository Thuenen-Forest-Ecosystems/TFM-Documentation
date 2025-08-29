---
title: Records
description: Manage your records and their details.
layout: page
---

<script setup>

    import { onMounted, ref, getCurrentInstance } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import History from '../../components/records/History.vue';
    import JsonViewer from '../../components/records/JsonViewer.vue';
    import GridView from '../../components/records/GridView.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const clusterId = urlParams.get('clusterId');

    const records = ref([]);
    const tab = ref(null);
    const schema = ref(null);

    const toggle_data_view = ref(0);

    async function fetchRecordsByCluster(_clusterId) {
        const { data, error } = await supabase
            .from('records')
            .select('*')
            .eq('cluster_id', _clusterId);

        if (error) {
            console.error('Error fetching records:', error);
        } else {
            // tab.value from recordId
            tab.value = data.length > 0 ? data[0].id : null;

            // Sort by plot_name
            records.value = data.sort((a, b) => a.plot_name - b.plot_name);
        }
    }
    async function fetchSchemaFromSupabaseStorage() {
        const { data, error } = await supabase
            .storage
            .from('validation')
            .download('v27/validation.json');

        if (error) {
            console.error('Error fetching schema:', error);
            return;
        }

        try {
            const schemaTxt = await data.text();
            const schemaJson = JSON.parse(schemaTxt);
            schema.value = schemaJson.properties?.plot?.items || null;
            console.log('Fetched schema:', schema.value);
        } catch (error) {
            console.error('Error parsing schema:', error);
        }
    }

    function historyBack() {
        window.history.back();
    }

    onMounted(async () => {
        if (clusterId) {
            await fetchSchemaFromSupabaseStorage();
            await fetchRecordsByCluster(clusterId);
        }
    });

</script>

<Firewall>
    <v-toolbar>
        <template v-slot:prepend>
            <v-btn icon="mdi-arrow-left" @click="historyBack"></v-btn>
        </template>
        <v-toolbar-title>Trakt: {{ records[0]?.cluster_name }}</v-toolbar-title>
        <template v-slot:extension>
            <v-tabs v-model="tab" fixed-tabs>
                <v-tab
                    v-for="record in records"
                    :key="record.id"
                    :value="record.id"
                >
                    {{ record.plot_name }}
                </v-tab>
            </v-tabs>
        </template>
    </v-toolbar>
    <v-tabs-window v-model="tab" class="ma-11">
        <v-tabs-window-item
            v-for="record in records"
            :key="record.id"
            :value="record.id"
        >
            <v-card>
                <v-toolbar color="transparent" dense>
                    <v-toolbar-title>Data</v-toolbar-title>
                    <template v-slot:append>
                        <v-btn-toggle v-model="toggle_data_view" rounded="xl" variant="outlined">
                            <v-btn>
                                <v-icon>mdi-view-list</v-icon>
                            </v-btn>
                            <v-btn>
                                <v-icon>mdi-code-braces</v-icon>
                            </v-btn>
                        </v-btn-toggle>
                    </template>
                </v-toolbar>
                <v-card-text v-if="toggle_data_view === 1">
                    <JsonViewer :data="record.previous_properties" :schema="schema" />
                </v-card-text>
                <GridView  v-if="toggle_data_view === 0" :data="record.previous_properties" :schema="schema" />
            </v-card>
            <v-card class="mt-11">
                <v-toolbar color="transparent">
                    <v-toolbar-title>History</v-toolbar-title>
                </v-toolbar>
                <v-card-text>
                    <History :plot_id="record.plot_id" />
                </v-card-text>
            </v-card>
        </v-tabs-window-item>
    </v-tabs-window>
</Firewall>