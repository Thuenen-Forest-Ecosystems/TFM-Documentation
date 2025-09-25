<script setup>

    import { getCurrentInstance, onMounted, ref, watch } from 'vue';
    import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'


    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const email = ref('');
    const name = ref('');

    const loading = ref(false);
    const valid = ref(false)
    const error = ref('')
    const success = ref('')


    const props = defineProps({
        email: String,
        name: String,
        modelValue: Boolean,
        organization_id: String,
        showAdmins: Boolean,
        title: String
    });

    const emit = defineEmits(['confirm']);

    function cancelAction() {
        emit('update:modelValue', false); // Close the dialog
    }


    async function onSubmit() {

        if(!valid.value) {
            error.value = 'Bitte überprüfe die Eingaben.';
            return;
        }
        if (!email.value) {
            error.value = 'E-Mail-Adresse wird benötigt.';
            return;
        }
        if(!props.organization_id) {
            error.value = 'Organisation ID wird benötigt.';
            return;
        }


        loading.value = true;
        const adminEmail = email.value;
        try {
            const { data, error: supabaseError } = await supabase.functions.invoke('invite-user', {
                method: 'POST',
                body: {
                    email: adminEmail,
                    name: name.value || null,
                    metaData: {
                        is_organization_admin: props.showAdmins || false, // Use is_organization_admin from attributes
                        organization_id: props.organization_id, // Use organization_id from attributes
                        name: name.value || null, // Use name from input
                    }
                }
            });
            if (supabaseError instanceof FunctionsHttpError) {
                const errorMessage = await supabaseError.context.json()
                error.value = errorMessage.details || errorMessage.error;
                if(error.value.startsWith('duplicate key value violates unique constraint')) {
                    error.value = 'Diese E-Mail-Adresse ist bereits zugewiesen.';
                }
            } else if (supabaseError instanceof FunctionsRelayError) {
                error.value = supabaseError.message;
            } else if (supabaseError instanceof FunctionsFetchError) {
                error.value = supabaseError.message;
            }
            if (!supabaseError) {
                success.value = `Einladung an ${adminEmail} wurde gesendet.`;
            }
            loading.value = false;
        } catch (error) {
            console.error('Error inviting user:', error);
            error.value = error.message;
        }
        
        loading.value = false;
        email.value = ''; // Clear the email input after submission
        name.value = ''; // Clear the name input after submission
        valid.value = false; // Reset the form validity
        
    }

    const rules = {
        required: value => !!value || 'wird benötigt',
        email: value => {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailPattern.test(value) || 'Ungültige E-Mail-Adresse';
        }
    };


</script>

<template>
    <v-dialog v-model="props.modelValue" max-width="500" @click:outside="cancelAction">
        <v-card  rounded="lg">
            <v-toolbar>
                <v-btn
                    icon="mdi-email"
                ></v-btn>

                <v-toolbar-title>{{ props.title || 'Mitarbeiter einladen' }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="cancelAction"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>
            
            <v-card-text>
                <p class="mb-6 text-body-2 text-medium-emphasis">
                    Bitte geben Sie die E-Mail-Adresse des Mitarbeiters ein, den Sie einladen möchten. Der Mitarbeiter erhält eine E-Mail mit einem Link zur Registrierung.
                </p>
                <v-chip v-if="error" color="red" class="my-2">
                    <span>{{ error }}</span>
                </v-chip>
                <div v-if="success" class="flex-column	 justify-space-between align-center">
                    <v-chip color="green" class="my-2">
                        <span>{{ success }}</span>
                    </v-chip>
                    <v-btn type="submit" @click="success = ''" block rounded="xl" color="primary"  class="my-3">
                        weitere Einladung verschicken
                    </v-btn>
                </div>
                <v-form v-else v-model="valid" @submit.prevent="onSubmit">
                    <!-- Name -->
                    <v-text-field
                        label="Name"
                        persistent-hint
                        type="text"
                        v-model.trim="name"
                        class="my-4"
                        rounded="xl"
                        variant="outlined"
                    ></v-text-field>
                    <v-text-field
                        label="E-Mail"
                        persistent-hint
                        type="text"
                        v-model.trim="email"
                        class="my-4"
                        rounded="xl"
                        variant="outlined"
                        :rules="[rules.required, rules.email]"
                    ></v-text-field>
                    <v-btn type="submit" block :disabled="!valid" :loading="loading"  rounded="xl" color="primary"  class="my-3">einladung versenden</v-btn>
                </v-form>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>