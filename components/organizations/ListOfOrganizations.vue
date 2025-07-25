<script setup>

    import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
    import { useRouter } from 'vitepress'
    import DialogEmail from './DialogEmail.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const router = useRouter()
    const loading = ref(false);
    const valid = ref(false);

    const emailDialog = ref(false);
    const dialogOrganization_id = ref(null); // Store the organization ID for the dialog

    const attrs = useAttrs();

    // Define the props that the component expects
        const props = defineProps({
            organization_id: {
                type: String,
                required: true
            },
            type: {
                type: String,
                default: 'organization'
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

    const parent_organization_id = ref(null);
    const organizations = ref([]);
    const user = ref(null);
    const userProfiles = ref([]); // Store user profiles
    const userPermissions = ref([]); // Store user permissions
    const userRole = ref(null); // Default to null if no role found
    const is_organization_admin = ref(false); // Default to false

    const isActive = ref(false);
    const losName = ref('');
    const companyName = ref('');



  function _sortOrganizations(organizations) {
      return organizations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  const deleting = ref({});
  async function _removeOrganization(organizationId) {
    if (!organizationId) return;
    try {
        if (!confirm('Are you sure you want to remove this organization?')) {
            return; // User cancelled the deletion
        }

        deleting.value[organizationId] = true;
      const { data, error } = await supabase.from('organizations').delete().eq('id', organizationId);
      if (error) {
        console.error('Error removing organization:', error);
        alert(`Error removing organization: ${error.message}`);
        return;
      }
      organizations.value = organizations.value.filter(org => org.id !== organizationId);
    } catch (e) {
      console.error('An unexpected error occurred:', e);
      alert(`An unexpected error occurred: ${e.message}`);
    } finally {
        deleting.value[organizationId] = false;
    }
  }

  async function _createOrganization(organizationName = 'New Organization', entityName = 'Los', parentOrganizationId = null) {
    if (!parent_organization_id.value) {
        alert('Error: Parent organization ID is not set. Please ensure a parent organization is selected.'); // User feedback
        return;
    }
    try {
        const { data, error } = await supabase.from('organizations').insert({
            name: organizationName,
            parent_organization_id: parentOrganizationId || parent_organization_id.value,
            entityName: entityName,
            type: props.type || 'country' // Default to 'country' if not provided
        }).select().single();

        if (error) {
            console.error('Supabase error:', error);
            alert(`Supabase error: ${error.message}`); // User feedback
            return;
        }

        if (data) {
            organizations.value.push(data);
            organizations.value = _sortOrganizations(organizations.value);
        }
    } catch (e) {
        console.error('An unexpected error occurred:', e);
        alert(`An unexpected error occurred: ${e.message}`); // User feedback
    }
  }
    async function _confirmAddLos() {
        loading.value = true; // Show loading state
        if (!companyName.value) {
            alert('Please fill in all fields.'); // User feedback
            return;
        }
        await _createOrganization(companyName.value, losName.value,parent_organization_id.value);
        isActive.value = false; // Close the dialog
        losName.value = ''; // Reset input fields
        companyName.value = '';
        loading.value = false; // Hide loading state
    }

  async function _getOrganizationsByParentId(organizationId){
        let data, error;
        ({ data, error } = await supabase.from('organizations')
            .select()
            .eq('parent_organization_id', organizationId)
            .order('created_at', { ascending: false })
            //.eq('type', attrs.type) // Ensure only active organizations are fetched
            .order('created_at', { ascending: false }));


      if (error) {
          console.error('Error fetching organizations by parent ID:', error);
          return;
      }
      if (data) {
          organizations.value = data;
      } else {
          console.log('No organizations found with parent id:', organizationId);
          organizations.value = []; // Reset if no data found
      }
  }
  
  /*function _navigateToOrganizationDetails(organizationId) {
      router.go(`/TFM-Documentation/dashboard/organizations/details?orgId=${organizationId}`)
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
        const {data, error} = await supabase.from('users_permissions')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .single();
        if (error) {
            console.error('Error fetching permissions:', error);
            return null;
        }
        //userRole.value = data?.role || null; // Default to null if no role found
        is_organization_admin.value = data?.is_organization_admin || false; // Default to false if not an organization admin
    }*/

    watch(() => props.organization_id, async (newVal) => {
        if (newVal) {
            parent_organization_id.value = newVal; // Update parent organization ID from prop
            await _getOrganizationsByParentId(newVal);
            await _getUsersProfileByOrganizationId(newVal);
            //await _getPermissions(newVal); // Fetch permissions for the user
        }
    }, { immediate: true });

    async function _getUsersProfileByOrganizationId(parentOrganizationId) {
        if (!parentOrganizationId) return;
        try {
            const { data, error } = await supabase.from('organizations')
                .select('id')
                .eq('parent_organization_id', parentOrganizationId)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching organizations:', error);
                return;
            }

            const { data: permissionsData, error: permissionsError } = await supabase.from('users_permissions')
                .select('*')
                .order('created_at', { ascending: false })
                .in('organization_id', data.map(org => org.id));
            if (permissionsError) {
                console.error('Error fetching user profiles:', permissionsError);
                return; // data.map(org => org.id)
            }
            userPermissions.value = permissionsData || [];

            const { data: userProfilesData, error: userProfilesError } = await supabase.from('users_profile').select('*').in('id', userPermissions.value.map(permission => permission.user_id));
            if (userProfilesError) {
                console.error('Error fetching user profiles:', userProfilesError);
                return;
            }
            userProfiles.value = userProfilesData || [];
            
        } catch (e) {
            console.error('An unexpected error occurred:', e);
        }
    }

    async function _inviteOrganizationAdminDialog(organizationId) {
        if (!organizationId) {
            console.error('Organization ID is required to invite an admin.');
            return;
        }else{
            console.log('Inviting admin for organization ID:', organizationId);
        }
        dialogOrganization_id.value = organizationId; // Set the organization ID for the dialog
        emailDialog.value = true; // Open the dialog
    }
    
    async function _inviteOrganizationAdmin(organizationId) {
        const adminEmail = prompt('Enter administrator email:');
        if (adminEmail && adminEmail.trim() !== '' && organizationId) {
            try {
                const { data, error: supabaseError } = await supabase.functions.invoke('invite-user', {
                    method: 'POST',
                    body: {
                        email: adminEmail,
                        metaData: {
                            organization_type: '',
                            is_organization_admin: true, // Use is_organization_admin from attributes
                            organization_id: organizationId // Use organization ID from attributes
                        }
                    }
                });
                if (supabaseError) {
                    console.error('Error inviting administrator:', supabaseError);
                } else {
                    _getUsersProfileByOrganizationId(parent_organization_id.value); // Refresh the list of administrators
                    //await _requestData(organizationId); // Refresh the list of administrators
                }
            } catch (error) {
                console.error('Unexpected error:', error);
            }
        }
    }
    async function _removeUserPermission(event, userId, organizationId) {
        event.stopPropagation(); // Prevent the list item from expanding/collapsing
        
        if (!confirm('Are you sure you want to remove this user?')) {
            return;
        }
        
        try {
            const { error } = await supabase
            .from('users_permissions')
            .delete()
            .eq('user_id', userId)
            .eq('organization_id', organizationId);
            
            if (error) {
            console.error('Error removing user permission:', error);
            alert(`Error: ${error.message}`);
            } else {
            // Refresh the data
            await _getUsersProfileByOrganizationId(parent_organization_id.value);
            }
        } catch (e) {
            console.error('Unexpected error:', e);
            alert(`Unexpected error: ${e.message}`);
        }
    }

    const rules = {
        required: value => !!value || 'wird benötigt'
    };

</script>

<template>
  <v-alert color="warning" v-if="!parent_organization_id">
    <p class="text-center">Please select a parent organization to view its Lose.</p>
  </v-alert>
  <div v-else >
    <v-toolbar class="mb-4" color="transparent" style="border-bottom: 1px solid rgba(120, 120, 120, 0.12);">
        <v-btn icon="mdi-domain" variant="text"></v-btn>
        <v-toolbar-title>Organisationen</v-toolbar-title>
        <!-- Only if Admin -->
        <v-btn rounded="xl" variant="tonal" @click="isActive = true" v-if="props.is_admin">
            neu
            <v-icon>mdi-domain-plus</v-icon>
        </v-btn>
    </v-toolbar>

    <div class="text-center mb-4" v-if="!organizations.length">
        <v-alert type="warning" variant="tonal">
            Es wurden noch keine Organisationen hinzugefügt.<br/>Klicke auf "Neu", um eine neue Organisation hinzuzufügen.
        </v-alert>
    </div>

    <v-card v-for="organization in organizations" :key="organization.id" class="mb-4" variant="tonal">
        <v-card-item>
            {{ organization.name || organization.entityName }}
            <template v-slot:append  v-if="props.is_admin">
                <v-btn 
                    v-bind="props"
                    
                    variant="tonal"
                    rounded="xl"
                    @click="_inviteOrganizationAdminDialog(organization.id)"
                >
                    Einladen
                    <v-icon>mdi-email-plus</v-icon>
                </v-btn>
                <v-btn
                    icon="mdi-delete" 
                    variant="text" 
                    :loading="deleting[organization.id]"
                    :disabled="deleting[organization.id]"
                    v-if="props.is_admin"
                    @click="_removeOrganization(organization.id)"></v-btn>
            </template>
            <template v-if="is_organization_admin">
                <v-btn icon="mdi-pencil" variant="text" @click="_createOrganization(organization.name, organization.entityName, organization.parent_organization_id)"></v-btn>
            </template>
        </v-card-item>
        <v-card-text>
            <v-list v-if="userPermissions.map(permission => permission.organization_id).includes(organization.id)">
                <div v-for="permission in userPermissions || []" :key="permission.id">
                    <v-list-item :key="permission.id" prepend-icon="mdi-account" v-if="permission?.organization_id === organization?.id">
                        <v-list-item-title>{{ userProfiles.find(user => user && user.id === permission.user_id)?.email || 'Einladung noch nicht bestätigt.' }}</v-list-item-title>
                        <template v-slot:append>
                            <v-btn v-if="props.is_admin" icon="mdi-delete" variant="text" @click="(e) => _removeUserPermission(e, permission.user_id, permission.organization_id)"></v-btn>
                        </template>
                    </v-list-item>
                </div>
            </v-list>
            <div v-else>
                <v-list-item class="text-center text-body-2 text-medium-emphasis">
                    <v-icon class="mr-2" icon="mdi-email-plus"></v-icon><br/>
                    Es wurde noch kein Verantwortlicher für diese Organisation eingetragen.
                </v-list-item>
            </div>
        </v-card-text>
    </v-card>

    <!--<v-list lines="two">
        <v-list-item v-if="!organizations.length">
            <v-list-item-title class="text-center">Noch keine Organisationen eingetragen.</v-list-item-title>
        </v-list-item>
        <v-list-group v-for="organization in organizations" :key="organization.id">
            <template v-slot:activator="{ props: slotProps }">
                <v-list-item v-bind="slotProps" >
                    <template v-slot:append>
                        <v-tooltip location="top" text="Verantwortlichen hinzufügen">
                            <template v-slot:activator="{ props }">
                                <v-btn 
                                    v-bind="props"
                                    icon="mdi-account-plus"
                                    variant="text"
                                    @click="_inviteOrganizationAdmin(organization.id)"
                                ></v-btn>
                            </template>
                        </v-tooltip>
                    </template>
                    <v-list-item-title>{{ organization.entityName }}</v-list-item-title>
                    <v-list-item-subtitle>{{ organization.name }}</v-list-item-subtitle>
                </v-list-item>
            </template>
            <template v-for="permission in userPermissions" :key="permission.id">
                <v-list-item prepend-icon="mdi-account" v-if="permission && permission.organization_id && organization && permission.organization_id === organization.id">
                    <v-list-item-title>{{ userProfiles.find(user => user && user.id === permission.user_id)?.email || 'Noch nicht angemeldet' }}</v-list-item-title>
                    <template v-slot:append>
                        <v-btn v-if="props.is_admin" icon="mdi-delete" variant="text" @click="(e) => _removeUserPermission(e, permission.user_id, permission.organization_id)"></v-btn>
                    </template>
                </v-list-item>
            </template>
        </v-list-group>
    </v-list>-->
  </div>

  <DialogEmail 
        v-model="emailDialog"
        :organization_id="dialogOrganization_id"
        :showAdmins="true"
        :title="'Administrator einladen'"
    />

  <!-- Add Los/Company dialog -->
  <v-dialog v-model="isActive" max-width="500">
        <v-card  rounded="lg">
            <v-toolbar>
                <v-btn
                    icon="mdi-domain"
                ></v-btn>

                <v-toolbar-title>{{ 'Organisation hinzufügen' }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="isActive = false"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>
            <v-card-text>
                <p class="mb-6 text-body-2 text-medium-emphasis">
                    Bitte gib den Namen oder Firmierung der Organisation ein.
                </p>
                <v-form v-model="valid" @submit.prevent="_confirmAddLos">
                    <!--<v-text-field
                        v-model="losName"
                        :counter="150"
                        label="Name des Lose"
                        required
                    ></v-text-field>-->
                    <v-text-field
                        v-model="companyName"
                        :counter="150"
                        label="Name der Organisation"
                        placeholder="z.B. Thünen-Institut für Waldökosysteme"
                        required
                        rounded="xl"
                        variant="outlined"
                        :rules="[rules.required]"
                    ></v-text-field>
                    <v-btn type="submit" block :disabled="!valid" :loading="loading"  rounded="xl" color="primary"  class="my-3">Organisation hinzufügen</v-btn>
                </v-form>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>