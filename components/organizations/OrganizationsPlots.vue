<script setup>
import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
import { createClient } from '@supabase/supabase-js'
import { getClustersAvailable } from '../Utils';

const instance = getCurrentInstance();
const apikey = instance.appContext.config.globalProperties.$apikey;
const url = instance.appContext.config.globalProperties.$url;

const supabase = createClient(url, apikey);

const attrs = useAttrs();

const clusters = ref([]);
const clustersPermissions = ref([]);
const loadingClusters = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('info');

async function _removeClusterFromOrganization(clusterId) {
    console.log('Removing cluster with ID:', attrs.organizationsDetail);
    if (!clusterId || !attrs.organizationsDetail.id) return;
    
    try {
        const { data, error } = await supabase.from('cluster_permissions').delete().eq('id', clusterId);
        if (error) {
            console.error('Error removing cluster:', error);
            snackbarText.value = `Error removing cluster: ${error.message}`;
            snackbarColor.value = 'error';
            snackbar.value = true;
        } else {
            clustersPermissions.value = clustersPermissions.value.filter(c => c.id !== clusterId);
            snackbarText.value = 'Cluster removed successfully.';
            snackbarColor.value = 'success';
            snackbar.value = true;
        }
    } catch (e) {
        console.error('An unexpected error occurred while removing cluster:', e);
        snackbarText.value = `An unexpected error occurred: ${e.message}`;
        snackbarColor.value = 'error';
        snackbar.value = true;
    }
}


async function _openAddClusterDialog() {
    const clusterName = prompt('Enter cluster name:');

    const clusterNameArray = clusterName ? clusterName.split(',') : [];
    if (!clusterNameArray || clusterNameArray.length === 0) {
        return;
    }
    // Trim whitespace from each cluster name
    const trimmedClusterNames = clusterNameArray.map(name => name.trim()).filter(name => name !== '');
    if (trimmedClusterNames.length === 0) {
        snackbarText.value = 'No valid cluster names provided.';
        snackbar.value = true;
        snackbarColor.value = 'error';
        return;
    }

    // all names must be unique
    const uniqueClusterNames = [...new Set(trimmedClusterNames)];

    // convert all uniqueClusterNames to integer or remove if not a number
    const uniqueClusterNamesInteger = uniqueClusterNames.map(name => {
        const num = parseInt(name, 10);
        return isNaN(num) ? null : num;
    }).filter(name => name !== null);

    // Filter out clusters that are already added
    const existingClusterNames = clustersPermissions.value.map(c => clusters.value.find(cluster => cluster.id === c.cluster_id)?.cluster_name);
    const newClusterNames = uniqueClusterNamesInteger.filter(name => !existingClusterNames.includes(name));

    // Only clusterNames that are in the clusters list
    const validClusterNames = newClusterNames.filter(name => clusters.value.some(cluster => cluster.cluster_name.toString() === name.toString()));

    if (validClusterNames.length > 0 && attrs.organizationsDetail.id) {
        try {
            // Find the cluster ID based on the cluster name

            const { data, error } = await supabase.schema('public').from('cluster_permissions').insert(validClusterNames.map(name => ({
                cluster_id: clusters.value.find(c => c.cluster_name.toString() === name.toString())?.id,
                organization_id: attrs.organizationsDetail.id
            })));

            if (error) {
                console.error('Error adding cluster:', error);
                snackbarText.value = `Error adding cluster: ${error.message}`;
                snackbarColor.value = 'error';
                snackbar.value = true;
            } else {
                _requestData(attrs.organizationsDetail.id); // Refresh the list of clusters
                snackbarText.value = 'Cluster(s) added successfully.';
                snackbarColor.value = 'success';
                snackbar.value = true;
            }
        } catch (e) {
            console.error('An unexpected error occurred while adding cluster:', e);
            alert(`An unexpected error occurred: ${e.message}`);
        }
    }else {
        snackbarText.value = 'No valid clusters to add.';
        snackbar.value = true;
        snackbarColor.value = 'error';
    }
}

async function _requestAllCluster(organizationId) { // Thünen only
    if (!organizationId) return;

    try {
        loadingClusters.value = true;
        const { data, error } = await supabase.schema('inventory_archive').from('cluster').select(`id, cluster_name, state_responsible, states_affected`);
        loadingClusters.value = false;
        if (error) {
            console.error('Error fetching organization data:', error);
            return;
        }
        clusters.value = data || [];
    } catch (e) {
        console.error('An unexpected error occurred:', e);
    }
}
async function _requestCluster(organizationId) { // Thünen only
    if (!organizationId) return;

    

    clusters.value = []; // Reset clusters before fetching new data
    await getClustersAvailable(supabase, organizationId)
        .then(data => {
            clusters.value = data;
        })
        .catch(error => {
            console.error('Error fetching clusters:', error);
        });
}
async function _requestData(organizationId) { // Thünen only
    if (!organizationId) return;
    try {
        loadingClusters.value = true;
        const { data, error } = await supabase.from('cluster_permissions').select(`*`).eq('organization_id', organizationId);
        loadingClusters.value = false;
        if (error) {
            console.error('Error fetching organization data:', error);
            return;
        }

        clustersPermissions.value = data || [];
    } catch (e) {
        console.error('An unexpected error occurred:', e);
    }
}

watch(() => [attrs.organizationsDetail], ([newOrganizationId]) => {
    _requestCluster(newOrganizationId.parent_organization_id);
    _requestData(newOrganizationId.id);
});
onMounted(async () => {

     // Fetch clusters
    if (attrs.organizationsDetail) {
        await _requestCluster(attrs.organizationsDetail.parent_organization_id);
        await _requestData(attrs.organizationsDetail.id);
    }
});
</script>

<template>
    {{ clusters.length }}
    <div v-if="attrs.organizationsDetail.id">
        <v-toolbar>
            <v-btn icon="mdi-scatter-plot"></v-btn>
            <v-toolbar-title>Cluster</v-toolbar-title>
            <v-btn v-if="!loadingClusters && clusters.length > 0" rounded="xl" variant="tonal" @click="_openAddClusterDialog">
                <v-icon>mdi-plus</v-icon>
                add cluster
            </v-btn>
        </v-toolbar>
        <v-list lines="two">
            <div class="text-center mb-4" v-if="!clustersPermissions.length && !loadingClusters">
                <p>No cluster available.</p>
            </div>
            <v-list-item v-if="loadingClusters">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
            </v-list-item>

            <!-- Display clusters by page -->
            <v-list-item v-for="cluster in clustersPermissions" :key="cluster.id">
                <v-list-item-title>{{ clusters.find(c => c.id === cluster.cluster_id)?.cluster_name }}</v-list-item-title>
                <v-list-item-subtitle>Responsible: {{ clusters.find(c => c.id === cluster.cluster_id)?.state_responsible }}</v-list-item-subtitle>
                <template v-slot:append>
                    <v-avatar>
                        <v-icon icon="mdi-delete" @click="_removeClusterFromOrganization(cluster.id)"></v-icon>
                    </v-avatar>
                </template>
            </v-list-item>

        </v-list>
    </div>
    <div v-else>
        <p>No organization selected.</p>
    </div>
    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>