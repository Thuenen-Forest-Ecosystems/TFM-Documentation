<script setup>
    import { onMounted, getCurrentInstance, ref, watch } from 'vue';
    import { stateByOrganizationType, toDoFromRecord, workflowFromRecord } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const user = ref(null);
    const updating = ref(false);
    const recordState = ref(null);
    const recordStateByOrganization = ref(null);
    const troopRow = ref(null);
    const permission = ref(null);
    const actionLoading = ref(false);
    const ownTroop = ref(null);

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    const props = defineProps({
        record: {
            type: Object,
            required: true
        },
        organizationId: {
            type: String,
            required: true,
            default: null
        },
        organizationType: {
            type: String,
            required: true,
            default: null
        }
    });

    // <RecordToDo @update:record="onUpdateRecord"
    const emit = defineEmits(['update:record']);


    async function fetchPermission(userId, organizationId, isTroop) {
        if (!userId || !organizationId) {
            console.error('Invalid userId or organizationId');
            return;
        }

        console.log('Fetching permissions for user:', userId, 'organization:', organizationId, 'isTroop:', isTroop);

        const { data, error } = await supabase
            .from('users_permissions')
            .select('*')
            .eq('user_id', userId)
            .eq('organization_id', organizationId); // is_organization_admin == true id isTroop = null else false

        if (error) {
            console.error('Error fetching permissions:', error);
        } else {
            console.log(data)
            for (const perm of data) {
                permission.value = perm;
            }
            console.log('Fetched permissions:', data);
        }
    }

    onMounted(async () => {
        console.log('stateByOrganizationType: ', props.record, props.organizationId, props.organizationType, stateByOrganizationType(props.organizationId, props.organizationType, props.record));
        recordStateByOrganization.value = stateByOrganizationType(props.organizationId, props.organizationType, props.record);
    });
    
    async function _markAsCompleted(_recordState, value){
        const updateData = {
            id: props.record.id,
        };
        updateData[_recordState.settable] = value; //new Date().toISOString();
        const { data, error } = await supabase
            .from('records')
            .update(updateData)
            .eq('id', props.record.id)
            .select().single();

        if (error) {
            // Snackbar or similar feedback can be added here
            snackbarText.value = 'Fehler beim Aktualisieren des Datensatzes: ' + error.message;
            snackbarColor.value = 'error';
            snackbar.value = true;
        } else {
            // Snackbar or similar feedback can be added here
            emit('update:record', data);
            snackbarText.value = 'Datensatz erfolgreich aktualisiert';
            snackbarColor.value = 'success';
            snackbar.value = true;
        }
        return data;
    }
    async function _runAction(action){
        actionLoading.value = true;

        if(action.value === 'mark_completed'){
            const result = await _markAsCompleted(action, new Date().toISOString());
        }else if(action.value === 'reopen'){
            const result = await _markAsCompleted(action, null);
        }
        actionLoading.value = false;
    }

    // Watch for changes in props.record to update recordStateByOrganization
    watch(() => props.record, (newRecord) => {
        recordStateByOrganization.value = stateByOrganizationType(props.organizationId, props.organizationType, newRecord);
    }, { immediate: true });
</script>


<template>
    <v-card variant="tonal" title="Aufgaben" class="ma-3">
        <v-card
            v-if="recordStateByOrganization && props.organizationId && props.organizationType"
            :color="recordStateByOrganization.searchText || 'default'"
            v-bind="$attrs"
        >
            <v-card-title>
                {{ recordStateByOrganization?.tooltip || 'Nächster Schritt' }}
            </v-card-title>
        </v-card>
        <!--<v-card-actions v-if="recordStateByOrganization?.actions && !record.record_id">
            <v-spacer></v-spacer>
            <v-btn
                v-for="action in recordStateByOrganization.actions"
                :key="action.value"
                variant="tonal"
                color="primary"
                rounded="xl"
                :loading="actionLoading"
                @click="_runAction(action)"
            >
                {{ action?.label || 'Aktion ausführen' }}
            </v-btn>
        </v-card-actions>-->
    </v-card>
    <v-snackbar
        v-if="snackbar"
        v-model="snackbar" 
        :timeout="3000" 
        :color="snackbarColor"
    >
        {{ snackbarText }}
    </v-snackbar>
</template>