// ConnectionStatus.vue
<script setup>

    const exampleJson = {
        "connected": true,
        "connecting": false,
        "dataFlow": {
            "uploading": false, "downloading": true,
            "downloadProgress": {
                "global[]": { "priority": 3, "at_last": 0, "since_last": 67275, "target_count": 67275 },
                "organizations[\"80980439-31fe-47b2-bbf3-312c2c06b90c\"]":
                    { "priority": 3, "at_last": 0, "since_last": 104902, "target_count": 104902 }
            }
        },
        "hasSynced": false,
        "priorityStatusEntries": []
    };

    import { onMounted, ref, getCurrentInstance } from 'vue';
    import { useDatabase } from '../.vitepress/theme/composables/useDatabase'

    const { waitForDb } = useDatabase()

    // Get PowerSync from injection instead of using composable
    const syncState = ref({});
    const downloadingPercent = ref(0);

    const instance = getCurrentInstance();
    const db = ref(null);

    // Define emits for the component
    const emit = defineEmits(['status-change']);

    function parseDownloading(downloadProgress){
        let globalSince = 0;
        let globalCount = 0;
        // loop through object downloadProgress
        for (const key in downloadProgress) {
            const element = downloadProgress[key];
            globalSince += element.since_last; // / element.target_count * 100;
            globalCount += element.target_count;
        }
        return globalCount > 0 ? globalSince / globalCount * 100 : 0;
    }

    onMounted(async () => {
        console.log('SyncStatus component mounted');
        
        // Add retry logic for full page refreshes
        let retryCount = 0;
        const maxRetries = 10;
        const retryDelay = 500; // 500ms between retries
        
        const initializeWithRetry = async () => {
            try {
                db.value = await waitForDb();
                
                if (!db.value) {
                    throw new Error('Database is null after waiting');
                }
                
                syncState.value = db.value.currentStatus;
                db.value.registerListener({
                    statusChanged: (status) => {
                        syncState.value = status;
                        emit('status-change', status);
                        if(status.dataFlowStatus?.downloadProgress){
                            downloadingPercent.value = parseDownloading(status.dataFlowStatus.downloadProgress);
                        }
                        
                    }
                });
                
                emit('status-change', db.value.currentStatus);
            } catch (error) {
                retryCount++;
                console.warn(`PowerSync initialization attempt ${retryCount} failed:`, error.message);
                
                if (retryCount < maxRetries) {
                    console.log(`Retrying in ${retryDelay}ms...`);
                    setTimeout(initializeWithRetry, retryDelay);
                } else {
                    console.error('PowerSync initialization failed after all retries:', error);
                    // Still continue - the component should show "not initialized" state
                }
            }
        };
        
        // Start the initialization with retry logic
        await initializeWithRetry();
    });
    

</script>

<template>
    <v-chip
        class="mt-4"
        v-if="!db"
        color="error"
        outlined
        @click="console.log('PowerSync WebSocket URL:', powersyncUrl)"
    >
        not initialized
    </v-chip>
    <v-chip
        class="mt-4"
        v-else-if="!syncState.connected"
        color="warning"
        outlined
        @click="console.log('PowerSync WebSocket URL:', powersyncUrl)"
    >
        not connected
    </v-chip>
    <v-chip
        class="mt-4"
        v-else
        color="success"
        outlined
    >
        <div v-if="syncState.lastSyncedAt">last synced at: {{ syncState.lastSyncedAt }}</div>
        <div v-if="syncState.dataFlowStatus?.uploading">Uploading...</div>
        <div v-if="syncState.dataFlowStatus?.downloading">
            <v-progress-circular
                :size="20"
                color="deep-orange-lighten-2"
                :model-value="downloadingPercent"
            ></v-progress-circular>
            Downloading...
        </div>
    </v-chip>
</template>