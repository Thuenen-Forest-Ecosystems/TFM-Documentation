<script setup>
    import { onMounted, ref, watch, getCurrentInstance, computed } from 'vue';
    import localize from 'ajv-i18n';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const validationErrors = ref([]);
    const plausibilityErrors = ref([]);
    const isValid = ref(null);
    const isValidating = ref(false);

    const props = defineProps({
        record: { // is properties
            type: Object,
            required: true
        },
        validate: {
            type: Function,
            required: true
        },
        tfm: {
            type: Object,
            required: true
        }
    });

    // Parse saved acknowledged errors from database
    const savedAcknowledgedErrors = computed(() => {
        const errorMap = new Map();
        
        // Parse validation_errors
        if (props.record.validation_errors) {
            try {
                const parsed = JSON.parse(props.record.validation_errors);
                if (Array.isArray(parsed)) {
                    parsed.forEach(err => {
                        const key = getErrorKey(err.instancePath, err.schemaPath, err.message, err.source);
                        errorMap.set(key, err);
                    });
                }
            } catch (e) {
                console.error('Error parsing validation_errors:', e);
            }
        }
        
        // Parse plausibility_errors
        if (props.record.plausibility_errors) {
            try {
                const parsed = JSON.parse(props.record.plausibility_errors);
                if (Array.isArray(parsed)) {
                    parsed.forEach(err => {
                        const key = getErrorKey(err.instancePath, err.schemaPath, err.message, err.source);
                        errorMap.set(key, err);
                    });
                }
            } catch (e) {
                console.error('Error parsing plausibility_errors:', e);
            }
        }
        
        return errorMap;
    });

    // Normalize path: treat null and empty string as equivalent ('root')
    function normalizePath(path) {
        if (path == null || path === '') return 'root';
        return path;
    }

    // Build error key using same logic as Flutter app
    function getErrorKey(instancePath, schemaPath, message, source) {
        return `${normalizePath(instancePath)}-${normalizePath(schemaPath)}-${message}-${source}`;
    }

    // Get saved note for a given error with fallback matching
    function getSavedNote(instancePath, schemaPath, message, source) {
        // Try exact match first
        const exactKey = getErrorKey(instancePath, schemaPath, message, source);
        let savedError = savedAcknowledgedErrors.value.get(exactKey);
        
        // Fallback: try with normalized 'root' path for backward compatibility
        // This handles cases where old saves had empty instancePath but current validation has populated paths
        if (!savedError && instancePath && instancePath !== '' && instancePath !== 'root') {
            const fallbackKey = getErrorKey('', schemaPath, message, source);
            savedError = savedAcknowledgedErrors.value.get(fallbackKey);
        }
        
        return savedError?.note || null;
    }
    /*async function validationOnline(){
        console.log(props.record)
        const { data, error } = await supabase.functions.invoke('validation', {
            body: JSON.stringify({ cluster: { plot: [
                props.record.previous_properties
            ] } })
        })

        if (error) {
            console.error('Error during online validation:', error);
            return;
        }

        console.log('Online validation result:', data);
    }*/
    async function validation(){
        if (!props.record || !props.validate || !props.tfm) {
            console.warn('⚠️ Validation skipped - missing dependencies:', {
                hasRecord: !!props.record,
                hasValidate: !!props.validate,
                hasTfm: !!props.tfm
            });
            return;
        }

        validationErrors.value = [];
        plausibilityErrors.value = [];

        isValidating.value = true;
        isValid.value = props.validate(props.record.properties);
        validationErrors.value = props.validate.errors ? [...props.validate.errors] : [];
        localize.de(validationErrors.value);


        try {
            
            const result = await props.tfm.runPlots(
                [props.record.properties],  // Must be an array
                '/plot', 
                [props.record.previous_properties]  // Must be an array
            );
            
            // Ensure result is always an array (handle null/undefined returns)
            plausibilityErrors.value = Array.isArray(result) ? result : [];
            
        } catch (error) {
            console.error('❌ Error during plausibility validation:', error);
            console.log('Record properties:', props.record.properties);
            console.log('Previous properties:', props.record.previous_properties);
            // Set plausibilityErrors to an empty array if there's an error
            plausibilityErrors.value = [];
        } finally {
            isValidating.value = false;
        }
    }

    /*watch([props.record, props.validate, props.tfm], (newRecord, newValidate, newTfm) => {
        validation();
    });*/

    watch(() => [props.record, props.validate, props.tfm], (newVals, oldVals) => {
            validation(); // Call your validation logic or any other function
        },
        { deep: true } // Enables deep watching for nested properties
    );

    onMounted(() => {
        validation();
    });

</script>

<template>
    <v-expansion-panels v-if="!isValidating">
        <v-expansion-panel :disabled="validationErrors.length == 0">
            <v-expansion-panel-title>Fehler Validierung ({{ validationErrors.length }})</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-list lines="three">
                    <v-list-item v-for="(error, index) in validationErrors" :key="index">
                        <v-list-item-title class="text-wrap">{{ error.message }}</v-list-item-title>
                        <v-list-item-subtitle>
                            <div>Schema Path: {{ error.schemaPath }}</div>
                            <div v-if="getSavedNote(error.instancePath, error.schemaPath, error.message, 'ajv')" class="mt-2">
                                <v-chip size="small" color="info" prepend-icon="mdi-note-text">
                                    Notiz: {{ getSavedNote(error.instancePath, error.schemaPath, error.message, 'ajv') }}
                                </v-chip>
                            </div>
                        </v-list-item-subtitle>
                        <template v-slot:append>
                            <v-btn
                                color="grey-lighten-1"
                                icon="mdi-information"
                                variant="text"
                            ></v-btn>
                        </template>
                    </v-list-item>
                </v-list>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel :disabled="!plausibilityErrors || plausibilityErrors.length === 0">
            <v-expansion-panel-title>Fehler Plausibilität ({{ plausibilityErrors?.length || 0 }})</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-list lines="three" v-if="plausibilityErrors && plausibilityErrors.length > 0">
                    <v-list-item v-for="(error, index) in plausibilityErrors" :key="index">
                        <template v-slot:prepend>
                            <v-tooltip :text="error.error.type === 'error' ? `Fehler: ${error.error.code}` : `Warnung: ${error.error.code}`">
                                <template v-slot:activator="{ props }">
                                    <v-icon v-bind="props" :icon="error.error.type === 'error' ? 'mdi-alert-octagon' : 'mdi-alert-circle'" :color="error.error.type === 'error' ? 'red' : 'orange'"></v-icon>
                                </template>
                            </v-tooltip>
                        </template>
                        <v-list-item-title class="text-wrap">{{ error.error.note }}</v-list-item-title>
                        <v-list-item-subtitle>
                            <div>{{ error.error.text }}</div>
                            <div v-if="getSavedNote(error.instancePath, null, error.error.text, 'tfm')" class="mt-2">
                                <v-chip size="small" color="info" prepend-icon="mdi-note-text">
                                    Notiz: {{ getSavedNote(error.instancePath, null, error.error.text, 'tfm') }}
                                </v-chip>
                            </div>
                        </v-list-item-subtitle>
                        <template v-slot:append>
                            <v-btn
                                color="grey-lighten-1"
                                icon="mdi-information"
                                variant="text"
                            ></v-btn>
                        </template>
                    </v-list-item>
                </v-list>
            </v-expansion-panel-text>
        </v-expansion-panel>
    </v-expansion-panels>
    <v-progress-circular
        v-else
        indeterminate
        color="primary"
        class="ma-4"
    ></v-progress-circular>
</template>