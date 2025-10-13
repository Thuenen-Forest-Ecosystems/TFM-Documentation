<script setup>
    import { computed, onMounted, ref, getCurrentInstance } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const props = defineProps({
        modelValue: {
            type: Boolean,
            required: true
        },
        organizationId:{
            type: String,
            required: true
        },
        organizationType: {
            type: String,
            required: true
        },
        selectedRows: {
            type: Array,
            required: false
        }
    });

    const emit = defineEmits(['close', 'confirm']);

    const isEnabled = ref(false);
    const additionalNote = ref('');

    // Computed property to filter invalid rows
    const notValidRows = computed(() => {
        if (!props.selectedRows || props.selectedRows.length === 0) {
            return [];
        }

        // Replace this with your actual validation logic
        return props.selectedRows.filter(row => {
            // Example: Check if a row is missing a required property
            return !row.is_valid; // Assuming `isValid` is a property in each row
        });
    });
    const targetOrganization = ref(null);
    onMounted(() => {
        switch(props.organizationType) {
            case 'country':
                targetOrganization.value = 'Bundesinventurleitung';
                break;
            case 'provider':
                targetOrganization.value = 'Landesinventurleitung';
                break;
            default:
                console.warn('Unknown organization type:', props.organizationType);
        }
    });

    function closeDialog() {
        emit('update:modelValue', false);
    }

    async function setAsFinished(){

        console.log('SEND', props.selectedRows.map(row => row.cluster_id));

        const updatedValues = {
            note: additionalNote.value || null
        };

        switch (props.organizationType) {
            case 'country':
                updatedValues.responsible_troop = null;
                updatedValues.responsible_provider = null;
                updatedValues.completed_at_state = new Date();
                updatedValues.completed_at_administration = null;
                break;
            case 'provider':
                updatedValues.completed_at_troop = new Date();
                updatedValues.completed_at_administration = null;
                updatedValues.completed_at_state = null;
                break;
            case 'root':
                updatedValues.responsible_troop = null;
                updatedValues.responsible_provider = null;
                updatedValues.responsible_state = null;
                updatedValues.completed_at_administration = new Date();
                break;
            default:
                console.warn('Unknown organization type:', props.organizationType);
        }
        console.log('UPDATE WITH', updatedValues);
        const { data, error } = await supabase
            .schema('public')
            .from('records')
            .update(updatedValues)
            .in('cluster_id', props.selectedRows.map(row => row.cluster_id));
        
        if (error) {
            console.error('Error updating records:', error);
            return;
        }
        console.log('Records updated successfully:', data);
        closeDialog();
    }

</script>

<template>
    <v-dialog max-width="600" v-model="props.modelValue" @click:outside="closeDialog">
        <v-form fast-fail @submit.prevent>
        <v-card prepend-icon="mdi-bookmark-check" title="Trakte abschließen">
                <v-card-text>
                    <v-alert
                        v-if="notValidRows.length"
                        color="error"
                        icon="$error"
                        title="Fehler"
                    >
                        <v-alert-text>
                            Von den {{ selectedRows.length }} Ecken, sind {{ notValidRows.length }} nicht valide.
                        </v-alert-text>
                    </v-alert>
                    <v-alert
                        v-else
                        color="success"
                        icon="$success"
                        title="Erfolgreich"
                    >
                        <v-alert-text>
                            Alle Trakte sind valide.
                        </v-alert-text>
                    </v-alert>

                    <p class="my-4" v-if="props.organizationType !== 'provider'">
                        Mit abschließen der Ecken, werden eventuell bestehende Verantwortungen von Trupps entzogen.
                    </p>
                    <p class="my-4" v-if="props.organizationType !== 'root'">
                        Die ausgewählten Ecken und Trakte werden an die {{ targetOrganization }} übergeben.
                    </p>
                    
                    <v-divider color="info" class="my-5"></v-divider>
                    <p class="text-caption">
                        <v-checkbox v-model="isEnabled">
                            <template v-slot:label>
                                <span  class="text-caption">
                                    Mir ist bewusst, dass Fehler in den Daten unter Umständen zu wiederholten Aufnahmen führen können.
                                </span>
                            </template>
                        </v-checkbox>
                    </p>
                    <v-divider color="info" class="mb-5"></v-divider>
                    <!-- Add additional note textarea here -->
                    <v-textarea
                        v-model="additionalNote"
                        label="Zusätzliche Anmerkungen (optional)"
                        outlined
                        rows="4"
                    ></v-textarea>

                </v-card-text>
                <v-card-actions>
                    <v-btn variant="text" @click="closeDialog">Schließen</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn rounded="xl" variant="elevated" color="primary" type="submit" @click="setAsFinished" :disabled="!isEnabled">Als abgeschlossen markieren</v-btn>
                </v-card-actions>
        </v-card>
        </v-form>
    </v-dialog>
</template>