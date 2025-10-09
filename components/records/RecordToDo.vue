<script setup>
    import { onMounted, getCurrentInstance, ref } from 'vue';
    import { stateByOrganizationType, toDoFromRecord, workflowFromRecord } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const user = ref(null);
    const updating = ref(false);
    const recordState = ref(null);
    const recordStateByOrganization = ref(null);
    const troopRow = ref(null);
    const permission = ref(null);
    const ownTroop = ref(null);

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

        //const { data: { session }, error } = await supabase.auth.getSession();
        //user.value = session?.user ?? null;
        // Perform any necessary setup or data fetching here
        //recordState.value = workflowFromRecord(props.record, null);
        // ToDo: Check if user is part of the organization
        console.log('stateByOrganizationType: ', props.record, props.organizationId, props.organizationType, stateByOrganizationType(props.organizationId, props.organizationType, props.record));
        recordStateByOrganization.value = stateByOrganizationType(props.organizationId, props.organizationType, props.record);

        /*let organizationId = recordState.responsibleId;


        if(recordState.value.isTroop){
            const {data, error} = await supabase
                .from('troop')
                .select('organization_id, user_ids')
                .eq('id', recordState.value.responsibleId).single();

            if (error) {
                console.error('Error fetching troop organization ID:', error);
            }

            if(data){
                organizationId = data.organization_id;
                troopRow.value = data;
            }

            const {data: ownTroopData, error: ownTroopError} = await supabase
                .from('troop')
                .select('*')
                .eq('organization_id', organizationId)
                .contains('user_ids', [user.value.id])
                .maybeSingle();

            if (ownTroopError) {
                console.log('Error fetching own troop data:', ownTroopError);
            }

            if(ownTroopData){
                ownTroop.value = ownTroopData;
            }
        }*/

        //await fetchPermission(user.value.id, organizationId, props.record.responsible_troop);
    });
    
    async function _markAsCompleted(_recordState){
        if(_recordState.settable){
            const updateData = {
                id: props.record.id,
            };
            updateData[_recordState.settable] = new Date().toISOString();
            updating.value = true;
            const { data, error } = await supabase
                .from('records')
                .update(updateData)
                .eq('id', props.record.id);

            if (error) {
                console.error('Error updating record:', error);
            } else {
                console.log('Record updated successfully:', data);
                // Optionally, you can emit an event or update local state here
            }
            updating.value = false;
        }

    }
</script>


<template>
    <v-card
        v-if="recordStateByOrganization && props.organizationId && props.organizationType"
        :color="recordStateByOrganization.searchText || 'default'" v-bind="$attrs">
        <v-card-item>
            <v-card-title>
                ToDo
            </v-card-title>
            <v-card-text>
                {{ recordStateByOrganization.tooltip || 'Kein nächster Schritt definiert' }}
            </v-card-text>
            
            <!--
            <v-card-subtitle>
                Available Functions for {{ record.plot_id }}
            </v-card-subtitle>
            -->

        </v-card-item>

        <!--<v-card-actions class="justify-end" v-if="permission && recordState && recordState.settable" :loading="updating">
            <v-btn
                v-for="(action, index) in recordState.actions"
                v-if="action && action.visible && action.visible(props.record)"
                :key="index"
                variant="tonal"
                rounded="xl"
                @click="_markAsCompleted(action.value)"
                :disabled="action.disable(organizationId, troopRow, user?.id)"
            >
                {{ action.label }}
            </v-btn>
        </v-card-actions>-->
    </v-card>
</template>