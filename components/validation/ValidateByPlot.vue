<script setup>
    import { onMounted, ref, watch, getCurrentInstance } from 'vue';
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

        console.log('🔍 Starting validation for record:', props.record.id || 'unknown');

        validationErrors.value = [];
        plausibilityErrors.value = [];

        isValidating.value = true;
        isValid.value = props.validate(props.record.properties);
        validationErrors.value = props.validate.errors ? [...props.validate.errors] : [];
        localize.de(validationErrors.value);

        console.log('✓ Schema validation complete:', {
            isValid: isValid.value,
            errorCount: validationErrors.value.length
        });

        try {
            console.log('🔄 Running plausibility checks...');
            console.log('TFM validationSchema exists:', !!props.tfm.validationSchema);
            
            const result = await props.tfm.runPlots(
                [props.record.properties],  // Must be an array
                '/plot', 
                [props.record.previous_properties]  // Must be an array
            );
            
            // Ensure result is always an array (handle null/undefined returns)
            plausibilityErrors.value = Array.isArray(result) ? result : [];
            
            console.log('✓ Plausibility checks complete:', {
                resultType: typeof result,
                isArray: Array.isArray(result),
                errorCount: plausibilityErrors.value.length,
                errors: plausibilityErrors.value.slice(0, 3) // Show first 3 errors
            });
        } catch (error) {
            console.error('❌ Error during plausibility validation:', error);
            console.log('Record properties:', props.record.properties);
            console.log('Previous properties:', props.record.previous_properties);
            // Set plausibilityErrors to an empty array if there's an error
            plausibilityErrors.value = [];
        } finally {
            isValidating.value = false;
        }
        console.log('🏁 Validation finished:', {
            schemaValid: isValid.value,
            schemaErrors: validationErrors.value.length,
            plausibilityErrors: plausibilityErrors.value.length
        });
    }

    /*watch([props.record, props.validate, props.tfm], (newRecord, newValidate, newTfm) => {
        validation();
    });*/

    watch(() => [props.record, props.validate, props.tfm], (newVals, oldVals) => {
            console.log('📦 Validation props changed:', {
                recordChanged: newVals[0] !== oldVals?.[0],
                validateChanged: newVals[1] !== oldVals?.[1],
                tfmChanged: newVals[2] !== oldVals?.[2],
                hasValidate: !!newVals[1],
                hasTfm: !!newVals[2]
            });
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
                <v-list lines="two">
                    <v-list-item v-for="(error, index) in validationErrors" :key="index">
                        <v-list-item-title class="text-wrap">{{ error.message }}</v-list-item-title>
                        <v-list-item-subtitle>Schema Path: {{ error.schemaPath }}</v-list-item-subtitle>
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
                <v-list lines="two" v-if="plausibilityErrors && plausibilityErrors.length > 0">
                    <v-list-item v-for="(error, index) in plausibilityErrors" :key="index">
                        <template v-slot:prepend>
                            <v-tooltip :text="error.error.type === 'error' ? `Fehler: ${error.error.code}` : `Warnung: ${error.error.code}`">
                                <template v-slot:activator="{ props }">
                                    <v-icon v-bind="props" :icon="error.error.type === 'error' ? 'mdi-alert-octagon' : 'mdi-alert-circle'" :color="error.error.type === 'error' ? 'red' : 'orange'"></v-icon>
                                </template>
                            </v-tooltip>
                        </template>
                        <v-list-item-title class="text-wrap">{{ error.error.note }}</v-list-item-title>
                        <v-list-item-subtitle>{{ error.error.text }}</v-list-item-subtitle>
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