<script setup>
    import { ref, getCurrentInstance, onMounted } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;
    const url = instance.appContext.config.globalProperties.$url;

    const dbIsHealthy = ref(false);
    const dbLoading = ref(false);
    const dbErrorMessage = ref('');

    const ciLoading = ref(true);
    const ciIsHealthy = ref(false);
    const ciErrorMessage = ref('');

    const syncLoading = ref(true);
    const syncIsHealthy = ref(false);
    const syncErrorMessage = ref('');

    function dbHealthTest(){
        dbLoading.value = true;
        supabase.schema('inventory_archive').from('cluster').select('*').limit(1).then(({ data, error }) => {
            if (error) {
                dbIsHealthy.value = false;
                dbErrorMessage.value = error.message;
            } else {
                dbIsHealthy.value = true;
            }
        }).finally(() => {
            dbLoading.value = false;
        });
    }
    function syncHealthTest(){
        fetch('https://ci.thuenen.de/sync/probes/startup').then(response => {
            if (response.ok) {
                dbHealthTest();
                syncIsHealthy.value = true;
            } else {
                syncErrorMessage.value = `API responded with status ${response.status}`;
            }
            syncLoading.value = false;
        }).catch(error => {
            syncLoading.value = false;
            syncErrorMessage.value = error.message;
        });
    }
    function ciHealthTest(){
        ciLoading.value = true;
        fetch(url).then(response => {
            syncHealthTest();
            ciIsHealthy.value = true;
        }).catch(error => {
            ciIsHealthy.value = false;
            ciErrorMessage.value = error.message;
        }).finally(() => {
            ciLoading.value = false;
        });
    }

    onMounted(() => {
        ciHealthTest();
    });
</script>

<template>
    <h1 class="mt-11">BWI Database Health Check</h1>
    <v-container class="mt-11" max-width="600">

        <div class="text-h5 mt-11">Primary Services</div>

        <v-toolbar class="gb-transparent  mt-4">
            <v-toolbar-title>Server Check</v-toolbar-title>
            <template v-slot:append>
                <v-progress-circular v-if="ciLoading" indeterminate></v-progress-circular>
                <v-btn v-if="!ciLoading" @click="ciHealthTest" icon="mdi-reload"></v-btn>
            </template>
        </v-toolbar>
        
        <div v-if="!ciLoading">
            <v-alert v-if="ciIsHealthy" type="success" class="mt-4">
                Server is reachable
            </v-alert>
            <div v-else>
                <v-alert v-if="ciErrorMessage" type="warning" class="mt-4">
                    The connection to the server (https://ci.thuenen.de) could not be established.
                    <ul>
                        <li>Check your <b>network connection</b>.</li>
                        <li>Check your <b>firewall</b> settings.</li>
                    </ul>
                </v-alert>
                <p class="text-caption">
                    If you have checked all of the above and the issue persists, please contact the <a href="mailto:gerrit.balindt@thuenen.de">system administrator</a>.
                </p>
            </div>
        </div>

        <div class="text-h5 mt-11">Further Services</div>

        <v-toolbar class="gb-transparent  mt-4">
            <v-toolbar-title>Database</v-toolbar-title>
            <template v-slot:append>
                <v-progress-circular v-if="dbLoading" indeterminate></v-progress-circular>
                <v-btn v-if="!dbLoading" @click="dbHealthTest" icon="mdi-reload"></v-btn>
            </template>
        </v-toolbar>
        <div v-if="!dbLoading">
            <v-alert v-if="dbIsHealthy" type="success" class="mt-4">
                Database is healthy
            </v-alert>
            <div v-else>
                <v-alert v-if="dbErrorMessage" type="error" class="mt-4">
                    {{ dbErrorMessage }}
                </v-alert>
                <v-alert v-else type="error" class="mt-4">
                    Unknown error occurred
                </v-alert>
            </div>
        </div>

        <v-toolbar class="gb-transparent  mt-4">
            <v-toolbar-title>Synchronization</v-toolbar-title>
            <template v-slot:append>
                <v-progress-circular v-if="syncLoading" indeterminate></v-progress-circular>
                <v-btn v-if="!syncLoading" @click="syncHealthTest" icon="mdi-reload"></v-btn>
            </template>
        </v-toolbar>
        <div v-if="!syncLoading">
            <v-alert v-if="syncIsHealthy" type="success" class="mt-4">
                Synchronization is healthy
            </v-alert>
            <div v-else>
                <v-alert v-if="syncErrorMessage" type="error" class="mt-4">
                    {{ syncErrorMessage }}
                </v-alert>
                <v-alert v-else type="error" class="mt-4">
                    Unknown error occurred
                </v-alert>
            </div>
        </div>

    </v-container>
</template>