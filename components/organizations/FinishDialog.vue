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

    const isAdmin = ref(false);

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
    async function getUsersPermissions() {
        const { data, error } = await supabase.auth.getSession()
        if (data.session) {
            var userId = data.session.user.id;
        
            const { data: permissionsData, error: permissionsError } = await supabase
                .from('users_permissions')
                .select('*')
                .eq('user_id', userId)
                .eq('organization_id', props.organizationId);

            if (permissionsError) {
                console.error('Error fetching user permissions:', permissionsError);
                return null;
            }
            return permissionsData;
        } else {
            console.error('No active session found.');
            return null;
        }
    }

    const targetOrganization = ref(null);
    onMounted(async () => {
        const permissions = await getUsersPermissions();
        // find in permissions where is_organization_admin is true
        isAdmin.value = permissions?.some(permission => permission.is_organization_admin);

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
        // provider should not be able to set completed
        if (!isAdmin.value && props.organizationType === 'provider') {
            snackbarText.value = 'Du hast keine Berechtigung, diese Aktion durchzuführen.';
            snackbarColor.value = 'error';
            snackbar.value = true;
            return;
        }

        try {
            // Check session before proceeding
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                console.error('Session error:', sessionError);
                snackbarText.value = 'Sitzung abgelaufen. Bitte neu anmelden.';
                snackbarColor.value = 'error';
                snackbar.value = true;
                return;
            }

            console.log('Current user:', sessionData.session.user.id);
            console.log('Organization ID:', props.organizationId);
            console.log('Selected rows count:', props.selectedRows.length);
            
            const updatedValues = { note: additionalNote.value || null };
            if(isAdmin.value){
                switch (props.organizationType) {
                    case 'country':
                        updatedValues.responsible_troop = null;
                        updatedValues.responsible_provider = null;
                        updatedValues.completed_at_state = new Date();
                        break;
                    case 'provider':
                        updatedValues.completed_at_troop = new Date();
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
            }else{
                updatedValues.completed_at_troop = new Date();
            }

            console.log('Updated values:', updatedValues);

            // Process in batches to avoid Supabase limits
            const BATCH_SIZE = 100; // Reduced batch size for safety
            const clusterIds = props.selectedRows.map(row => row.cluster_id);
            const totalRows = clusterIds.length;
            let totalUpdated = 0;
            let allUpdatedData = [];

            console.log(`Processing ${totalRows} records in batches of ${BATCH_SIZE}`);

            // Show progress to user
            snackbarText.value = `Verarbeite ${totalRows} Datensätze in Stapeln...`;
            snackbarColor.value = 'info';
            snackbar.value = true;

            for (let i = 0; i < clusterIds.length; i += BATCH_SIZE) {
                const batch = clusterIds.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(clusterIds.length / BATCH_SIZE);
                
                console.log(`Processing batch ${batchNumber}/${totalBatches} with ${batch.length} records`);
                
                // Update progress
                snackbarText.value = `Verarbeite Stapel ${batchNumber}/${totalBatches} (${batch.length} Datensätze)...`;

                let query = supabase
                    .schema('public')
                    .from('records')
                    .update(updatedValues)
                    .in('cluster_id', batch);

                // Add conditions based on organization type and admin status
                if(isAdmin.value) {
                    if (props.organizationType === 'root') {
                        query = query.not('completed_at_state', 'is', null);
                        query = query.not('completed_at_troop', 'is', null);
                    } else if (props.organizationType === 'country') {
                        // Add specific conditions if needed
                    }
                } else {
                    console.log('Adding null filters for non-admin user');
                    query = query.is('completed_at_state', null);
                    query = query.is('completed_at_administration', null);
                    query = query.is('completed_at_troop', null);
                }

                query = query.select();

                const { data, error } = await query;

                if (error) {
                    console.error(`Batch ${batchNumber} failed:`, {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code,
                        batchSize: batch.length
                    });
                    snackbarText.value = `Fehler bei Stapel ${batchNumber}: ${error.message}`;
                    snackbarColor.value = 'error';
                    snackbar.value = true;
                    return;
                }

                totalUpdated += data.length;
                allUpdatedData = allUpdatedData.concat(data);
                console.log(`Batch ${batchNumber} completed: ${data.length} records updated`);
                
                // Small delay to avoid rate limiting
                if (i + BATCH_SIZE < clusterIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            snackbarText.value = `${totalUpdated} von ${totalRows} Datensätzen erfolgreich aktualisiert.`;
            snackbarColor.value = 'success';
            snackbar.value = true;

            console.log(`Batch processing complete: ${totalUpdated} total records updated`);
            
            emit('confirm', allUpdatedData);
            closeDialog();
        } catch (error) {
            console.error('Unexpected error in setAsFinished:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error stack:', error.stack);
            
            let errorMessage = 'Fehler beim Aktualisieren der Datensätze: ' + error.message;
            
            // Provide more specific error messages for common issues
            if (error.message?.includes('Failed to fetch')) {
                errorMessage += '\n\nMögliche Ursachen:\n- Netzwerkverbindung unterbrochen\n- Supabase Server nicht erreichbar\n- CORS-Problem';
            }
            
            snackbarText.value = errorMessage;
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