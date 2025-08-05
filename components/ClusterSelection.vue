<script setup>

    import { onMounted, ref, getCurrentInstance } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const selectedCluster = ref(null);
    const clusters = ref([]);
    const loading = ref(false);

     async function _requestcluster() {
        clusters.value = [];
        loading.value = true;

        await supabase
            .schema('inventory_archive')
            .from('cluster')
            .select('cluster_name, id')
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching clusters:', error);
                } else {
                    clusters.value = data;
                }
            })
            .catch((e) => console.error('An unexpected error occurred while fetching clusters:', e))
            .finally(() => {
                loading.value = false;
            });
    }
    onMounted(async () => {
        await _requestcluster();
    });
</script>


<template>
    <v-autocomplete
        v-model="selectedCluster"
        :items="clusters"
        item-title="cluster_name"
        item-value="id"
        :return-object="true"
        :clearable="true"
        label="Cluster auswählen"
        :loading="loading"
        @update:model-value="(value) => $emit('update:selectedCluster', value)"
    ></v-autocomplete>  

</template>