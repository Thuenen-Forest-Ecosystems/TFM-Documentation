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
    import VimeoPlayer from '../../components/VimeoPlayer.vue';
    import OrganizationsStatistics from '../../components/OrganizationsStatistics.vue';

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

    const tab = ref('0'); // Default tab

    const records = ref([]);

    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    const _getOrganizationById = async (organizationId) => {
        const { data, error } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
        if (error) {
            console.error('Error fetching organization:', error);
            return null;
        }
        return data;
    };

    onMounted(async () => {
        loadingClusters.value = true;
        currentOrganization.value = await _getOrganizationById(organizationId);


        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('Error getting session:', sessionError);
            return;
        }
        if (sessionData && sessionData.session) {

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
        await _requestPlots(currentOrganization.value.type, currentOrganization.value.id);
        loadingClusters.value = false;
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



    // Globaly load records
    async function fetchAllDataPaginated(tableName, organizationId, companyType) {
        let allData = [];
        let currentPage = 0;
        const pageSize = 10000; // Choose an appropriate page size

        while (true) {
            const start = currentPage * pageSize;
            const end = start + pageSize - 1;

            const { data, error } = await supabase
                .from(tableName)
                .select(`
                    cluster_id,
                    cluster_name,
                    plot_name,
                    plot_id,
                    updated_at,
                    responsible_state,
                    responsible_provider,
                    responsible_administration,
                    responsible_troop,
                    is_valid,
                    federal_state,
                    growth_district,
                    forest_status_bwi2022,
                    forest_status_ci2017,
                    forest_status_ci2012,
                    accessibility,
                    forest_office,
                    property_type,
                    ffh_forest_type_field,
                    center_location,
                    completed_at_state,
                    completed_at_administration,
                    completed_at_troop,
                    is_valid,
                    is_plausible,
                    note,
                    cluster_status,
                    cluster_situation,
                    state_responsible,
                    states_affected,
                    grid_density
                `)
                .eq(companyType, organizationId)
                .order('cluster_id', { ascending: true })
                .range(start, end); // <<-- deterministic order

            if (error) {
                console.error('Error fetching paginated data:', error);
                return null;
            }

            if (data.length === 0) {
                break; // No more data
            }

            allData = allData.concat(data);
            currentPage++;
        }

        return allData;
    }
    async function _requestPlots(organizationType, organizationId) {

        let companyType = null; //'responsible_state'; // responsible_administration

        switch (organizationType) {
            case 'root':
                companyType = 'responsible_administration';
                break;
            case 'country':
                companyType = 'responsible_state';
                break;
            case 'provider':
                companyType = 'responsible_provider';
                break;
        }
        if (!companyType) {
            console.warn('No company type or filter row defined for organization type:', organizationType);
            return;
        }

        records.value = await fetchAllDataPaginated('view_records_details', organizationId, companyType)

        if (records.value && records.value.length > 0) {

            snackbarText.value = `${records.value.length} Datensätze erfolgreich geladen.`;
            snackbarColor.value = 'success';
            snackbar.value = true;

        } else {
            snackbarText.value = 'Keine Datensätze gefunden für die Organisation.';
            snackbarColor.value = 'warning';
            snackbar.value = true;
        }

        return records || [];
    }
</script>

<v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
    {{ snackbarText }}
    <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
    </template>
</v-snackbar>
<Firewall>

<v-app style="background-color: transparent !important;">
<!--<v-btn density="compact" icon @click="toEditOrganization(currentOrganization)" class="position-absolute top-0 right-0">
        <v-icon>mdi-pencil</v-icon>
    </v-btn>-->
<div v-if="currentOrganization && currentOrganization.id">

<v-toolbar color="transparent" flat>
    <v-toolbar-title class="text-h5">
        {{ currentOrganization.name || currentOrganization.entityName || 'Organization Details' }}
    </v-toolbar-title>
        <!--
        <VimeoPlayer vimeoId="1109589414" :btnTitle="'Tutorial'" :title="'Cluster-Verwaltung für die CI/BWI'" :iconOnly="false" />
        -->
        <v-btn icon @click="toEditOrganization(currentOrganization)">
            <v-icon>mdi-pencil</v-icon>
        </v-btn>
        <template v-slot:extension>
            <v-tabs v-model="tab" align-tabs="center" class="mt-6">
                <!--<v-tab value="1">Mitarbeitende</v-tab>-->
                <v-tab value="0">Statistik</v-tab>
                <v-tab value="3">
                    Ecken
                </v-tab>
                <v-tab value="4" v-if="currentOrganization.type !== 'provider'">{{currentOrganization.type == 'root' ? 'Organisationen' : 'Dienstleister'}}</v-tab>
                <v-tab value="5">Trupps</v-tab>
            </v-tabs>
        </template>
</v-toolbar>

<v-tabs-window v-model="tab" class="mt-4">
    <v-tabs-window-item value="0">
        <OrganizationsStatistics :organization_id="currentOrganization.id" :organization_type="currentOrganization.type" :records="records" :loading="loadingClusters" />
    </v-tabs-window-item>
    <!--<v-tabs-window-item value="1">
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
    </v-tabs-window-item>-->
    <v-tabs-window-item value="3">
        <ListOfClusterRecord :organization_id="currentOrganization.id" :organization_type="currentOrganization.type" :cluster="cluster" :records="records" />
        <!--<RecordsOverview
            v-if="organizationId"
            :organization_id="currentOrganization.id"
            :organization_type="currentOrganization.type"
            :cluster="cluster"
        />
        <ListOfLose
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

<!--<div class="text-center mt-11 " >
    Organisation ID:<br/>
    <span class="text-caption text-grey">{{permission.organization_id}}</span>
</div>-->

</div>
</v-app>
</Firewall>

<style>
    .vp-doc.container{
        max-width: 5000px !important;
        margin: 0 auto;
    }
</style>