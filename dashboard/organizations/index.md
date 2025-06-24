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
    import ListOfClusterRecord from '../../components/organizations/ListOfClusterRecord.vue';
    import ListOfLose from '../../components/organizations/ListOfLose.vue';


    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    // Get organization from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const organizationId = urlParams.get('organization');

    const permission = ref({});

    const user = ref({});

    const currentOrganization = ref({});

    const tab = ref('3'); // Default tab

    const _getOrganizationById = async (organizationId) => {
        const { data, error } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
        if (error) {
            console.error('Error fetching organization:', error);
            return null;
        }
        return data;
    };

    onMounted(async () => {

        currentOrganization.value = await _getOrganizationById(organizationId);

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('Error getting session:', sessionError);
            return;
        }
        if (sessionData && sessionData.session) {
            user.value = sessionData.session.user;

            const { data: permissionData, error: permissionError } = await supabase
                .from('users_permissions')
                .select('*')
                .eq('user_id', user.value.id)
                .eq('organization_id', organizationId)
                .single();

            if (permissionError) {
                console.error('Error fetching user organization:', permissionError);
                return;
            }

            permission.value = permissionData || {};

            if (permission.value.organization_id) {
                currentOrganization.value = await _getOrganizationById(organizationId);
                if (!currentOrganization.value) {
                    console.error('Organization not found for ID:', organizationId);
                }
            } else {
                console.warn('No organization ID found in permissions.');
            }

        }
    });
    const _getChildOrganizationType = () => {
        if (currentOrganization.value.type === 'root') {
            return 'country';
        } else if (currentOrganization.value.type === 'country') {
            return 'provider';
        } else {
            return null;
        }
    }
</script>

<div class="text-center mt-4">
    <h1>
        {{ currentOrganization.name || currentOrganization.entityName || 'Organization Details' }}
    </h1>
    Verwalten Sie Mitarbeitende, Cluster, Lose und Dienstleister.
</div>
<hr/>

<v-tabs v-model="tab" align-tabs="center" class="mt-6">
    <v-tab value="1">Mitarbeitende</v-tab>
    <v-tab value="2">Cluster</v-tab>
    <v-tab value="3">Lose</v-tab>
    <v-tab value="4" v-if="currentOrganization.type !== 'provider'">{{currentOrganization.type == 'root' ? 'Landesinventurleitung' : 'Dienstleister'}}</v-tab>
    <v-tab value="5">Trupps</v-tab>
</v-tabs>
<v-tabs-window v-model="tab" class="mt-4">
    <v-tabs-window-item value="1">
        <v-card variant="tonal" class="mb-4">
            <OrganizationsAdmins title="Administratoren" :organization_id="permission.organization_id" :is_admin="permission.is_organization_admin" :showAdmins="true" key="admin" />
            <p class="text-body-2 text-medium-emphasis px-2 my-0" style="background-color:rgba(0, 0, 0, 0.04)">
                Administratoren können Lose, Trupps und Dienstleister verwalten.
            </p>
        </v-card>
        <v-card variant="tonal">
            <OrganizationsAdmins title="Trupp Mitarbeitende" :organization_id="permission.organization_id" :is_admin="permission.is_organization_admin" :showAdmins="false" key="trupp" />
            <p class="text-body-2 text-medium-emphasis px-2 my-0 " style="background-color:rgba(0, 0, 0, 0.04)">
                Trupp Mitarbeitende können Trupps zugewiesen werden und sind für die Durchführung von Einsätzen verantwortlich. Sie können keine Lose oder Dienstleister verwalten.
            </p>
        </v-card>
    </v-tabs-window-item>
    <v-tabs-window-item value="2">
        <p>
            Eine Liste aller Cluster, die in ihrer Organisation zugewiesen wurden.
        </p>
        <v-card>
            <ListOfClusterRecord :organization_id="permission.organization_id" />
        </v-card>
    </v-tabs-window-item>
    <v-tabs-window-item value="3">
        <ListOfLose
            v-if="organizationId"
            :organization_id="organizationId" 
            :title="'Lose'" 
            :is_admin="permission.is_organization_admin || false"
        />
    </v-tabs-window-item>
    <v-tabs-window-item value="4" v-if="currentOrganization.type !== 'provider'">
        <ListOfOrganizations
            v-if="organizationId && currentOrganization"
            :organization_id="organizationId"
            :type="_getChildOrganizationType()"
            :title="currentOrganization.type == 'root' ? 'Landesinventurleitung' : 'Dienstleister'"
            :is_admin="permission.is_organization_admin || false"
        />
    </v-tabs-window-item>
    <v-tabs-window-item value="5">
        <ListOfTroops 
            v-if="organizationId"
            :organization_id="organizationId" 
            :title="'Trupps'" 
            :is_admin="permission.is_organization_admin || false"
        />
    </v-tabs-window-item>
</v-tabs-window>
<hr/>
<div class="text-center mt-11 " >
    Organisation ID:<br/>
    <span class="text-caption text-grey">{{ currentOrganization.id }}</span>
</div>