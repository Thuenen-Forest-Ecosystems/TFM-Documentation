<<script setup>

    import { getCurrentInstance, onMounted, ref, watch } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const organizationName = ref('');
    const organizationDescription = ref('');
    const valid = ref(false);
    const loading = ref(false);

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref(''); // 'success' or 'error'


    const props = defineProps({
        organization: {
            type: Object,
            default: null
        },
        modelValue: Boolean,
        title: {
            type: String,
            default: 'Organization bearbeiten'
        },
        listOfTakenNames: {
            type: Array,
            default: () => []
        }
    });

    const emit = defineEmits(['confirm']);

    function cancelAction() {
        emit('update:modelValue', false); // Close the dialog
    }


    async function onSubmit() {
        if (!valid.value) {
            return;
        }

        loading.value = true;

        if (props.organization) {
            // Update existing organization
            const { data, error: supabaseError } = await supabase
                .from('organizations')
                .update({
                    name: organizationName.value,
                    description: organizationDescription.value
                })
                .eq('id', props.organization.id)
                .select()
                .single();

            loading.value = false;

            if (supabaseError) {
                snackbarText.value = `Fehler: ${supabaseError.message}`;
                snackbarColor.value = 'error';
                snackbar.value = true;
            } else {
                snackbarText.value = 'Organisation erfolgreich aktualisiert';
                snackbarColor.value = 'success';
                snackbar.value = true;
                emit('update:modelValue', false); // Close the dialog
                emit('confirm', data); // Emit the updated organization data
            }
        } else {
            // Add new organization
            const { data, error: supabaseError } = await supabase
                .from('organizations')
                .insert({
                    name: organizationName.value,
                    description: organizationDescription.value
                })
                .select()
                .single();

            loading.value = false;

            if (supabaseError) {
                snackbarText.value = `Fehler: ${supabaseError.message}`;
                snackbarColor.value = 'error';
                snackbar.value = true;
            } else {
                snackbarText.value = 'Organisation erfolgreich hinzugefügt';
                snackbarColor.value = 'success';
                snackbar.value = true;
                emit('update:modelValue', false); // Close the dialog
                emit('confirm', data); // Emit the new organization data
            }
        }
    }

    const rules = {
        required: value => !!value || 'wird benötigt',
        minLength: value => (value && value.length >= 4) || 'Muss mindestens 4 Zeichen lang sein',
        disabled: value => {
            const nameExists = props.listOfTakenNames.some(
                name => name.toLowerCase() === value.toLowerCase()
            );
            return !nameExists || 'Name schon vergeben';
        }
    };

    // Set default values when the component is mounted
    onMounted(() => {
        if (props.organization) {
            organizationName.value = props.organization.name || '';
            organizationDescription.value = props.organization.description || '';
        } else {
            organizationName.value = '';
            organizationDescription.value = '';
        }
    });
    watch(
        () => props.organization,
        (newOrganization) => {
            if (newOrganization) {
                organizationName.value = newOrganization.name || '';
                organizationDescription.value = newOrganization.description || '';
            } else {
                organizationName.value = '';
                organizationDescription.value = '';
            }
        },
        { immediate: true } // Run immediately on mount
    );

</script>

<template>
    <v-dialog v-model="props.modelValue" max-width="500" @click:outside="cancelAction">
        <v-card rounded="lg">
            <v-toolbar>
                <v-btn v-if="props.icon" :icon="props.icon"></v-btn>

                <v-toolbar-title>{{ props.title }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="cancelAction"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>
            
            <v-card-text>
                <v-form v-model="valid" @submit.prevent="onSubmit">

                    <v-text-field
                        label="Name"
                        persistent-hint
                        type="text"
                        v-model.trim="organizationName"
                        class="my-4"
                        rounded="xl"
                        variant="outlined"
                        :rules="[rules.required, rules.minLength, rules.disabled]"
                    ></v-text-field>

                    <v-textarea
                        label="Beschreibung"
                        persistent-hint
                        type="text"
                        v-model.trim="organizationDescription"
                        class="my-4"
                        rounded="xl"
                        variant="outlined"
                    ></v-textarea>

                    <v-btn type="submit" block :disabled="!valid" :loading="loading"  rounded="xl" color="primary"  class="my-3">
                        Senden
                    </v-btn>
                </v-form>
            </v-card-text>
        </v-card>
    </v-dialog>
    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>