// ConnectionStatus.vue
<script setup>
    import { usePowerSync } from '@powersync/vue';
    import { onMounted, ref } from 'vue';

    const powersync = usePowerSync();

    const syncState = ref({});

    onMounted(() => {
        powersync.value.registerListener({
            statusChanged: (status) => {
                console.log('SyncStatus statusChanged', status);
                syncState.value = status;
            }
        });
        console.log('SyncStatus registered listener', powersync.value);
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