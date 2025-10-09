
<script setup>

    import { onMounted, ref, getCurrentInstance, watch, shallowRef } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import ValidateByPlot from '../../components/validation/ValidateByPlot.vue';
    import RecordToDo from '../../components/records/RecordToDo.vue';
    import RecordDetail from './RecordDetail.vue';

    import Ajv from 'ajv';
    import VersionSelection from '../validation/VersionSelection.vue';
    import HistoryHorizonatal from './HistoryHorizonatal.vue';
    import DetailAdministration from './DetailAdministration.vue';

    const ajv = new Ajv({
        allErrors: true,
        strict: false
    });
    
    const selectedVersion = ref(null);

    const props = defineProps({
        cluster: {
            type: Object,
            required: false,
            default: null
        },
        clusterId: {
            type: String,
            required: true
        },
        organizationId: {
            type: String,
            required: true
        },
        organizationType: {
            type: String,
            required: true
        }
    });

    onMounted(async () => {
        
        if (props.clusterId) {
            initialLoading.value = true;
            await fetchSchemaFromSupabaseStorage();
            await fetchPlausibilityFromSupabaseStorage();
            await fetchRecordsByCluster(props.clusterId);
            initialLoading.value = false;
        }
    });
    
    watch(selectedVersion, (newVersion) => {
        fetchSchemaFromSupabaseStorage();
        // Trigger any additional logic here
    });

    const sheet = shallowRef(false)

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;


    const tfm = ref(null);

    const records = ref([]);
    const tab = ref(null);
    const schema = ref(null);
    const validate = ref(null);
    const initialLoading = ref(false);

    const toggle_data_view = ref(0);

    const selectedHistoryPerTab = ref({});

    async function fetchRecordsByCluster(_clusterId) {
        console.log('Fetching records for cluster:', _clusterId);
        const { data, error } = await supabase
            .from('records')
            .select('*')
            .eq('cluster_id', _clusterId);

        if (error) {
            console.error('Error fetching records:', error);
        } else {
            data.forEach(record => {
                if (props.cluster && record.plot_id === props.cluster.plot_id) {
                    tab.value = record.id;
                }
            });

            //tab.value = data.length > 0 ? data[0].id : null;

            // Sort by plot_name
            records.value = data.sort((a, b) => a.plot_name - b.plot_name);
        }
    }
    async function fetchPlausibilityFromSupabaseStorage() {

        const { data, error } = await supabase
            .storage
            .from('validation')
            .download('v31/bundle.umd.js');

        if (error) {
            console.error('Error fetching plausibility:', error);
            return;
        }

        try {
            const plausibilityTxt = await data.text();
            eval(plausibilityTxt);

            tfm.value = new TFM();

        } catch (error) {
            console.error('Error parsing plausibility:', error);
        }
    }
    const loadingVersion = ref(false);
    async function fetchSchemaFromSupabaseStorage() {
        if (!selectedVersion.value || !selectedVersion.value.directory) {
            console.warn('No version selected, skipping schema fetch.', selectedVersion.value);
            schema.value = null;
            validate.value = null;
            return;
        }
        loadingVersion.value = true;
        const { data, error } = await supabase
            .storage
            .from('validation')
            .download(`${selectedVersion.value.directory}/validation.json`);
        loadingVersion.value = false;
        if (error) {
            console.error('Error fetching schema:', error);
            return;
        }

        try {
            const schemaTxt = await data.text();
            const schemaJson = JSON.parse(schemaTxt);
            schema.value = schemaJson.properties?.plot?.items || null;

            validate.value = ajv.compile(schema.value);

            console.log('Loaded schema and compiled validator:', schema.value, validate.value);

        } catch (error) {
            console.error('Error parsing schema:', error);
        }
    }

    function historyBack() {
        window.history.back();
    }

    

    function onHistorySelect(record, event) {
        selectedHistoryPerTab.value[tab.value] = record;
        //sheet.value = false; // Close the bottom sheet after selection
    }
     watch(tab, (newTabValue) => {
        const selectedRecord = records.value.find(r => r.id === newTabValue);
        if (selectedRecord) {
            onHistorySelect(selectedRecord, null);
        }
    });
</script>

<template>
    <Firewall>
        <v-card>
            <div class="d-flex align-center">
            <div class="ma-2">Ecken:</div>
            <v-tabs v-model="tab" fixed-tabs class="flex-grow-1">
                <v-tab
                    v-for="record in records"
                    :key="record.id"
                    :value="record.id"
                >
                    {{ record.plot_name }}
                </v-tab>
            </v-tabs>
            </div>
        </v-card>
        <v-tabs-window v-model="tab">
            <v-tabs-window-item
                v-for="record in records"
                :key="record.id"
                :value="record.id"
            >
                <!--<div class="full-height d-flex">
                    <v-navigation-drawer  :width="420" expand-on-hover
                        permanent
                        rail>
                        <History :plot_id="record.plot_id" @select:record="onHistorySelect" />
                    </v-navigation-drawer>
                </div>-->

                <!-- only show history for active tab -->
                <v-bottom-sheet v-if="tab === record.id" v-model="sheet" :fullscreen="false" >
                    <v-toolbar flat density="compact">
                        <v-toolbar-title>History</v-toolbar-title>
                        <template v-slot:append>
                            <v-btn text @click="sheet = false">Close</v-btn>
                        </template>
                    </v-toolbar>
                    <v-card>
                        <div class="ma-0 pa-0 overflow-x-auto">
                            <HistoryHorizonatal :plot_id="record.plot_id" @select:record="onHistorySelect" :selected="selectedHistoryPerTab[tab]" />
                        </div>
                    </v-card>
                    <!--<v-expansion-panels>
                        <v-expansion-panel>
                            <v-expansion-panel-title>
                                <v-icon>mdi-history</v-icon>
                                <span class="ml-2">History</span>
                            </v-expansion-panel-title>
                            <v-expansion-panel-text class="ma-0 pa-0">
                                <div class="ma-0 pa-0 overflow-x-auto">
                                    <HistoryHorizonatal :plot_id="record.plot_id" @select:record="onHistorySelect" />
                                </div>
                                
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>-->
                </v-bottom-sheet>
                <v-fab
                    icon="mdi-history"
                    small
                    class="ma-4 position-fixed bottom-0 right-0 z-index-1000"
                    style="z-index:1005;"
                    @click="sheet = !sheet"
                ></v-fab>

                <RecordToDo :record="selectedHistoryPerTab[tab]" :organizationId="props.organizationId" :organizationType="props.organizationType" class="ma-4" />

                <!-- Display record.note -->
                 <v-alert
                    v-if="selectedHistoryPerTab[tab] && selectedHistoryPerTab[tab].note && selectedHistoryPerTab[tab].note.trim() !== ''"
                    class="ma-3"
                    density="compact"
                    :text="selectedHistoryPerTab[tab].note"
                    title="Nachricht"
                    icon="mdi-message"
                ></v-alert>

                <div class="ma-3">
                    <v-card variant="tonal" v-if="selectedHistoryPerTab[tab]" class="pa-3">

                        <v-toolbar color="transparent">
                            <v-toolbar-title>Validation</v-toolbar-title>
                            <template v-slot:append>
                                <VersionSelection v-model="selectedVersion" :is_loading="loadingVersion" />
                            </template>
                        </v-toolbar>
                        <v-card-text v-if="selectedHistoryPerTab[tab] && validate && tfm">
                            <ValidateByPlot :record="selectedHistoryPerTab[tab]" :validate="validate" :tfm="tfm" :version="selectedVersion" />
                        </v-card-text>
                        <RecordDetail :record="selectedHistoryPerTab[tab]" :schema="schema" class="mt-11" />
                    </v-card>

                    <DetailAdministration v-if="selectedHistoryPerTab[tab]" :record="selectedHistoryPerTab[tab]" />

                    <div class="text-caption ma-11 text-center">
                        Cluster:{{ record.id }}
                    </div>
                </div>
            </v-tabs-window-item>
        </v-tabs-window>
        <!--Loader-->
        <v-progress-circular
            indeterminate
            width="3"
            color="primary"
            v-if="initialLoading"
            class="loader"
        ></v-progress-circular>
    </Firewall>
</template>

<style>
    .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
</style>