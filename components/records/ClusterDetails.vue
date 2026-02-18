
<script setup>

    import { onMounted, ref, getCurrentInstance, watch, shallowRef, computed } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import ValidateByPlot from '../../components/validation/ValidateByPlot.vue';
    import RecordToDo from '../../components/records/RecordToDo.vue';
    import RecordDetail from './RecordDetail.vue';

    import Ajv from 'ajv';
    import VersionSelection from '../validation/VersionSelection.vue';
    import HistoryHorizonatal from './HistoryHorizonatal.vue';
    import DetailAdministration from './DetailAdministration.vue';
    import ResponsibleByRecord from './ResponsibleByRecord.vue';

    const ajv = new Ajv({
        allErrors: true,
        strict: false
    });
    
    const selectedVersion = ref(null);
    const validatorCache = new Map();

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
            // Schema and Plausibility will be fetched via watch(selectedVersion)
            // initiated by VersionSelection component emitting initial value
            await fetchRecordsByCluster(props.clusterId);
            initialLoading.value = false;
        }
    });
    
    watch(selectedVersion, (newVersion, oldVersion) => {
        console.log('Version changed from', oldVersion, 'to', newVersion);
        loadValidationResources();
    }, { immediate: true });

    const sheet = shallowRef(false)

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;
    const url = instance.appContext.config.globalProperties.$url;
    const apikey = instance.appContext.config.globalProperties.$apikey;


    const tfm = ref(null);

    const records = ref([]);
    const tab = ref(null);
    const schema = ref(null);
    const validate = ref(null);
    const initialLoading = ref(false);

    const toggle_data_view = ref(0);

    const selectedHistoryPerTab = ref({});

    // Create a computed property for the currently active record
    const activeRecord = computed(() => selectedHistoryPerTab.value[tab.value]);

    async function fetchRecordsByCluster(_clusterId) {
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
    
    const loadingVersion = ref(false);

    async function loadValidationResources() {
        const versionDir = selectedVersion.value?.directory;
        if (!versionDir) {
            console.warn('No version selected, skipping schema fetch.', selectedVersion.value);
            schema.value = null;
            validate.value = null;
            tfm.value = null;
            return;
        }

        if (validatorCache.has(versionDir)) {
            console.log('✅ Using cached validator for:', versionDir);
            const cached = validatorCache.get(versionDir);
            schema.value = cached.schema;
            validate.value = cached.validate;
            tfm.value = cached.tfm;
            console.log('Restored from cache - schema:', !!schema.value, 'validate:', !!validate.value, 'tfm:', !!tfm.value);
            loadingVersion.value = false;
            return;
        }

        loadingVersion.value = true;
        console.log('Loading resources for:', selectedVersion.value);
        
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

            console.log('📋 Schema loaded:', {
                hasPlotSchema: !!schemaItems,
                schemaKeys: schemaItems ? Object.keys(schemaItems).slice(0, 5) : [],
                fullSchemaKeys: Object.keys(schemaJson)
            });

            // allow UI to update
            await new Promise(resolve => setTimeout(resolve, 100));

            const compiledValidate = ajv.compile(schemaItems);
            console.log('✓ AJV validator compiled for:', versionDir);

            // Evaluate Plausibility bundle
            // NOTE: eval executes in the current scope. We rely on the bundle assigning to window.TFM or similar if it's UMD.
            // If the bundle contains `class TFM {}`, repeatedly evaluating it might call errors if let/const are used at top level.
            // Assuming the bundle is well-behaved or we accept the risk of re-definition.
            // UMD usually checks if defined.
            // If TFM is properly exported, we can instantiate it.
            
            // To be safe against "Identifier 'TFM' has already been declared" if using let/const/class globally in eval:
            // We can try-catch the eval or just proceed. 
            // Since we trust the bundle format to be UMD/IIFE usually.
            
            eval(plausibilityTxt);
            
            // TODO: Fetch lookup tables (tableData) if needed by TFM
            // For now, pass empty object as third parameter
            const tfmInstance = new TFM(url+'/', apikey);
            validatorCache.set(versionDir, {
                schema: schemaItems,
                validate: compiledValidate,
                tfm: tfmInstance
            });

            schema.value = schemaItems;
            validate.value = compiledValidate;
            tfm.value = tfmInstance;

            loadingVersion.value = false;
            console.log('✅ All resources loaded for', versionDir, '- schema:', !!schema.value, 'validate:', !!validate.value, 'tfm:', !!tfm.value, 'tfm.validationSchema:', !!tfm.value?.validationSchema);

        } catch (error) {
            loadingVersion.value = false;
            console.error('Error parsing/compiling validation resources:', error);
        }
    }

    function historyBack() {
        window.history.back();
    }

    function onUpdateRecord(updatedRecord) {
        // Refresh the record in the list
        const index = records.value.findIndex(r => r.id === updatedRecord.id);
        if (index !== -1) {
            records.value[index] = { ...records.value[index], ...updatedRecord };
        }
        console.log('UPDATED RECORD', updatedRecord);
        onHistorySelect(updatedRecord, null);
    }
    

    function onHistorySelect(record, event) {
        selectedHistoryPerTab.value[tab.value] = record;
        // Reset selectedVersion to null when switching records
        // This allows VersionSelection to select the new record's default schema
        selectedVersion.value = null;
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
        
        <div v-if="activeRecord" :key="activeRecord.id">
                
                <!-- History -->
                <v-bottom-sheet v-model="sheet" :fullscreen="false" >
                    <v-toolbar flat density="compact">
                        <v-toolbar-title>History</v-toolbar-title>
                        <template v-slot:append>
                            <v-btn text @click="sheet = false">Close</v-btn>
                        </template>
                    </v-toolbar>
                    <v-card>
                        <div class="ma-0 pa-0 overflow-x-auto">
                            <HistoryHorizonatal :plot_id="activeRecord.plot_id" @select:record="onHistorySelect" :selected="activeRecord" />
                        </div>
                    </v-card>
                </v-bottom-sheet>
                <v-fab
                    icon="mdi-history"
                    small
                    class="ma-4 position-fixed bottom-0 right-0 z-index-1000"
                    style="z-index:1005;"
                    @click="sheet = !sheet"
                ></v-fab>
                
                <RecordToDo
                    :record="activeRecord"
                    :organizationId="props.organizationId"
                    :organizationType="props.organizationType"
                    @update:record="onUpdateRecord"
                    class="ma-4" />

                <!-- Display record.note -->
                 <v-alert
                    v-if="activeRecord && activeRecord.note && activeRecord.note.trim() !== ''"
                    class="ma-3"
                    density="compact"
                    :text="activeRecord.note"
                    title="Nachricht"
                    icon="mdi-message"
                ></v-alert>

                <v-card title="Zuständigkeiten" variant="tonal" class="ma-3">

                    <ResponsibleByRecord :record="activeRecord" class="ma-1" />
                </v-card>

                <v-card variant="tonal" v-if="activeRecord" class="ma-3">
                    <v-toolbar color="transparent">
                        <v-toolbar-title>Validation</v-toolbar-title>
                        <template v-slot:append>
                            <VersionSelection 
                                v-model="selectedVersion" 
                                :is_loading="loadingVersion" 
                                :default_schema_id="activeRecord?.schema_id_validated_by"
                                :key="activeRecord?.id"
                            />
                        </template>
                    </v-toolbar>
                    <v-card-text v-if="activeRecord && validate && tfm">
                        <ValidateByPlot :record="activeRecord" :validate="validate" :tfm="tfm" :version="selectedVersion" :key="activeRecord.id" />
                    </v-card-text>
                </v-card>

                <v-card variant="tonal" class="ma-3">
                    <RecordDetail :record="activeRecord" :schema="schema"/>
                </v-card>
        </div>

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