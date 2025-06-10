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

async function _removeClusterFromOrganization(clusterId) {

    if (!clusterId || !attrs.organization_id) return;

    try {
        const { data, error } = await supabase.from('cluster_permissions').delete().eq('id', clusterId);
        if (error) {
            console.error('Error removing cluster:', error);
            alert(`Error removing cluster: ${error.message}`);
        } else {
            clustersPermissions.value = clustersPermissions.value.filter(c => c.id !== clusterId);
        }
    } catch (e) {
        console.error('An unexpected error occurred while removing cluster:', e);
        alert(`An unexpected error occurred: ${e.message}`);
    }
}


async function _openAddClusterDialog() {
    const clusterName = prompt('Enter cluster name:');
    if (clusterName && clusterName.trim() !== '' && attrs.organization_id) {
        try {
            // Find the cluster ID based on the cluster name

            const clusterId = clusters.value.find(c => c.cluster_name.toString() === clusterName)?.id;
            if(!clusterId) {
                alert(`Cluster with name "${clusterName}" not found.`);
                return;
            }
            const { data, error } = await supabase.schema('public').from('cluster_permissions').insert({
                cluster_id: clusterId,
                organization_id: attrs.organization_id
            }).select().single();

            if (error) {
                console.error('Error adding cluster:', error);
                alert(`Error adding cluster: ${error.message}`);
            } else {
                clustersPermissions.value.push(data);
            }
        } catch (e) {
            console.error('An unexpected error occurred while adding cluster:', e);
            alert(`An unexpected error occurred: ${e.message}`);
        }
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
            console.log('sfsdf', data);
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

watch(() => [attrs.organization_id], ([newOrganizationId]) => {
    _requestCluster(newOrganizationId);
    _requestData(newOrganizationId);
});
onMounted(async () => {

     // Fetch clusters
    if (attrs.organization_id) {
        await _requestCluster(attrs.organization_id);
        await _requestData(attrs.organization_id);
    }
});
</script>

<template>
    {{ clusters.length }}
    <div v-if="attrs.organization_id">
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
</template>