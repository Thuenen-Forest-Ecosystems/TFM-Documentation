// ConnectionStatus.vue
<script setup>
    import { onMounted, ref, inject } from 'vue';

    // Get PowerSync from injection instead of using composable
    const powerSyncDB = inject('powerSyncDB', null);
    const syncState = ref({});
    const isClient = ref(false);

    onMounted(async () => {
        isClient.value = true;
        
        try {
            // Wait a bit for PowerSync to be fully initialized
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (powerSyncDB && powerSyncDB.ready) {
                powerSyncDB.registerListener({
                    statusChanged: (status) => {
                        console.log('SyncStatus statusChanged', status);
                        syncState.value = status;
                    }
                });
                console.log('SyncStatus registered listener', powerSyncDB);
            } else {
                console.warn('PowerSync DB not available or not ready yet');
            }
        } catch (error) {
            console.error('Failed to load PowerSync:', error);
        }
    });
    

</script>

<template>
    <div v-if="!isClient">Loading sync status...</div>
    <div v-else-if="!syncState.hasSynced">Waiting for initial sync to complete.</div>
    <div v-else>
        <div>Connected: {{ syncState.connected }}</div>
        <div>last synced at: {{ syncState.lastSyncedAt }}</div>
        <div v-if="syncState.dataFlowStatus?.uploading">Uploading...</div>
        <div v-if="syncState.dataFlowStatus?.downloading">Downloading...</div>
    </div>
</template>