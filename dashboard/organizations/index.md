---
title: Organizations
description: Manage your organizations and their administrators.
layout: home
---

<script setup>
    import { onMounted, onUnmounted, ref, watch, getCurrentInstance } from 'vue';
    import { onBeforeRouteLeave } from 'vue-router';

    import Firewall from '../../components/Firewall.vue';
    import { withBase } from "vitepress";
    import { FOREST_FILTER_FOREST, FOREST_FILTER_NON_FOREST, getForestStatusFilter, setForestStatusFilter, applyForestStatusFilter } from '../../components/Utils';

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

    const isAdmin = ref(false);
    const allPermissions = ref([]);
    const permission = ref({});

    const user = ref({});

    const currentOrganization = ref({});
    const cluster = ref([]);
    const loadingClusters = ref(false);
    const troopIds = ref([]);

    // Waldtrakte (cluster_status in (1,2,3,6)) vs. Nicht-Waldtrakte (4,5);
    // persisted in localStorage, only the selected subset is loaded.
    const forestFilter = ref(getForestStatusFilter());
    watch(forestFilter, async (newFilter) => {
        setForestStatusFilter(newFilter);
        if (!currentOrganization.value || !currentOrganization.value.id) {
            return;
        }
        await _requestPlots(currentOrganization.value.type, currentOrganization.value.id, troopIds.value);
    });

    // Cancel-and-restart bookkeeping: each _requestPlots call aborts a still
    // running load, and only the newest request may write records and clear
    // the loading state.
    let plotsRequestId = 0;
    let plotsAbortController = null;

    const tab = ref('3'); // Default tab

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
    const _getTroopsByOrganizationIdAndUserId = async (organizationId) => {
        const { data, error } = await supabase
            .from('troop')
            .select('*')
            .eq('organization_id', organizationId)
            .contains('user_ids', [user.value.id]); // user_ids is array
        if (error) {
            console.error('Error fetching troops:', error);
            return [];
        }
        return data;
    };

    function handleBeforeUnload(e) {
        const message = 'Es werden gerade Daten verarbeitet. Möchten Sie die Seite wirklich verlassen?';

        e.preventDefault();
        e.returnValue = message; // Required for Chrome
        return message;
    }

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

            allPermissions.value = permissionData;
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
        // Check if at least one permission with organization_id equals organizationId is_organization_admin equals true
        isAdmin.value = allPermissions.value.some(perm => perm.organization_id === organizationId && perm.is_organization_admin);

        if(!isAdmin.value) {
            permission.value = allPermissions.value.find(perm => perm.organization_id === organizationId && !perm.is_organization_admin) || {};
            const troops = await _getTroopsByOrganizationIdAndUserId(organizationId);
            troopIds.value = troops.map(troop => troop.id);
        }

        await _requestPlots(currentOrganization.value.type, currentOrganization.value.id, troopIds.value);


        //window.addEventListener('beforeunload', handleBeforeUnload);

    });
    onUnmounted(() => {
        //window.removeEventListener('beforeunload', handleBeforeUnload);
    });
    /*onBeforeRouteLeave((to, from, next) => {
        return false;
        next();
    });*/

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
    };
    const toApi = (organization) => {
        window.location.href = withBase('/dashboard/organizations/api?organization=' + organization.id);
    };

    // Globaly load records
    async function fetchAllDataPaginated(tableName, organizationId, companyType, troopFilter = null, signal = null) {
        let allData = [];
        let currentPage = 0;
        const pageSize = 10000; // Choose an appropriate page size

        while (true) {
            if (signal && signal.aborted) {
                return null;
            }

            const start = currentPage * pageSize;
            const end = start + pageSize - 1;

            let query = supabase
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
                .order('cluster_id', { ascending: true });

            // Only load Waldtrakte or Nicht-Waldtrakte depending on the toggle
            query = applyForestStatusFilter(query, forestFilter.value);

            // Conditionally add troop filter
            if (troopFilter && troopFilter.length > 0) {
                query = query.in('responsible_troop', troopFilter);
            }

            if (signal) {
                query = query.abortSignal(signal);
            }

            const { data, error } = await query.range(start, end);

            if (error) {
                if (signal && signal.aborted) {
                    return null; // request was cancelled, a newer one took over
                }
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
    async function _requestPlots(organizationType, organizationId, troopIds = []) {

        let companyType = null;

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
            loadingClusters.value = false;
            return;
        }

        // Cancel a still running load; the newest request wins.
        if (plotsAbortController) {
            plotsAbortController.abort();
        }
        plotsAbortController = new AbortController();
        const requestId = ++plotsRequestId;

        loadingClusters.value = true;
        try {
            const data = await fetchAllDataPaginated('view_records_details', organizationId, companyType, troopIds, plotsAbortController.signal);

            if (requestId !== plotsRequestId) {
                return; // superseded by a newer request
            }

            records.value = data;

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
        } finally {
            if (requestId === plotsRequestId) {
                loadingClusters.value = false;
            }
        }
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
<div v-if="currentOrganization && currentOrganization.id">

<v-toolbar color="transparent" flat>
    <v-toolbar-title>
        {{ currentOrganization.name || currentOrganization.entityName || 'Organization Details' }}<br/>
        <small>{{ currentOrganization.type == 'root' ? 'Bundesinventurleitung' : currentOrganization.type == 'country' ? 'Landesinventurleitung' : 'Dienstleister' }}</small>
    </v-toolbar-title>
        <v-btn v-if="permission.is_organization_admin" variant="outlined" @click="toEditOrganization(currentOrganization)" rounded="xl">
            <template v-slot:prepend>
                <v-icon>mdi-pencil</v-icon>
            </template>
            Administratoren bearbeiten
        </v-btn>
        &nbsp;
        <v-btn v-if="permission.is_organization_admin" variant="outlined" @click="toApi(currentOrganization)" rounded="xl">
            <template v-slot:prepend>
                <v-icon>mdi-download</v-icon>
            </template>
            Aktuelle Aufnahmen
        </v-btn>
        <template v-slot:extension>
            <v-tabs v-model="tab" align-tabs="center" class="mt-6">
                <!--<v-tab value="0">Statistik</v-tab>-->
                <v-tab value="3">
                    Ecken
                </v-tab>
                <v-tab value="4" v-if="currentOrganization.type !== 'provider'">{{currentOrganization.type == 'root' ? 'Organisationen' : 'Dienstleister'}}</v-tab>
                <v-tab value="5">Trupps</v-tab>
            </v-tabs>
        </template>
</v-toolbar>

<v-tabs-window v-model="tab" class="mt-4">
    <!--<v-tabs-window-item value="0">
        <OrganizationsStatistics :organization_id="currentOrganization.id" :organization_type="currentOrganization.type" :records="records" :loading="loadingClusters" />
    </v-tabs-window-item>-->
    <v-tabs-window-item value="3">
        <v-row class="my-2">
            <v-col>
                <!-- Toggle between Waldtrakte (cluster_status in (1,2,3,6)) und Nicht-Waldtrakte (cluster_status in (4,5)) -->
                <v-btn-toggle v-model="forestFilter" mandatory variant="outlined" rounded="xl" density="comfortable" divided>
                    <v-btn value="forest">
                        Waldtrakte
                    </v-btn>
                    <v-btn value="nonforest">
                        Nicht-Waldtrakte
                    </v-btn>
                </v-btn-toggle>
            </v-col>
            <v-spacer></v-spacer>
            <v-col class="d-flex justify-end" cols="12" md="4">
                <VimeoPlayer vimeoId="1132162497" h="8de2faac57" :btnTitle="'Tutorial'" title="Trakte verwalten" :iconOnly="false" />
            </v-col>
            </v-row>
        <ListOfClusterRecord :tab_active="tab == 3" :organization_id="currentOrganization.id" :organization_type="currentOrganization.type" :cluster="cluster" :records="records" :records_loading="loadingClusters" />
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
            <v-row class="mb-11">
                <v-col>
                    <p class="text-h5 ma-0">Trupp-Verwaltung</p>
                </v-col>
                <v-col class="d-flex justify-end" cols="12" md="4">
                    <VimeoPlayer vimeoId="1132135984" h="82c03dee0e" :btnTitle="'Tutorial'" title="Trupps verwalten" :iconOnly="false" />
                </v-col>
            </v-row>
            <v-card>
                <OrganizationsAdmins title="Trupp-Personal" :organization_id="permission.organization_id" :is_admin="permission.is_organization_admin" :showAdmins="false" key="trupp" />
                <p class="text-body-2 text-medium-emphasis px-2 ma-2 " style="background-color:rgba(0, 0, 0, 0.04)">
                    Trupp-Personal kann Trupps zugewiesen werden und sind für die Durchführung von Einsätzen verantwortlich.
                </p>
            </v-card>
            <v-divider class="my-8" />
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
</div>
</v-app>
</Firewall>

<style>
    .vp-doc.container{
        max-width: 5000px !important;
        margin: 0 auto;
    }
</style>
