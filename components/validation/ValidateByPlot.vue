<script setup>
    import { onMounted, ref, watch, getCurrentInstance } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const validationErrors = ref([]);
    const isValid = ref(null);

    const props = defineProps({
        record: {
            type: Array,
            required: true
        },
        validate: {
            type: Function,
            required: true
        },
        tfm: {
            type: Object,
            required: true
        },
        version: {
            type: String,
            required: true
        }
    });
    async function validationOnline(){
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
    }
    async function validation(){
        if (!props.record || !props.validate || !props.tfm) return;

        isValid.value = props.validate(props.record.properties);
        validationErrors.value = props.validate.errors;

        try {
            validationErrors.value = await props.tfm.runPlots([props.record.properties], null, [props.record.previous_properties]);
        } catch (error) {
            console.warn('Error during online validation call:', error);
        }
        
    }

    watch([props.record, props.validate, props.tfm], (newRecord, newValidate, newTfm) => {
        console.log('dsfdaf');
        validation();
    });

    onMounted(() => {
        validation();
    });

</script>

<template>
    <p>Record ID: {{ record.id }}</p>
    <p>Is valid: {{ validate(record) }}</p>
    <p>Validation Errors: {{ validate.errors.length }}</p>
</template>