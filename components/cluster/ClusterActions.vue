<script setup>

    import { getCurrentInstance, ref, onMounted } from 'vue';
import { stateByOrganizationType } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const records = ref([]);
    const aggRecord = ref({});
    const recordStateByOrganization = ref(null);

    const props = defineProps({
        clusterId: {
            type: String,
            required: true
        },
        cluster: {
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
    async function fetchRecordsByCluster(_clusterId) {
        const { data, error } = await supabase
            .from('records')
            .select('*')
            .eq('cluster_id', _clusterId);

        if (error) {
            console.error('Error fetching records:', error);
        }
        return data || [];
    }

    async function aggregateRecords(_records) {
        if (!_records || _records.length === 0) {
            return {};
        }
        const aggregateKeys = [
            'completed_at_troop',
            'completed_at_administration',
            'completed_at_state',
            'responsible_state',
            'responsible_troop',
            'responsible_administration',
            'responsible_provider'
        ];
        // return completed_at_* and responsible_* if all equal else null
        const aggRecords = _records[0];
        for (const record of _records) {
            // Add more fields as necessary
            for (const key of aggregateKeys) {
                if (aggRecords[record[key]] !== record[key]) {
                    aggRecords[record[key]] = null;
                }
            }
        }
        return aggRecords;
    }

    onMounted(async () => {
        records.value = await fetchRecordsByCluster(props.clusterId);
        aggRecord.value = await aggregateRecords(records.value);
        console.log('Aggregated Records:', aggRecord.value);
        recordStateByOrganization.value = stateByOrganizationType(props.organizationId, props.organizationType, aggRecord.value);
        console.log('Record State by Organization:', recordStateByOrganization.value);
    });

</script>

<template v-slot:append>
                        
                    
        <v-chip :color="recordStateByOrganization?.searchText || 'grey'" class="ma-2" variant="elevated">
            {{ recordStateByOrganization?.tooltip || 'Status unbekannt' }}
        </v-chip>
        <!--<v-card-actions v-if="recordStateByOrganization?.actions">
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
</template>