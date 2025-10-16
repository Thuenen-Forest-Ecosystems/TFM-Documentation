<script setup>
import { computed, onMounted, ref, getCurrentInstance, watch } from 'vue';

const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;

const props = defineProps({
    modelValue: {
        type: Boolean,
        required: true,
    },
    organizationId: {
        type: String,
        required: true,
    },
    organizationType: {
        type: String,
        required: true,
    },
    selectedRows: {
        type: Array,
        required: false,
        default: () => [],
    },
});

const emit = defineEmits(['update:modelValue', 'close', 'confirm']);

const isEnabled = ref(false);
const additionalNote = ref('');

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const modelValue = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
});

const notValidRows = computed(() => {
    if (!props.selectedRows || props.selectedRows.length === 0) {
        return [];
    }
    return props.selectedRows.filter(row => !row.is_valid);
});

const targetOrganization = ref(null);
onMounted(() => {
    switch (props.organizationType) {
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

async function setAsFinished() {
    try {
        const updatedValues = { note: additionalNote.value || null };
        switch (props.organizationType) {
            case 'country':
                //updatedValues.responsible_troop = null;
                //updatedValues.responsible_provider = null;
                updatedValues.completed_at_state = new Date();
                //updatedValues.completed_at_administration = null;
                break;
            case 'provider':
                updatedValues.completed_at_troop = new Date();
                //updatedValues.completed_at_administration = null;
                //updatedValues.completed_at_state = null;
                break;
            case 'root':
                //updatedValues.responsible_troop = null;
                //updatedValues.responsible_provider = null;
                //updatedValues.responsible_state = null;
                updatedValues.completed_at_administration = new Date();
                break;
            default:
                console.warn('Unknown organization type:', props.organizationType);
        }

        let query = supabase
            .schema('public')
            .from('records')
            .update(updatedValues)
            .in('cluster_id', props.selectedRows.map(row => row.cluster_id));

        // Add condition for `completed_at_state` when organizationType is 'root'
        if (props.organizationType === 'root') {
            query = query.not('completed_at_state', 'is', null);
            query = query.not('completed_at_troop', 'is', null);
        } else if (props.organizationType === 'country') {
            query = query.not('completed_at_troop', 'is', null);
        }

        query = query.select();

        console.log(query);

        const { data, error } = await query;

        if (error) {
            snackbarText.value = 'Fehler beim Aktualisieren der Datensätze: ' + error.message;
            snackbarColor.value = 'error';
            snackbar.value = true;
            return;
        }

        snackbarText.value = `${data.length} Datensätze erfolgreich aktualisiert.`;
        snackbarColor.value = 'success';
        snackbar.value = true;

        emit('confirm', data);

        closeDialog();
    } catch (error) {
        snackbarText.value = 'Fehler beim Aktualisieren der Datensätze: ' + error.message;
        snackbarColor.value = 'error';
        snackbar.value = true;
    }
}

watch(
    () => props.modelValue,
    (newVal) => {
        if (!newVal) {
            isEnabled.value = false;
            additionalNote.value = '';
        }
    }
);
</script>

<template>
    <v-dialog max-width="600" v-model="modelValue" @click:outside="closeDialog">
        <v-form fast-fail @submit.prevent>
            <v-card>
                <v-toolbar>
                    <v-btn icon="mdi-bookmark-check"></v-btn>

                    <v-toolbar-title>Aufnahmen akzeptieren</v-toolbar-title>

                    <v-toolbar-items>
                        <v-btn
                            icon="mdi-close"
                            variant="text"
                            @click="closeDialog"
                    ></v-btn>
                    </v-toolbar-items>
                </v-toolbar>
                <v-card-text>
                    <!--<v-alert
                        v-if="notValidRows.length"
                        color="error"
                        icon="$error"
                        title="Fehler"
                    >
                        Von den {{ selectedRows.length }} Ecken, sind {{ notValidRows.length }} nicht valide.
                    </v-alert>
                    <v-alert
                        v-else
                        color="success"
                        icon="$success"
                        title="Erfolgreich"
                    >
                        Alle Trakte sind valide.
                    </v-alert>-->

                    <p class="my-4" v-if="props.organizationType !== 'root'">
                        Die ausgewählten <b>Trakte</b> werden an die {{ targetOrganization }} übergeben. Es sind keine weiteren Änderungen mehr möglich.
                    </p>

                    <v-textarea
                        v-model="additionalNote"
                        label="Zusätzliche Anmerkungen (optional)"
                        outlined
                        rows="4"
                        variant="outlined"
                    ></v-textarea>

                    <p class="text-caption">
                        <v-checkbox v-model="isEnabled">
                            <template v-slot:label>
                                <span class="text-caption">
                                    Mir ist bewusst, dass Fehler in den Daten unter Umständen zu wiederholten Aufnahmen führen können.
                                </span>
                            </template>
                        </v-checkbox>
                    </p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn
                        rounded="xl"
                        variant="elevated"
                        color="primary"
                        type="submit"
                        @click="setAsFinished"
                        :disabled="!isEnabled"
                    >
                        Absenden
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-form>
    </v-dialog>
    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>