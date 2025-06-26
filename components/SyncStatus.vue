// ConnectionStatus.vue
<script setup>
    import { usePowerSync } from '@powersync/vue';
    import { ref } from 'vue';

    const powersync = usePowerSync();

    const syncState = ref({});
    console.log('SyncStatus', syncState);

    powersync.value.registerListener({
        statusChanged: (status) => {
            syncState.value = status;
            console.log('SyncStatus statusChanged', status);
        }
    });

</script>

<template>
    <div v-if="!syncState.hasSynced">Waiting for initial sync to complete.</div>
    <div v-else>
        <div>Connected: {{ syncState.connected }}</div>
        <div>last synced at: {{ syncState.lastSyncedAt }}</div>
        <div v-if="syncState.dataFlowStatus.uploading">Uploading...</div>
        <div v-if="syncState.dataFlowStatus.downloading">Downloading...</div>
    </div>
</template>