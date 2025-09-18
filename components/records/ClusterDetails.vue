
<script setup>

    import { onMounted, ref, getCurrentInstance, watch } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import History from '../../components/records/History.vue';
    import ValidateByPlot from '../../components/validation/ValidateByPlot.vue';
    import RecordToDo from '../../components/records/RecordToDo.vue';
    import RecordDetail from './RecordDetail.vue';

    import Ajv from 'ajv';
    import VersionSelection from '../validation/VersionSelection.vue';
    

    const ajv = new Ajv({
        allErrors: true,
        strict: false
    });
    
    const selectedVersion = ref(null);

    // Optional: Watch for changes
    watch(selectedVersion, (newVersion) => {
        console.log('Selected version changed:', newVersion);
        fetchSchemaFromSupabaseStorage();
        // Trigger any additional logic here
    });

    const props = defineProps({
        clusterId: {
            type: String,
            required: true
        }
    });

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;


    const tfm = ref(null);

    const records = ref([]);
    const tab = ref(null);
    const schema = ref(null);
    const validate = ref(null);
    const initialLoading = ref(false);

    const selectedHistoricalRecord = ref(null);

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
    async function fetchSchemaFromSupabaseStorage() {
        if (!selectedVersion.value || !selectedVersion.value.directory) {
            console.warn('No version selected, skipping schema fetch.', selectedVersion.value);
            schema.value = null;
            validate.value = null;
            return;
        }
        const { data, error } = await supabase
            .storage
            .from('validation')
            .download(`${selectedVersion.value.directory}/validation.json`);

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

    onMounted(async () => {
        
        if (props.clusterId) {
            initialLoading.value = true;
            await fetchSchemaFromSupabaseStorage();
            await fetchPlausibilityFromSupabaseStorage();
            await fetchRecordsByCluster(props.clusterId);
            initialLoading.value = false;
        }
    });

    function onHistorySelect(record, event) {
        selectedHistoricalRecord.value = record;
    }

</script>

<template>
    <Firewall>
        <v-card>
            <v-tabs v-model="tab" fixed-tabs>
                <v-tab
                    v-for="record in records"
                    :key="record.id"
                    :value="record.id"
                >
                    {{ record.plot_name }}
                </v-tab>
            </v-tabs>
        </v-card>
        <v-tabs-window v-model="tab">
            <v-tabs-window-item
                v-for="record in records"
                :key="record.id"
                :value="record.id"
            >
            <v-app>
                <div class="full-height d-flex">
                    <v-navigation-drawer  :width="420" expand-on-hover
                        permanent
                        rail>
                        <History :plot_id="record.plot_id" @select:record="onHistorySelect" />
                    </v-navigation-drawer>
                </div>

                <div style="margin-left:70px !important;" class="ma-3">
                    <!--<v-card variant="tonal">
                        <RecordToDo :record="record" class="mb-11" />

                        <v-toolbar color="transparent">
                            <v-toolbar-title>Validation</v-toolbar-title>
                            <template v-slot:append>
                                <v-select
                                    rounded="xl"
                                    variant="outlined"
                                    density="compact"
                                    :items="versions"
                                    v-model="selectedVersion"
                                    item-title="name"
                                ></v-select>
                            </template>
                        </v-toolbar>
                        <v-card-text>
                            <ValidateByPlot :record="record" :validate="validate" :tfm="tfm" :version="selectedVersion" />
                        </v-card-text>
                    </v-card>-->

                    
                    <v-card variant="tonal" v-if="selectedHistoricalRecord">
                        <RecordToDo :record="selectedHistoricalRecord" class="mb-11" />

                        <v-toolbar color="transparent">
                            <v-toolbar-title>Validation</v-toolbar-title>
                            <template v-slot:append>
                                <VersionSelection v-model="selectedVersion" />
                            </template>
                        </v-toolbar>
                        <v-card-text v-if="selectedHistoricalRecord && validate && tfm">
                            <ValidateByPlot :record="selectedHistoricalRecord" :validate="validate" :tfm="tfm" :version="selectedVersion" />
                        </v-card-text>

                        <RecordDetail :record="selectedHistoricalRecord" :schema="schema" class="mt-11" />
                    </v-card>

                    <!--<v-card class="mt-11"  variant="tonal">
                        <v-card-text>
                            <History :plot_id="record.plot_id" />
                        </v-card-text>
                    </v-card>-->
                    <div class="text-caption ma-11 text-center">
                        {{ record.id }}
                    </div>
                </div>
                </v-app>
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