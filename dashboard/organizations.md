<script setup>
    
    import { onMounted, ref, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js'

    import ListOfOrganizations from '../components/organizations/ListOfOrganizations.vue';
    import OrganizationsAdmins from '../components/organizations/OrganizationsAdmins.vue';


    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const permissions = ref([]);
    const user = ref({});

    onMounted(async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
          console.error('Error getting session:', sessionError);
          return;
      }
      if (sessionData && sessionData.session) {
          user.value = sessionData.session.user;
          const { data, error } = await supabase.from('users_permissions').select('*').eq('user_id', user.value.id);
          if (error) {
              console.error('Error fetching user organization:', error);
              return;
          }
          permissions.value = data || [];
      } else {
          console.log('No active session found.');
      }
  });
</script>

# Organisation

Erstellen und verwalten Sie Nutzer und Lose, die zu Ihrer Organisation gehören.

## Administratoren

<div v-for="permission in permissions">
    <OrganizationsAdmins :organization_id="permission.organization_id"/>
    <h1>Lose</h1>
    <ListOfOrganizations v-if="permission.role === 'organization_admin'" :organization_id="permission.organization_id" type="organization" title="" />
    <h1>Truppen</h1>
    <ListOfOrganizations v-if="permission.role === 'organization_admin'" :organization_id="permission.organization_id" type="troop" title="" />
    <div class="text-center mt-11">
            Organisation ID: {{ permission.organization_id }}
    </div>
</div>

