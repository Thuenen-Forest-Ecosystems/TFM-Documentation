<script setup>
    import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
    import DialogEmail from './DialogEmail.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const attrs = useAttrs();

    const administrators = ref([]);
    const userProfiles = ref([]);
    const userRole = ref(null); // Default to 'admin' if not provided in attrs
    const isOrganizationAdmin = ref(false); // Default to false

    const emailDialog = ref(false); // Control the visibility of the email dialog

    const currentUserSession = ref(null); // Store the current user session
    const currentUserId = ref(null); // Store the current user ID
    

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
            return data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching user profiles:', e);
            return [];
        }
    }

    async function _openAdminsDialog() {
        emailDialog.value = true;
    }

    async function _addAdminEmail(adminEmail) {
        //const adminEmail = prompt('Enter administrator email:');
        if (adminEmail && adminEmail.trim() !== '' && attrs.organization_id) {
            try {
                const { data, error: supabaseError } = await supabase.functions.invoke('invite-user', {
                    method: 'POST',
                    body: {
                        email: adminEmail,
                        metaData: {
                            is_organization_admin: attrs.showAdmins || false, // Use is_organization_admin from attributes
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
                //.eq('organization_id', attrs.organization_id);

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
        const {data, error} = await supabase.from('users_permissions').select('is_organization_admin').eq('organization_id', organizationId).eq('user_id', userId);

        if (error || !data) {
            console.error('Error fetching permissions:', error);
            return null;
        }

        //userRole.value = data?.role || null; // Default to null if no role found
        isOrganizationAdmin.value = data[0].is_organization_admin || false; // Default to false if not an organization admin
    }
    async function _requestData(organizationId) {
        if (!organizationId) return;
        try {
            let data, error;
            
            ({ data, error } = await supabase
                .from('users_permissions')
                .select(`*`)
                .eq('organization_id', organizationId)
                .eq('is_organization_admin', attrs.showAdmins ? true : false));

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
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            return;
        }
        currentUserSession.value = sessionData?.session || null;
        currentUserId.value = sessionData?.session?.user?.id || null;
    });

    function _openEmailLink(email) {
        if (email) {
            if (typeof window !== 'undefined') {
                window.location.href = `mailto:${email}`;
            }
        } else {
            alert('Email not available');
        }
    }

</script>

<template>
    <div v-if="attrs.organization_id">
        <v-toolbar density="compact">
            <v-btn v-if="attrs.showAdmins" icon="mdi-shield-account" variant="text"></v-btn>
            <v-btn v-if="!attrs.showAdmins" icon="mdi-account" variant="text"></v-btn>
            
            <v-toolbar-title>{{ attrs.title }}</v-toolbar-title>
            <v-btn v-if="attrs.is_admin" rounded="xl" variant="tonal" append-icon="mdi-email-plus" @click="_openAdminsDialog">einladen</v-btn>
        </v-toolbar>
        <v-list lines="two">
                <div class="text-center ma-2 text-body-2 text-medium-emphasis" v-if="!administrators.length">
                    <p>Kein Mitarbeiter hinzugefügt.</p>
                </div>
                <v-list-item v-for="administrator in administrators" :key="administrator.id">
                    <v-list-item-title>{{ userProfiles.find(profile => profile.id === administrator.user_id)?.email || 'Account wurde noch nicht bestätigt' }}</v-list-item-title>
                    
                    <template v-slot:append>
                        <v-btn v-if="userProfiles.find(profile => profile.id === administrator.user_id)?.email" icon="mdi-email" variant="flat" @click="_openEmailLink(userProfiles.find(profile => profile.id === administrator.user_id)?.email)"/>
                        <v-btn v-if="attrs.is_admin" icon="mdi-delete" variant="flat" @click="_deleteAdministratorDialog(administrator.id)"></v-btn>
                    </template>
                    
                </v-list-item>
        </v-list>
    </div>
    <div v-else>
        <p>No organization selected.</p>
    </div>

    <DialogEmail 
        v-model="emailDialog"
        :organization_id="attrs.organization_id"
        :showAdmins="attrs.showAdmins"
        :title="attrs.title + ' einladen' || 'Mitarbeiter einladen'"
        @close="() => { emailDialog = false; }"
    />
    

    <v-dialog v-model="isActive" max-width="500">
        <v-card title="Remove Member">
            <v-card-text>
                Do you really want to remove this organization member from the organization?
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

