// ConnectionStatus.vue
<script setup>
    import { onMounted, ref } from 'vue';

    // PowerSync will be loaded dynamically on client-side
    let usePowerSync = null;
    const powersync = ref(null);
    const syncState = ref({});
    const isClient = ref(false);

    onMounted(async () => {
        isClient.value = true;
        
        try {
            // Dynamic import to avoid SSR issues
            const { usePowerSync: powerSyncComposable } = await import('@powersync/vue');
            usePowerSync = powerSyncComposable;
            powersync.value = usePowerSync();
            
            if (powersync.value?.value) {
                powersync.value.value.registerListener({
                    statusChanged: (status) => {
                        console.log('SyncStatus statusChanged', status);
                        syncState.value = status;
                    }
                });
                console.log('SyncStatus registered listener', powersync.value.value);
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