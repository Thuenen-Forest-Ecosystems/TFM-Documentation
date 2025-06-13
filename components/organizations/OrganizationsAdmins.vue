<script setup>
    import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
    import { createClient } from '@supabase/supabase-js'
    import { format, render, cancel, register } from 'timeago.js';


    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const attrs = useAttrs();

    const administrators = ref([]);
    const userProfiles = ref([]);
    const userRole = ref(null); // Default to 'admin' if not provided in attrs
    const isOrganizationAdmin = ref(false); // Default to false

    // Add this ref to store the ID of the admin to be deleted
    const pendingDeleteAdminId = ref(null);
    const isActive = ref(false);

    async function _getUsersProfiles(ids){
        if (!ids || ids.length === 0) return [];
        
        try {
            const { data, error } = await supabase.from('users_profile').select('*').in('id', ids);
            if (error) {
                console.error('Error fetching user profiles:', error, ids);
                return [];
            }
            console.error('Error fetching user profiles:', data, ids);
            return data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching user profiles:', e);
            return [];
        }
    }

    async function _openAdminsDialog() {
        const adminEmail = prompt('Enter administrator email:');
        if (adminEmail && adminEmail.trim() !== '' && attrs.organization_id) {
            try {
                const { data, error: supabaseError } = await supabase.functions.invoke('invite-user', {
                    method: 'POST',
                    body: {
                        email: adminEmail,
                        metaData: {
                            is_organization_admin: attrs.is_organization_admin || false, // Use is_organization_admin from attributes
                            organization_id: attrs.organization_id // Use organization ID from attributes
                        }
                    }
                });
                if (supabaseError) {
                    console.error('Error inviting administrator:', supabaseError);
                    alert(`Error inviting administrator: ${supabaseError.message}`);
                } else {
                    await _requestData(attrs.organization_id); // Refresh the list of administrators
                }
            } catch (error) {
                console.error('Unexpected error:', error);
                alert(`Unexpected error: ${error.message}`);
            }
        }
    }
    // Modify the dialog function to just store the ID and show dialog
    async function _deleteAdministratorDialog(administratorId) {
        if (!administratorId || !attrs.organization_id) return;
        pendingDeleteAdminId.value = administratorId;
        isActive.value = true;
    }
    
    // Move the actual deletion logic to a separate function
    async function _confirmDeleteAdministrator() {
        if (!pendingDeleteAdminId.value || !attrs.organization_id) return;
        
        try {
            const { data, error } = await supabase
                .from('users_permissions')
                .delete()
                .eq('id', pendingDeleteAdminId.value)
                .eq('organization_id', attrs.organization_id);
                
            if (error) {
                console.error('Error deleting administrator:', error);
                alert(`Error deleting administrator: ${error.message}`);
                return;
            }
            
            administrators.value = administrators.value.filter(
                admin => admin.id !== pendingDeleteAdminId.value
            );
            
            // Reset after successful deletion
            pendingDeleteAdminId.value = null;
        } catch (e) {
            console.error('An unexpected error occurred:', e);
            alert(`An unexpected error occurred: ${e.message}`);
        } finally {
            isActive.value = false;
        }
    }
    
    // Function to cancel dialog without action
    function _cancelDeleteDialog() {
        pendingDeleteAdminId.value = null;
        isActive.value = false;
    }
    async function _getPermissions(organizationId){
        if (!organizationId) return;
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
            console.error('Error getting session:', sessionError);
            return null;
        }
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
            console.error('No user ID found in session data.');
            return null;
        }
        const {data, error} = await supabase.from('users_permissions').select('is_organization_admin').eq('organization_id', organizationId).eq('user_id', userId).single();
        if (error) {
            console.error('Error fetching permissions:', error);
            return null;
        }
        //userRole.value = data?.role || null; // Default to null if no role found
        isOrganizationAdmin.value = data?.is_organization_admin || false; // Default to false if not an organization admin
    }
    async function _requestData(organizationId) {
        if (!organizationId) return;
        try {
            let data, error;
            
            ({ data, error } = await supabase.from('users_permissions').select(`*`).eq('organization_id', organizationId));

            if (error) {
                console.error('Error fetching organization data:', error);
                return;
            }
            
            administrators.value = data || [];

            const userIds = data.map(admin => admin.user_id);
            
            userProfiles.value = await _getUsersProfiles(userIds);
                   } catch (e) {
            console.error('An unexpected error occurred:', e);
        }
    }
    watch(() => [attrs.organization_id], ([newOrganizationId]) => {
        _requestData(newOrganizationId);
        _getPermissions(newOrganizationId);
    });
    onMounted(async () => {
        if (attrs.organization_id) {
            await _requestData(attrs.organization_id);
            _getPermissions(attrs.organization_id);
        }
    });

    function _openEmailLink(email) {
        if (email) {
            window.location.href = `mailto:${email}`;
        } else {
            alert('Email not available');
        }
    }

</script>

<template>
    <div v-if="attrs.organization_id">
        <v-toolbar density="compact">
            <v-toolbar-title>{{ attrs.title }}</v-toolbar-title>
            <v-btn v-if="attrs.is_admin" rounded="xl" variant="tonal" append-icon="mdi-plus" @click="_openAdminsDialog">add administrator</v-btn>
        </v-toolbar>
        <v-list lines="two">
                <div class="text-center mb-4" v-if="!administrators.length">
                <p>No organisation members found.</p>
                </div>
                <v-list-item v-for="administrator in administrators" :key="administrator.id">
                    <template v-slot:prepend v-if="administrator.is_organization_admin">
                        <v-icon icon="mdi-shield-crown"></v-icon>
                    </template>
                    <v-list-item-title>{{ userProfiles.find(profile => profile.id === administrator.user_id)?.email || 'Account not confirmed yet' }}</v-list-item-title>
                    <v-list-item-subtitle>
                        {{ format(administrator.created_at, 'de_DE') }}
                    </v-list-item-subtitle>
                    <template v-slot:append  v-if="attrs.is_admin">
                        <v-btn icon="mdi-email" variant="flat" @click="_openEmailLink(userProfiles.find(profile => profile.id === administrator.user_id)?.email)"/>
                        <v-btn icon="mdi-delete" variant="flat" @click="_deleteAdministratorDialog(administrator.id)"></v-btn>
                    </template>
                    
                </v-list-item>
        </v-list>
    </div>
    <div v-else>
        <p>No organization selected.</p>
    </div>

    <v-dialog v-model="isActive" max-width="500">
        <v-card title="Remove Administrator">
            <v-card-text>
                Do you really want to remove this administrator from the organization?
            </v-card-text>
            <v-card-actions>
                <v-btn
                    text="Cancel"
                    variant="text"
                    rounded="xl"
                    @click="_cancelDeleteDialog"
                ></v-btn>
                <v-spacer></v-spacer>
                <v-btn
                    text="REMOVE"
                    variant="elevated"
                    color="error"
                    rounded="xl"
                    @click="_confirmDeleteAdministrator"
                ></v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

