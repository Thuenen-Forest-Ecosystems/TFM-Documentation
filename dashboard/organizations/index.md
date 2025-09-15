---
title: Organizations
description: Manage your organizations and their administrators.
layout: home
---

<script setup>
    import { onMounted, ref, getCurrentInstance } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import { withBase } from "vitepress";

    import ListOfOrganizations from '../../components/organizations/ListOfOrganizations.vue';
    import OrganizationsAdmins from '../../components/organizations/OrganizationsAdmins.vue';
    import ListOfTroops from '../../components/organizations/ListOfTroops.vue';
    import ListOfCluster from '../../components/organizations/ListOfCluster.vue';
    import ListOfClusterRecord from '../../components/organizations/ListOfClusterRecord.vue';
    // import ListOfLose from '../../components/organizations/ListOfLose.vue';
    import RecordsOverview from '../../components/RecordsOverview.vue';
    import VimeoPlayer from '../../components/VimeoPlayer.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    // Get organization from URL query parameter - only in browser
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const organizationId = urlParams.get('organization');

    const permission = ref({});

    const user = ref({});

    const currentOrganization = ref({});
    const cluster = ref([]);
    const loadingClusters = ref(false);

    const tab = ref('3'); // Default tab

    const _getOrganizationById = async (organizationId) => {
        const { data, error } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
        if (error) {
            console.error('Error fetching organization:', error);
            return null;
        }
        return data;
    };
    async function _requestcluster() {
        loadingClusters.value = true;
        cluster.value = [];
        const { data, error } = await supabase.rpc('get_user_clusters');

        if (error) {
            console.error('Error fetching clusters:', error);
        } else {
            console.log('Fetched clusters:', data);
            cluster.value = data;
            loadingClusters.value = false;
        }
        /*await supabase
            .schema('inventory_archive')
            .from('cluster')
            .select('*')
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching clusters:', error);
                } else {
                    cluster.value = data;
                }
            })
            .catch((e) => console.error('An unexpected error occurred while fetching clusters:', e))
            .finally(() => {
                loadingClusters.value = false;
            });*/
    }

    onMounted(async () => {

        currentOrganization.value = await _getOrganizationById(organizationId);


        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('Error getting session:', sessionError);
            return;
        }
        if (sessionData && sessionData.session) {

            _requestcluster();

            user.value = sessionData.session.user;

            console.log('User:', user.value);
            const { data: permissionData, error: permissionError } = await supabase
                .from('users_permissions')
                .select('*')
                .eq('user_id', user.value.id)
                .eq('organization_id', organizationId);

            if (permissionError || !permissionData) {
                console.error('Error fetching user organization:', permissionError);
                return;
            }

            permission.value = permissionData[0] || {};

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

    const toEditOrganization = (organization) => {
        window.location.href = withBase('/dashboard/organizations/administration?organization=' + organization.id);
    }
</script>


<Firewall>
<v-app style="background-color: transparent !important;">
<v-btn density="compact" icon @click="toEditOrganization(currentOrganization)" class="position-absolute top-0 right-0">
        <v-icon>mdi-pencil</v-icon>
    </v-btn>
<div class="mt-11" v-if="currentOrganization && currentOrganization.id">


<div class="text-center mt-4">
    <p class="text-h2 text-weight-bold">
        {{ currentOrganization.name || currentOrganization.entityName || 'Organization Details' }}
    </p>
    <p class="mb-4">
        Verwalten Sie Mitarbeitende, Cluster, Lose und Dienstleister.
    </p>
    <VimeoPlayer :btnTitle="'Info Video abspielen'" :title="'Cluster-Verwaltung für die CI/BWI'" />
   
</div>

 

<v-tabs v-model="tab" align-tabs="center" class="mt-6">
    <!--<v-tab value="1">Mitarbeitende</v-tab>-->
    <v-tab value="3">Ecken</v-tab>
    <v-tab value="4" v-if="currentOrganization.type !== 'provider'">{{currentOrganization.type == 'root' ? 'Organisationen' : 'Dienstleister'}}</v-tab>
    <v-tab value="5">Trupps</v-tab>
</v-tabs>
<v-tabs-window v-model="tab" class="mt-4">
    <v-tabs-window-item value="1">
        <v-card variant="tonal" class="mb-4">
            <OrganizationsAdmins title="Administratoren" :organization_id="permission.organization_id" :is_admin="permission.is_organization_admin" :showAdmins="true" key="admin" />
            <p class="text-body-2 text-medium-emphasis px-2 ma-1" style="background-color:rgba(0, 0, 0, 0.04)">
                Administratoren können Lose, Trupps und Dienstleister verwalten.
            </p>
        </v-card>
    </v-tabs-window-item>
    <v-tabs-window-item value="2">
        <p class="mb-5">
            Eine Liste aller Cluster, die ihrer Organisation zugewiesen wurden.
        </p>
        <ListOfClusterRecord v-if="currentSyncStatus.hasSynced" :organization_id="permission.organization_id" />
        <v-alert
            v-if="!currentSyncStatus.hasSynced"
            density="compact"
            text="Warten Sie, bis die Synchronisation abgeschlossen ist."
            title="Synchronisation läuft"
            type="warning"
        ></v-alert>
    </v-tabs-window-item>
    <v-tabs-window-item value="3">
        <RecordsOverview
            v-if="organizationId && cluster.length"
            :organization_id="currentOrganization.id"
            :organization_type="currentOrganization.type"
            :cluster="cluster"
        />
        <!--<ListOfLose
            v-if="organizationId"
            :organization_id="currentOrganization.id"
            :organization_type="currentOrganization.type"
            :title="'Lose'" 
            :is_admin="permission.is_organization_admin || false"
            :is_root="currentOrganization.is_root || false"
            :cluster="cluster"
        />-->
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
        <v-container max-width="1000px">
            <OrganizationsAdmins title="Trupp Mitarbeitende" :organization_id="permission.organization_id" :is_admin="permission.is_organization_admin" :showAdmins="false" key="trupp" />
            <p class="text-body-2 text-medium-emphasis px-2 ma-2 " style="background-color:rgba(0, 0, 0, 0.04)">
                Trupp Mitarbeitende können Trupps zugewiesen werden und sind für die Durchführung von Einsätzen verantwortlich. Sie können keine Lose oder Dienstleister verwalten.
            </p>
            <ListOfTroops 
                v-if="organizationId"
                :organization_id="organizationId" 
                :title="'Trupps'" 
                :is_admin="permission.is_organization_admin || false"
                class="mt-11"
            />
        </v-container>
    </v-tabs-window-item>
</v-tabs-window>

<div class="text-center mt-11 " >
    Organisation ID:<br/>
    <span class="text-caption text-grey">{{permission.organization_id}}</span>
</div>

</div>
</v-app>
</Firewall>

<style>
    .vp-doc.container{
        max-width: 5000px !important;
        margin: 0 auto;
    }
</style>