---
title: Organizations
description: Manage your organizations and their administrators.
---

<script setup>
    
    import { onMounted, ref, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js'

    import ListOfOrganizations from '../../components/organizations/ListOfOrganizations.vue';
    import OrganizationsAdmins from '../../components/organizations/OrganizationsAdmins.vue';
    import ListOfTroops from '../../components/organizations/ListOfTroops.vue';
    import ListOfCluster from '../../components/organizations/ListOfCluster.vue';


    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const permissions = ref([]);
    const permission = ref({});

    const user = ref({});

    const currentOrganization = ref({});

    const _getOrganizationById = async (organizationId) => {
        const { data, error } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
        if (error) {
            console.error('Error fetching organization:', error);
            return null;
        }
        return data;
    };

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
        permission.value = permissions.value[0] || {};

        console.log(data);

        if (permission.value.organization_id) {
            currentOrganization.value = await _getOrganizationById(permission.value.organization_id);
            if (!currentOrganization.value) {
                console.error('Organization not found for ID:', permission.value.organization_id);
            }
        } else {
            console.warn('No organization ID found in permissions.');
        }

      } else {
          console.log('No active session found.');
      }
  });
</script>

{{ permission.is_organization_admin ? 'Organization Admin' : 'Organization Member' }}

# {{ currentOrganization.name || 'Organization Details' }}

## Organization Administrators
<OrganizationsAdmins :organization_id="permission.organization_id" :is_admin="permission.is_organization_admin" />

<v-divider></v-divider>

## Responsible for Cluster

Cluster für die Sie verantwortlich sind, können Sie hier verwalten.
<v-card>
    <ListOfCluster :organization_id="permission.organization_id" />
</v-card>

## Lose

Unterteilen Sie Cluster in Lose, die Sie hier verwalten können.
<ListOfOrganizations v-if="permission.is_organization_admin" :organization_id="permission.organization_id" type="organization" title="" />

## Truppen

Sie betreuen eignen Aufnahme-Trupps, die Sie hier verwalten können.
<ListOfTroops :organization_id="permission.organization_id" title="Trupps" :is_admin="permission.is_organization_admin" />



<div class="text-center mt-11 " >
    Organisation ID:<br/>
    <span class="text-caption text-grey">{{ currentOrganization.id }}</span>
</div>