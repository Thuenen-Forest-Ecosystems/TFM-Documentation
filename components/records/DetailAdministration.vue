<script setup>

    import { ref, getCurrentInstance } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const props = defineProps({
        record: {
            type: Object,
            required: true
        }
    });

    function setPreviousData() {
        console.log('Setting previous data for record:', props.record);

        // overwrite data from 2022 to 2027
        if (props.record && props.record.properties && props.record.previous_properties) {
            console.log('Current properties:', props.record.properties);
            console.log('Previous properties:', props.record.previous_properties);

            supabase
                .from('records')
                .update({ properties: props.record.previous_properties })
                .eq('id', props.record.id)
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error updating record:', error);
                    } else {
                        console.log('Record updated successfully:', data);
                        // Optionally, you can emit an event or update local state to reflect the change
                    }
                });
        }
    }

</script>

<template>
    <v-toolbar flat dense class="mt-11 mb-11">
        <v-toolbar-title>Administrieren</v-toolbar-title>
        <v-btn variant="outlined" rounded="xl" class="ml-3" @click="setPreviousData">
            2022 in 2027 eintragen
        </v-btn>
    </v-toolbar>
</template>