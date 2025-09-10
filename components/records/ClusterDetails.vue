
<script setup>

    import { onMounted, ref, getCurrentInstance } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import History from '../../components/records/History.vue';
    import ValidateByPlot from '../../components/validation/ValidateByPlot.vue';
    import RecordToDo from '../../components/records/RecordToDo.vue';
    import RecordDetail from './RecordDetail.vue';

    import Ajv from 'ajv';
    const ajv = new Ajv({
        allErrors: true,
        strict: false
    });
    const versions = [{
        id: 'v27',
        name: 'Version 27'
    }, {
        id: 'v28',
        name: 'Version 28'
    }]
    const selectedVersion = ref(versions[0]);

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
            .download('v27/bundle.umd.js');

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
        const { data, error } = await supabase
            .storage
            .from('validation')
            .download(`${selectedVersion.value.id}/validation.json`);

        if (error) {
            console.error('Error fetching schema:', error);
            return;
        }

        try {
            const schemaTxt = await data.text();
            const schemaJson = JSON.parse(schemaTxt);
            schema.value = schemaJson.properties?.plot?.items || null;

            validate.value = ajv.compile(schema.value);

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
        <v-tabs-window v-model="tab" class="ma-11">
            <v-tabs-window-item
                v-for="record in records"
                :key="record.id"
                :value="record.id"
            >
                <v-card variant="tonal">
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
                </v-card>
                <RecordDetail :record="record" :schema="schema" class="mt-11" />
                <v-card class="mt-11"  variant="tonal">
                    <RecordToDo :record="record" class="mb-11" />
                    <v-card-text>
                        <History :plot_id="record.plot_id" />
                    </v-card-text>
                </v-card>
                <div class="text-caption ma-11 text-center">
                    {{ record.id }}
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