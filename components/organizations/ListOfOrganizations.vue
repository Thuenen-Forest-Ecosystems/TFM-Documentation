<script setup>

    import { onMounted, ref, getCurrentInstance, useAttrs } from 'vue';
    import { createClient } from '@supabase/supabase-js'
    import { useRouter } from 'vitepress'

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const router = useRouter()

    const attrs = useAttrs();

    const parent_organization_id = ref(null);
    const organizations = ref([]);
    const user = ref(null);
    const userRole = ref(null); // Default to null if no role found

    const isActive = ref(false);
    const losName = ref('');
    const companyName = ref('');



  function _sortOrganizations(organizations) {
      return organizations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
            type: attrs.type || 'organization' // Default to 'organization' if not provided
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
      if (!losName.value) {
          alert('Please fill in all fields.'); // User feedback
          return;
      }
      await _createOrganization(companyName.value, losName.value,parent_organization_id.value);
      isActive.value = false; // Close the dialog
      losName.value = ''; // Reset input fields
      companyName.value = '';
  }

  async function _getOrganizationsByParentId(organizationId){
        let data, error;
        ({ data, error } = await supabase.from('organizations')
            .select()
            .eq('parent_organization_id', organizationId)
            .eq('type', attrs.type) // Ensure only active organizations are fetched
            .order('created_at', { ascending: false }));


      if (error) {
          console.error('Error fetching organizations by parent ID:', error);
          return;
      }
      if (data) {
          console.log('Organizations fetched:', data,organizationId );
          //  daba4e86-9c4e-4081-a8fb-e667e8d2aba3
          organizations.value = data;
      } else {
          console.log('No organizations found with parent id:', organizationId);
          organizations.value = []; // Reset if no data found
      }
  }
  async function _getUsersProfile(userId){
        const { data, error } = await supabase.from('users_profile').select('organization_id').eq('id', userId).single(); // Select only needed field
        if (error) {
            return;
        }
        if (data && data.organization_id) {
            parent_organization_id.value = data.organization_id; // Set the parent organization ID
            await _getOrganizationsByParentId(data.organization_id);
            await _getPermissions(data.organization_id); // Fetch permissions for the user
        } else {
            parent_organization_id.value = null; // Reset if not found
        }
  }
  function _navigateToOrganizationDetails(organizationId) {
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
        const {data, error} = await supabase.from('users_permissions').select('*').eq('organization_id', organizationId).eq('user_id', userId).single();
        if (error) {
            console.error('Error fetching permissions:', error);
            return null;
        }
        userRole.value = data?.role || null; // Default to null if no role found
    }

    onMounted(async () => {
        parent_organization_id.value = attrs.organization_id || null; // Get parent organization ID from props
        await _getOrganizationsByParentId(parent_organization_id.value);
        await _getPermissions(parent_organization_id.value); // Fetch permissions for the user
    });

</script>

<template>
  <v-alert color="warning" v-if="!parent_organization_id" class="mt-11">
    <p class="text-center">Please select a parent organization to view its Lose.</p>
  </v-alert>
  <div v-else class="mt-11">
    <v-toolbar>
      <v-toolbar-title>{{  attrs.title }}</v-toolbar-title>
      <!-- Only if Admin -->
      <v-btn rounded="xl" variant="tonal" @click="isActive = true" v-if="userRole === 'organization_admin'">
        <v-icon>mdi-plus</v-icon>
        Add Los
      </v-btn>
    </v-toolbar>
    <v-list lines="two">
        <div class="text-center mb-4" v-if="!organizations.length">
          <p>No Lose found.</p>
        </div>
        <v-list-item v-for="organization in organizations" :key="organization.id" @click="_navigateToOrganizationDetails(organization.id)">
          <v-list-item-title>{{ organization.entityName }}</v-list-item-title>
        <v-list-item-subtitle>{{ organization.name }}</v-list-item-subtitle>
          <template v-slot:append>
        </template>
        </v-list-item>
    </v-list>
  </div>

  <!-- Add Los/Company dialog -->
  <v-dialog v-model="isActive" max-width="500">
        <v-card title="Add Los and Company">
            <v-card-text>
                <v-form v-model="valid">
                    <v-text-field
                        v-model="losName"
                        :counter="150"
                        :rules="nameRules"
                        label="Name des Lose"
                        required
                    ></v-text-field>
                    <!--<v-text-field
                        v-model="companyName"
                        :counter="150"
                        :rules="nameRules"
                        label="Name der betreuenden Organisation"
                        required
                    ></v-text-field>-->
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-btn
                    text="Cancel"
                    variant="text"
                    @click="isActive = false"
                ></v-btn>
                <v-spacer></v-spacer>
                <v-btn
                    text="ADD"
                    variant="elevated"
                    color="primary"
                    rounded="xl"
                    @click="_confirmAddLos"
                ></v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>