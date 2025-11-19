<script setup>
    import { ref, onMounted, getCurrentInstance } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const props = defineProps({
        record: {
            type: Object,
            required: true
        }
    });

    const organizationNames = ref({
        administration: '-',
        country: '-',
        provider: '-',
        troop: '-'
    });

    const troopMembers = ref([]);

    onMounted(async () => {

        // Fetch all organization names in a single query
        const ids = [
            props.record.responsible_administration,
            props.record.responsible_state,
            props.record.responsible_provider
        ].filter(id => id); // Remove null/undefined values

        const troopIds = [
            props.record.responsible_troop
        ].filter(id => id); // Remove null/undefined values

        if (ids.length > 0) {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name')
                .in('id', ids);

            const { data: troopData, error: troopError } = await supabase
                .from('troop')
                .select('id, name')
                .in('id', troopIds);

            if (error || troopError) {
                console.error('Error fetching organizations:', error);
            } else {
                // Map IDs to names
                const nameMap = Object.fromEntries(data.map(org => [org.id, org.name]));
                const troopNameMap = Object.fromEntries(troopData.map(troop => [troop.id, troop.name]));
                
                organizationNames.value = {
                    administration: nameMap[props.record.responsible_administration] || '-',
                    country: nameMap[props.record.responsible_state] || '-',
                    provider: nameMap[props.record.responsible_provider] || '-',
                    troop: troopNameMap[props.record.responsible_troop] || props.record.responsible_troop || '-'
                };
            }
        }

        // Fetch troop member profiles
        if (props.record.current_troop_members && props.record.current_troop_members.length > 0) {
            const { data: memberData, error: memberError } = await supabase
                .from('users_profile')
                .select('id, email, user_name')
                .in('id', props.record.current_troop_members);

            if (memberError) {
                console.error('Error fetching troop members:', memberError);
            } else {
                troopMembers.value = memberData || [];
            }
        }
    });
</script>

<template>
    <v-row v-if="props.record">
        <!-- Administrator -->
        <v-col cols="12" sm="6" md="3">
            <v-card
                variant="tonal"
                class="text-center pa-2" 
                subtitle="Bundesinventurleitung" 
                :title="organizationNames.administration"
            ></v-card>
        </v-col>
        <!-- LIL -->
        <v-col cols="12" sm="6" md="3" v-if="record.responsible_state">
            <v-card
                variant="tonal"
                class="text-center pa-2" 
                subtitle="Landesinventurleitung" 
                :title="organizationNames.country"
            ></v-card>
        </v-col>
        <!-- FLL -->
        <v-col cols="12" sm="6" md="3" v-if="record.responsible_provider">
            <v-card
                variant="tonal"
                class="text-center pa-2" 
                subtitle="Dienstleister" 
                :title="organizationNames.provider"
            ></v-card>
        </v-col>
        <!-- Troop -->
        <v-col cols="12" sm="6" md="3">
            <v-card
                variant="tonal"
                class="pa-2" 
                subtitle="Trupp" 
                :title="organizationNames.troop"
            >
                <v-card-text v-if="troopMembers.length > 0">
                    <v-list density="compact" class="pa-0">
                        <v-list-item
                            v-for="member in troopMembers"
                            :key="member.id"
                            class="px-0"
                            density="compact"
                        >
                            <v-list-item-title class="text-body-2">{{ member.user_name || member.email }}</v-list-item-title>
                            <v-list-item-subtitle v-if="member.user_name" class="text-caption">{{ member.email }}</v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>