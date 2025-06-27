// ConnectionStatus.vue
<script setup>
    import { onMounted, ref, watch } from 'vue';
    import { usePowerSyncSafe } from '../.vitepress/theme/composables/usePowerSyncSafe.js';

    const { powerSyncDB, isReady, error } = usePowerSyncSafe();
    const syncState = ref({});

    // Watch for PowerSync to be ready, then set up listener
    watch(isReady, (ready) => {
        if (ready && powerSyncDB) {
            try {
                powerSyncDB.registerListener({
                    statusChanged: (status) => {
                        console.log('SyncStatus statusChanged', status);
                        syncState.value = status;
                    }
                });
                console.log('SyncStatus registered listener', powerSyncDB);
            } catch (err) {
                console.error('Failed to register PowerSync listener:', err);
            }
        }
    });
"Error: A trailing forward slash \"/\" was found in the fetchCredentials endpoint: \"https://ci.thuenen.de/sync/\". Remove the trailing forward slash \"/\" to fix this error.\n    at WebRemote.fetchCredentials (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:103449)\n    at async WebRemote.prefetchCredentials (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:103298)\n    at async WebRemote.buildRequest (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:103777)\n    at async WebRemote.socketStreamRaw (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:105139)\n    at async WebRemote.socketStream (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:104847)\n    at async WebStreamingSyncImplementation.legacyStreamingSyncIteration (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:114299)\n    at async callback (http://localhost:5173/TFM-Documentation/node_modules/@powersync/common/dist/bundle.mjs?v=32742741:22:113646)"

</script>

<template>
    <div v-if="error">
        <div class="error">PowerSync Error: {{ error }}</div>
    </div>
    <div v-else-if="!isReady">
        <div>Loading sync status...</div>
    </div>
    <div v-else-if="!syncState.hasSynced">
        <div>Waiting for initial sync to complete.</div>
    </div>
    <div v-else>
        <div>Connected: {{ syncState.connected }}</div>
        <div>last synced at: {{ syncState.lastSyncedAt }}</div>
        <div v-if="syncState.dataFlowStatus?.uploading">Uploading...</div>
        <div v-if="syncState.dataFlowStatus?.downloading">Downloading...</div>
    </div>
</template>

<style scoped>
.error {
    color: #ff6b6b;
    padding: 8px;
    background-color: #ffe0e0;
    border-radius: 4px;
    margin: 8px 0;
}
</style>