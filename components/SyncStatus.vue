// ConnectionStatus.vue
<script setup>
    import { onMounted, ref, getCurrentInstance } from 'vue';

    import { useDatabase } from '../.vitepress/theme/composables/useDatabase'
    const { waitForDb } = useDatabase()

    // Get PowerSync from injection instead of using composable
    const syncState = ref({});

    const instance = getCurrentInstance();
    const db = instance.appContext.config.globalProperties.$db;

    onMounted(async () => {
        const db = await waitForDb()
       console.log(db);
        db.registerListener({
            statusChanged: (status) => {
                console.log('SyncStatus statusChanged', status);
                syncState.value = status;
            }
        });
       
    });
    

</script>

<template>
    <v-chip
        class="mt-4"
        v-if="!syncState.hasSynced"
        color="warning"
        outlined
    >
        Waiting for initial sync to complete.
    </v-chip>
    <v-chip
        class="mt-4"
        v-else
        color="success"
        outlined
    >
        <div>last synced at: {{ syncState.lastSyncedAt }}</div>
        <div v-if="syncState.dataFlowStatus?.uploading">Uploading...</div>
        <div v-if="syncState.dataFlowStatus?.downloading">Downloading...</div>
    </v-chip>
</template>