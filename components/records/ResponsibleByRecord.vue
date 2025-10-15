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

    onMounted(async () => {
        console.log('props.record: ', props.record);

        // Fetch all organization names in a single query
        const ids = [
            props.record.responsible_administration,
            props.record.responsible_state,
            props.record.responsible_provider,
            props.record.responsible_troop
        ].filter(id => id); // Remove null/undefined values

        if (ids.length > 0) {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name')
                .in('id', ids);

            if (error) {
                console.error('Error fetching organizations:', error);
            } else {
                // Map IDs to names
                const nameMap = Object.fromEntries(data.map(org => [org.id, org.name]));
                
                organizationNames.value = {
                    administration: nameMap[props.record.responsible_administration] || '-',
                    country: nameMap[props.record.responsible_state] || '-',
                    provider: nameMap[props.record.responsible_provider] || '-',
                    troop: nameMap[props.record.responsible_troop] || '-'
                };
            }
        }
    });
</script>

<template>
    <v-row v-if="props.record">
        <!-- Administrator -->
        <v-col>
            <v-card 
                class="text-center pa-2" 
                subtitle="Bundesinventurleitung" 
                :title="organizationNames.administration"
            ></v-card>
        </v-col>
        <!-- LIL -->
        <v-col v-if="record.responsible_state">
            <v-card 
                class="text-center pa-2" 
                subtitle="Landesinventurleitung" 
                :title="organizationNames.country"
            ></v-card>
        </v-col>
        <!-- FLL -->
        <v-col v-if="record.responsible_provider">
            <v-card 
                class="text-center pa-2" 
                subtitle="Dienstleister" 
                :title="organizationNames.provider"
            ></v-card>
        </v-col>
        <!-- Troop -->
        <v-col>
            <v-card 
                class="text-center pa-2" 
                subtitle="Trupp" 
                :title="organizationNames.troop"
            ></v-card>
        </v-col>
    </v-row>
</template>