<script setup>
    import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';
    import { getClustersAvailable } from '../Utils'

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const attrs = useAttrs();

    const clusters = ref([]);
    const page = ref(1);
    const itemsPerPage = ref(10);

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

    watch(() => attrs.organization_id, (newOrganizationId) => {
        if (newOrganizationId) {
            _requestCluster(newOrganizationId);
        }
    });

    onMounted(() => {
        if (!attrs.organization_id) {
            console.error('Error: organization_id is required.');
            return;
        }
        _requestCluster(attrs.organization_id);
    });
</script>
<template>
    <v-toolbar title="Clusters">
        <template v-slot:append>
            {{ clusters.length }}
        </template>
        
    </v-toolbar>
    <div>
        <v-list
            v-for="cluster in clusters.slice((page - 1) * itemsPerPage, page * itemsPerPage)"
            :key="cluster.id"
        >
            <v-list-item>
                <v-list-item-title>{{ cluster.cluster_name }}</v-list-item-title>
            </v-list-item>
        </v-list>
    </div>
    <v-pagination
      v-model="page"
      :length="Math.ceil(clusters.length / itemsPerPage)"
      rounded="circle"
    ></v-pagination>
    {{ attrs.organization_id }}
</template>