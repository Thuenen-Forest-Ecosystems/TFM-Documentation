<script setup>

    import { ref, getCurrentInstance, onMounted, watch } from 'vue';

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const props = defineProps({
        record: {
            type: Object,
            required: true
        }
    });

    const permission = ref(null);

    onMounted(async () => {
        const userId = await supabase.auth.getSession().then(({ data: { session } }) => session?.user.id);
        if (userId) {
            const { data, error } = await supabase
                .from('users_profile')
                .select('*')
                .eq('id', userId)
                .eq('is_database_admin', true)
                .single();
            if (error) {
                console.error('Error fetching permissions:', error);
            } else {
                permission.value = data;
                console.log('Fetched permissions:', permission.value);
            }
        }
    });

    watch(() => props.record, (newRecord) => {
        if(newRecord.record_id) {
            console.log('Record ID:', newRecord.record_id);
        }
    });

    function setPreviousData() {

        // Confirm action
        if (!confirm('Sind Sie sicher, dass Sie aktuelle mit vorherigen Daten überschreiben möchten?')) {
            return;
        }

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
    function restoreOldRecord() {

        // Confirm action
        if (!confirm('Sind Sie sicher, dass Sie den aktuellen mit einem veralteten Datensatz überschreiben möchten?')) {
            return;
        }

        if (props.record && props.record.record_id) {
            supabase
                .from('records')
                .update({
                    properties: props.record.properties,
                })
                .eq('id', props.record.record_id)
                .then(({ data, error }) => {
                    if (error) {
                        // Snackbar for error
                        snackbarText.value = 'Error restoring old record: ' + error.message;
                        snackbarColor.value = 'error';
                        snackbar.value = true;
                    } else {
                        // Snackbar for success
                        snackbarText.value = 'Old record restored successfully';
                        snackbarColor.value = 'success';
                        snackbar.value = true;
                        console.log('Old record restored successfully:', data);
                    }
                });
        }
    }

</script>

<template>
    <v-toolbar flat dense v-if="permission && permission.is_database_admin">
        <v-toolbar-title>Administrieren</v-toolbar-title>
        <v-btn variant="outlined" rounded="xl" class="ml-3" @click="setPreviousData">
            2022 in 2027 eintragen
        </v-btn>
        <v-btn @click="restoreOldRecord" :disabled="!props.record.record_id" variant="outlined" rounded="xl" class="ml-3" :color="'red'">
            veraltete Datensatz wiederherstellen
        </v-btn>
    </v-toolbar>
    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>