<script setup>
    import { onMounted, ref, watch, getCurrentInstance } from 'vue';
    import localize from 'ajv-i18n';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const validationErrors = ref([]);
    const plausibilityErrors = ref([]);
    const isValid = ref(null);

    const props = defineProps({
        record: {
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
        if (!props.record || !props.validate || !props.tfm) return;

        isValid.value = props.validate(props.record.properties);
        validationErrors.value = props.validate.errors ? [...props.validate.errors] : [];
        localize.de(validationErrors.value);

        try {
            console.log('Running online validation call...', props.record.previous_properties, props.record.properties);
            plausibilityErrors.value = await props.tfm.runPlots([props.record.properties], null, [props.record.previous_properties]);
            console.log('Plausibility errors:', plausibilityErrors.value);
        } catch (error) {
            console.warn('Error during online validation call:', error);
        }
        
    }

    /*watch([props.record, props.validate, props.tfm], (newRecord, newValidate, newTfm) => {
        validation();
    });*/

    watch(() => props.record, (newRecord, oldRecord) => {
        console.log('Record changed:', newRecord);
            validation(); // Call your validation logic or any other function
        },
        { deep: true } // Enables deep watching for nested properties
    );

    onMounted(() => {
        validation();
    });

</script>

<template>
    <v-expansion-panels>
        <v-expansion-panel :disabled="validationErrors.length == 0">
            <v-expansion-panel-title>Fehler Validierung ({{ validationErrors.length }})</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-list lines="two">
                    <v-list-item v-for="(error, index) in validationErrors" :key="index">
                        <v-list-item-title>{{ error.message }}</v-list-item-title>
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
        <v-expansion-panel :disabled="plausibilityErrors.length == 0">
            <v-expansion-panel-title>Fehler Plausibilität ({{ plausibilityErrors.length }})</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-list lines="two">
                    <v-list-item v-for="(error, index) in plausibilityErrors" :key="index">
                        <template v-slot:prepend>
                            <v-tooltip :text="error.error.type === 'error' ? `Fehler: ${error.error.code}` : `Warnung: ${error.error.code}`">
                                <template v-slot:activator="{ props }">
                                    <v-icon v-bind="props" :icon="error.error.type === 'error' ? 'mdi-alert-octagon' : 'mdi-alert-circle'" :color="error.error.type === 'error' ? 'red' : 'orange'"></v-icon>
                                </template>
                            </v-tooltip>
                        </template>
                        <v-list-item-title>{{ error.error.note }}</v-list-item-title>
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
</template>