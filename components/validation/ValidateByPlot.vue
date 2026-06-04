<script setup>
    import { onMounted, ref, watch, getCurrentInstance, computed } from 'vue';
    import localize from 'ajv-i18n';
    import {
        createSavedAcknowledgedErrorsMap,
        normalizeNoteText,
        normalizePlausibilityInstancePath,
        withSavedPlausibilityNote,
        withSavedValidationNote
    } from './errorNotes';

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

    const savedAcknowledgedErrors = computed(() => createSavedAcknowledgedErrorsMap(props.record));

    function getSavedNoteText(error) {
        return normalizeNoteText(error?.savedNote);
    }

    function getPlausibilityTitle(error) {
        return normalizeNoteText(error?.error?.note)
            || normalizeNoteText(error?.error?.text)
            || 'Unbekannter Fehler';
    }

    function getPlausibilityText(error) {
        return normalizeNoteText(error?.error?.text);
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
        const rawErrors = props.validate.errors ? [...props.validate.errors] : [];
        localize.de(rawErrors);
        // Deduplicate errors by instancePath + schemaPath + message
        const seen = new Set();
        validationErrors.value = rawErrors.filter(err => {
            const key = `${err.instancePath}|${err.schemaPath}|${err.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map(err => withSavedValidationNote(err, savedAcknowledgedErrors.value));


        try {
            
            const result = await props.tfm.runPlots(
                [props.record.properties],  // Must be an array
                '/plot', 
                [props.record.previous_properties]  // Must be an array
            );
            
            // Ensure result is always an array (handle null/undefined returns)
            plausibilityErrors.value = (Array.isArray(result) ? result : [])
                .map(err => ({
                    ...err,
                    instancePath: normalizePlausibilityInstancePath(err?.instancePath)
                }))
                .map(err => withSavedPlausibilityNote(err, savedAcknowledgedErrors.value));

            console.log(plausibilityErrors.value);
            
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
                            <div v-if="getSavedNoteText(error)" class="mt-2">
                                <v-chip size="small" color="info" prepend-icon="mdi-note-text">
                                    Notiz: {{ getSavedNoteText(error) }}
                                </v-chip>
                            </div>
                        </v-list-item-subtitle>
                        <template v-slot:append>
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
                        <v-list-item-title class="text-wrap">{{ getPlausibilityTitle(error) }}</v-list-item-title>
                        <v-list-item-subtitle>
                            <div v-if="getPlausibilityText(error)">{{ getPlausibilityText(error) }}</div>
                            <div v-if="getSavedNoteText(error)" class="mt-2">
                                <v-chip size="small" color="info" prepend-icon="mdi-note-text">
                                    Notiz: {{ getSavedNoteText(error) }}
                                </v-chip>
                            </div>
                        </v-list-item-subtitle>
                        <template v-slot:append>
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