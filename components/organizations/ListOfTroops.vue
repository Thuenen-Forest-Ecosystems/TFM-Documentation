<script setup>
    import { getCurrentInstance, onMounted, useAttrs, ref, watch } from 'vue';
    import DialogTroop from './DialogTroop.vue';


    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const attrs = useAttrs();
    const troops = ref([]);
    const users = ref([]);

    const nameDialog = ref(false);
    const existingTroops = ref([]);
    const addTroopLoading = ref(false);

    const props = defineProps({
        organization_id: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: ''
        },
        is_admin: {
            type: Boolean,
            default: false
        }
    });

    function _requestData(organizationId) {
        if (!organizationId) {
            console.error('Error: organization_id is required.');
            return;
        }

        supabase
            .from('troop')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching troops:', error);
                } else {
                    troops.value = data || [];
                    existingTroops.value = troops.value.map(t => t.name.toLowerCase());
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while fetching troops:', e);
            });
    }

    function _addTroop(troopName, isControlTroop) {

        if (troopName && props.organization_id) {
            supabase
                .from('troop')
                .insert({ name: troopName, organization_id: props.organization_id, is_control_troop: isControlTroop })
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error adding troop:', error);
                    } else {
                        _requestData(props.organization_id); // Refresh the list
                        nameDialog.value = false; // Close the dialog
                        addTroopLoading.value = false; // Reset loading state
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
            .from('users_permissions') // users_profile
            .select('*, users_profile(*)')
            .eq('organization_id', organizationId)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching users:', error);
                    return [];
                }
                users.value = data || [];
                console.log('Fetched users:', users.value);
            });
    }
    
    const deleting = ref({});
    function _removeTroop(e, troopId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item
        if (!troopId) {
            console.error('Error: troopId is required.');
            return;
        }

        // Confirm the deletion
        if (!confirm('Sind Sie sicher, dass Sie diesen Trupp entfernen möchten?')) {
            return;
        }

        deleting.value[troopId] = true; // Set loading state
        supabase
            .from('troop')
            .delete()
            .eq('id', troopId)
            .then(({ error }) => {
                if (error) {
                    console.error('Error removing troop:', error);
                } else {
                    _requestData(props.organization_id); // Refresh the list
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while removing troop:', e);
            })
            .finally(() => {
                deleting.value[troopId] = false; // Reset loading state
            });
    }

    const deletingUser = ref({});
    function _removeUserFromTroop(e, userId, troopId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item

        if (!userId || !troopId) {
            console.error('Error: userId and troopId are required.');
            return;
        }

        // Confirm the deletion
        if (!confirm('Sind Sie sicher, dass Sie diesen Benutzer aus dem Trupp entfernen möchten?')) {
            return;
        }

        

        const userIds = troops.value.find(t => t.id === troopId)?.user_ids || [];
        if (!userIds.includes(userId)) {
            console.warn('User is not in this troop.');
            return; // User not in the troop
        }

        deletingUser.value[userId] = true; // Set loading state

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
            })
            .finally(() => {
                deletingUser.value[userId] = false; // Reset loading state
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

    watch(() => props.organization_id, (newVal) => {
        if (newVal) {
            _requestData(newVal);
            _getListOfUserInOrganization(newVal);
        }
    });

    onMounted(() => {
        if (!props.organization_id) {
            console.error('Error: organization_id is required in attributes.');
            return;
        }
        _requestData(props.organization_id);
        _getListOfUserInOrganization(props.organization_id);
    });
</script>

<template>
    <v-toolbar class="mb-4" color="transparent" style="border-bottom: 1px solid rgba(120, 120, 120, 0.12);">
        <!-- Add icon for adding users to troops -->
        <v-btn icon="mdi-account-group" variant="text"></v-btn>
        <v-toolbar-title>{{ props.title }}</v-toolbar-title>
        <!-- Only if Admin -->
        <v-btn v-if="props.is_admin" rounded="xl" variant="tonal" @click="() => { nameDialog = true; }">
            neu<v-icon>mdi-account-multiple-plus</v-icon>
        </v-btn>
    </v-toolbar>

    <div class="text-center mb-4" v-if="!troops.length">
        <v-alert type="warning" variant="tonal">
            Es wurden noch keine Trupps hinzugefügt.<br/>Klicke auf "Neu", um einen neuen Trupp hinzuzufügen.
        </v-alert>
    </div>
    
    <v-card  v-for="troop in troops" :key="troop.id" class="mb-4" variant="tonal">
        <v-card-item>
            <v-card-title>{{ troop.name }}</v-card-title>
            <v-card-subtitle v-if="troop.is_control_troop">Kontroll-Trupp</v-card-subtitle>
            <v-card-subtitle v-else>Aufnahme-Trupp</v-card-subtitle>
            <template v-slot:append  v-if="props.is_admin">
                <v-menu>
                    <template v-slot:activator="{ props: menuProps }">
                        <!-- Disable button if no troops available -->
                        <v-btn v-if="props.is_admin" icon="mdi-account-plus" variant="text" v-bind="menuProps" :disabled="users.length === 0"></v-btn>
                    </template>
                    <v-list>
                        <v-list-item
                            v-for="(item, i) in users"
                            :key="i"
                            :value="i"
                            @click="(e) => _addUserToTroop(e, item.users_profile.id, troop.id)"
                        >
                            <v-list-item-title>{{ item.users_profile.email }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="users.length === 0" class="text-center">
                            <p class="ma-2 text-body-2 text-medium-emphasis">
                                Keine Benutzer verfügbar.
                            </p>
                        </v-list-item>
                    </v-list>
                </v-menu>
                <v-btn
                    v-if="props.is_admin"
                    color="grey-lighten-1"
                    icon="mdi-delete"
                    :disabled="troop.id && deleting[troop.id]"
                    :loading="troop.id && deleting[troop.id]"
                    variant="text"
                    @click="(e) => _removeTroop(e, troop.id)"
                ></v-btn>
            </template>
        </v-card-item>
        <v-card-text>
            <v-list-item v-for="userId in troop.user_ids" :key="userId">
                <v-list-item-title>{{ users.find(user => user.users_profile.id === userId)?.users_profile?.email || 'E-Mail noch nicht definiert' }}</v-list-item-title>
                <v-list-item-subtitle v-if="!users.find(user => user.users_profile.id === userId)?.users_profile?.email">{{ userId }}</v-list-item-subtitle>

                <template v-slot:append>
                    <v-btn v-if="props.is_admin" icon="mdi-delete" variant="text" @click="(e) => _removeUserFromTroop(e, userId, troop.id)"></v-btn>
                </template>
            </v-list-item>
            <v-list-item v-if="troop.user_ids.length === 0" class="text-center">
                <p class="ma-2 text-body-2 text-medium-emphasis">
                    Keine Benutzer in diesem Trupp.
                </p>
            </v-list-item>
        </v-card-text>
    </v-card>

    <DialogTroop
        v-model="nameDialog"
        :value="''"
        :title="'Trupp hinzufügen'"
        :text="'Bitte gib den Namen des Trupps ein, den du hinzufügen möchtest.'"
        :btnText="'Trupp Hinzufügen'"
        :icon="'mdi-account-multiple-plus'"
        :loading="addTroopLoading"
        :disabled="existingTroops"
        :placeholder="'z.B. Trupp Eberswalde, Trupp Versuchsfläche'"
        @close="() => { nameDialog = false; }"
        @confirm="_addTroop"
    />
</template>
