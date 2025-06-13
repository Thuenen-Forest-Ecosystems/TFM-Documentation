<script setup>
    import { getCurrentInstance, onMounted, useAttrs, ref, watch } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const attrs = useAttrs();
    const troops = ref([]);
    const users = ref([]);

    function _requestData(organizationId) {
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
                    troops.value = data || [];
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while fetching troops:', e);
            });
    }

    function _addTroop() {
        const troopName = prompt('Enter troop name:');

        if (troopName && attrs.organization_id) {
            supabase
                .from('troop')
                .insert({ name: troopName, organization_id: attrs.organization_id })
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error adding troop:', error);
                    } else {
                        _requestData(attrs.organization_id); // Refresh the list
                    }
                })
                .catch((e) => {
                    console.error('An unexpected error occurred while adding troop:', e);
                });
        } else {
            console.error('Error: Troop name is required and organization_id must be set.');
        }
    }

    function _getListOfUserInOrganization(organizationId) {
        return supabase
            .from('users_profile')
            .select('*')
            .eq('organization_id', organizationId)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching users:', error);
                    return [];
                }
                users.value = data || [];
            });
    }

    function _removeTroop(e, troopId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item
        if (!troopId) {
            console.error('Error: troopId is required.');
            return;
        }

        supabase
            .from('troop')
            .delete()
            .eq('id', troopId)
            .then(({ error }) => {
                if (error) {
                    console.error('Error removing troop:', error);
                } else {
                    _requestData(attrs.organization_id); // Refresh the list
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while removing troop:', e);
            });
    }

    function _removeUserFromTroop(e, userId, troopId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item
        console.log('Removing user from troop:', userId, troopId);
        if (!userId || !troopId) {
            console.error('Error: userId and troopId are required.');
            return;
        }

        const userIds = troops.value.find(t => t.id === troopId)?.user_ids || [];
        if (!userIds.includes(userId)) {
            console.warn('User is not in this troop.');
            return; // User not in the troop
        }

        supabase
            .from('troop')
            .update({
                user_ids: userIds.filter(id => id !== userId) // Remove userId from the existing array
            })
            .eq('id', troopId)
            .select()
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching updated troop:', error);
                } else {
                    const updatedTroop = data;
                    const troopIndex = troops.value.findIndex(t => t.id === updatedTroop.id);
                    if (troopIndex !== -1) {
                        troops.value[troopIndex] = updatedTroop;
                    }
                }
            });
    }

    function _addUserToTroop(e, userId, troopId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item
        console.log('Adding user to troop:', userId, troopId);
        if (!userId || !troopId) {
            console.error('Error: userId and troopId are required.');
            return;
        }

        const userIds = troops.value.find(t => t.id === troopId)?.user_ids || [];
        if (userIds.includes(userId)) {
            console.warn('User is already in this troop.');
            return; // User already in the troop
        }


        supabase
            .from('troop')
            .update({
                user_ids: [...userIds, userId] // Add userId to the existing array
            })
            .eq('id', troopId)
            .select()
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching updated troop:', error);
                } else {
                    const updatedTroop = data;
                    const troopIndex = troops.value.findIndex(t => t.id === updatedTroop.id);
                    if (troopIndex !== -1) {
                        troops.value[troopIndex] = updatedTroop;
                    }
                }
            });
    }

    watch(() => attrs.organization_id, (newVal) => {
        if (newVal) {
            _requestData(newVal);
            _getListOfUserInOrganization(newVal);
        }
    });

    onMounted(() => {
        if (!attrs.organization_id) {
            console.error('Error: organization_id is required in attributes.');
            return;
        }
        _requestData(attrs.organization_id);
        _getListOfUserInOrganization(attrs.organization_id);
    });
</script>

<template>
    <v-toolbar>
        <!-- Add icon for adding users to troops -->
        <v-btn icon="mdi-account-group" variant="text"></v-btn>
        <v-toolbar-title>{{  attrs.title }}</v-toolbar-title>
        <!-- Only if Admin -->
        <v-btn v-if="attrs.is_admin" rounded="xl" variant="tonal" @click="_addTroop">
            <v-icon>mdi-plus</v-icon>Add
        </v-btn>
    </v-toolbar>
    <v-list>
        <v-list-group v-for="troop in troops" :key="troop.id">
            

            <template v-slot:activator="{ props }">
                <v-list-item
                    v-bind="props"
                >
                    <v-list-item-title>{{ troop.name }}</v-list-item-title>
                    <v-list-item-subtitle v-if="troop.is_control_troop">Kontroll-Trupp</v-list-item-subtitle>
                    
                    <template v-slot:append>
                        <v-menu>
                            <template v-slot:activator="{ props }">
                                <!-- Disable button if no troops available -->
                            <v-btn v-if="attrs.is_admin" icon="mdi-plus" variant="text" v-bind="props" :disabled="users.length === 0"></v-btn>
                            </template>
                            
                            <v-list>
                                <v-list-item
                                    v-for="(item, i) in users"
                                    :key="i"
                                    :value="i"
                                    @click="(e) => _addUserToTroop(e, item.id, troop.id)"
                                >
                                    <v-list-item-title>{{ item.email }}</v-list-item-title>

                                </v-list-item>
                            </v-list>
                        </v-menu>
                        <v-btn
                            v-if="attrs.is_admin"
                            color="grey-lighten-1"
                            icon="mdi-delete"
                            variant="text"
                            @click="(e) => _removeTroop(e, troop.id)"
                        ></v-btn>
                    </template>
                </v-list-item>
            </template>

            <v-list-item prepend-icon="mdi-account" v-if="troop.user_ids && troop.user_ids.length > 0" v-for="userId in troop.user_ids" :key="userId">
                <v-list-item-title>{{ users.find(user => user.id === userId)?.email || 'Unknown User' }}</v-list-item-title>
                <template v-slot:append>
                    <v-btn v-if="attrs.is_admin" icon="mdi-delete" variant="text" @click="(e) => _removeUserFromTroop(e, userId, troop.id)"></v-btn>
                </template>
            </v-list-item>
            <v-list-item v-else>
                <v-list-item-title>No users in this troop</v-list-item-title>
            </v-list-item>
        </v-list-group>
    </v-list>
</template>
