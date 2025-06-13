<script setup>
    import { ref, onMounted, useAttrs, watch, getCurrentInstance } from 'vue';
    import { getOrganizationDetails } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const attrs = useAttrs();
    const troops = ref([]);
    const notJetAddedTroops = ref([]);
    const selection = ref([]);
    const organizationDetails = ref(null);

    async function _requestData(organizationId) {
        if (!organizationId) {
            console.error('Error: organization_id is required.');
            return;
        }

        supabase
            .from('troop')
            .select('*')
            .eq('organization_id', organizationId)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching troops:', error);
                } else {
                    troops.value = (data || []).map((troop) => ({
                        title: troop.name,
                        value: troop.id, // Add value for v-select
                        props: troop
                    }));
                    notJetAddedTroops.value = troops.value.filter(t => !organizationDetails.value?.troops?.includes(t.props.id));
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while fetching troops:', e);
            });
    }

    async function _getOrganizationDetails() {
        if (attrs.organization_id) {
            organizationDetails.value = await getOrganizationDetails(supabase, attrs.organization_id);
            notJetAddedTroops.value = troops.value.filter(t => !organizationDetails.value?.troops?.includes(t.props.id));
        }
    }

    async function _removeTroopFromTroops(troop_id) {
        if (!troop_id || !attrs.organization_id) {
            console.error('Error: troop_id and organization_id are required.');
            return;
        }

        try {
            const newTroops = organizationDetails.value.troops ? organizationDetails.value.troops.filter(t => t !== troop_id) : [];
            const { data, error } = await supabase
                .from('organizations')
                .upsert({
                    id: attrs.organization_id,
                    troops: newTroops
                })
                .select()
                .single();

            if (error) {
                console.error('Error removing troop:', error);
            } else {
                organizationDetails.value.troops = data.troops || [];
                notJetAddedTroops.value.push({ title: troops.value.find(t => t.props.id === troop_id)?.props.name, props: { id: troop_id } }); // Add removed troop back to notJetAddedTroops
            }
        } catch (e) {
            console.error('An unexpected error occurred while removing troop:', e);
        }
    }

    async function _addTroopToTroops(troop_id) {
        if (!troop_id || !attrs.organization_id) {
            console.error('Error: troop_id and organization_id are required.');
            return;
        }

        try {
            const newTroops = organizationDetails.value.troops ? [...organizationDetails.value.troops, troop_id] : [troop_id];
            const uniqueTroops = Array.from(new Set(newTroops)); // Ensure unique troop IDs
            const { data, error } = await supabase
                .from('organizations')
                .upsert({
                    id: attrs.organization_id,
                    troops: uniqueTroops
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding troop:', error);
            } else {
                organizationDetails.value.troops = data.troops || [];
                //_requestData(attrs.organization_id); // Refresh the list
                notJetAddedTroops.value = notJetAddedTroops.value.filter(t => t.props.id !== troop_id); // Remove added troop from notJetAddedTroops
            }
        } catch (e) {
            console.error('An unexpected error occurred while adding troop:', e);
        }
    }
    

    watch(() => attrs.organization_id, (newVal) => {
        if (newVal) {
            _getOrganizationDetails();
            _requestData(newVal);
        }
    });

    onMounted(() => {
        
        if (attrs.organization_id) {
            _getOrganizationDetails();
            _requestData(attrs.organization_id);
        }
    });
</script>

<template>
    <v-toolbar density="compact">
        <template v-slot:prepend>
            <v-icon>mdi-account-group</v-icon>      <!-- Troops Icon -->
        </template>
        <v-toolbar-title>{{ attrs.title || 'Troops' }}</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-menu>
            <template v-slot:activator="{ props }">
                <!-- Disable button if no troops available -->
              <v-btn icon="mdi-plus" variant="text" v-bind="props" :disabled="notJetAddedTroops.length === 0"></v-btn>
            </template>

            <v-list>
                <v-list-item
                    v-for="(item, i) in notJetAddedTroops"
                    :key="i"
                    :value="i"
                    @click="selection = item.props.id; _addTroopToTroops(item.props.id)"
                >
                    <v-list-item-title>{{ item.title }}</v-list-item-title>
                </v-list-item>
            </v-list>
          </v-menu>
    </v-toolbar>            

      <v-list>
        <v-list-item v-if="organizationDetails && organizationDetails.troops.length" v-for="(troop, index) in organizationDetails.troops" :key="index">
            <!--search in troops by id-->
            <v-list-item-title>{{ troops.find(t => t.value === troop)?.props.name }}</v-list-item-title>
                
            <template v-slot:append>
                <v-avatar>
                    <v-icon  icon="mdi-delete" @click="_removeTroopFromTroops(troop)"></v-icon>
                </v-avatar>
            </template>
        </v-list-item>
        <v-list-item v-else>
            <v-list-item-title>No troops available.</v-list-item-title>
        </v-list-item>
      </v-list>
</template>