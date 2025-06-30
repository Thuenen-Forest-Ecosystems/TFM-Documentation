<script setup>
    import { getCurrentInstance, ref, onMounted, watch } from 'vue';

    import { useDatabase } from '../../.vitepress/theme/composables/useDatabase'
    const { waitForDb } = useDatabase()

    let db = ref(null);

    const clusterListInput = ref('');
    const loading = ref(false);
    const valid = ref(false)
    const error = ref('')
    const success = ref('')

    const availableClusters = ref([]);
    const validClusterList = ref([]);

    const props = defineProps({
        modelValue: Boolean,
        selectedLos: Object
    });

    onMounted(async () => {
        loading.value = true;
        db  = await waitForDb(); 
        getAvailableCluster();
    });
    function addSelectedClusterIds(){
        validClusterList.value = availableClusters.value.filter(c => props.selectedLos.cluster_ids.includes(c.cluster_id));
    }
    watch(() => props.selectedLos, (newValue) => {
        addSelectedClusterIds();
        resetForm();
    }, { immediate: true });

    const emit = defineEmits([
        'update:modelValue',
        'confirm'
    ]);

    function cancelAction() {
        emit('update:modelValue', false); // Close the dialog
    }
    const rules = {
        required: value => !!value || 'wird benötigt',
        commaSperatedListOfNumbers: value => {
            if (!value) return true; // Skip validation if empty
            const numbers = value.split(',').map(v => v.trim());
            const allNumbers = numbers.every(v => /^\d+$/.test(v));
            return allNumbers || 'Bitte eine Liste von Zahlen eingeben, getrennt durch Kommas';
        }
    };

    async function getAvailableCluster(){
        db.getAll('SELECT cluster_name, cluster_id FROM records GROUP BY cluster_name')
            .then((l) => {
                availableClusters.value = l;
                loading.value = false;
                if (props.selectedLos && props.selectedLos.cluster_ids) {
                    addSelectedClusterIds();
                } else {
                    validClusterList.value = [];
                }
            })
            .catch((e) => console.error(e));
    }

    async function handleFileUpload(fileInputEvent){
        const file = fileInputEvent.target.files[0];
        if (!file) {
            error.value = 'Keine Datei ausgewählt.';
            return;
        }

        loading.value = true;
        error.value = '';
        success.value = '';

        try {
            const text = await file.text();
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            //
            const numbers = lines.flatMap(line => line.split(',').map(v => v.trim()).filter(v => /^\d+$/.test(v)));
            clusterListInput.value = numbers.join(',');
            addValues(clusterListInput.value);
        } catch (e) {
            error.value = 'Fehler beim Verarbeiten der Datei: ' + e.message;
        } finally {
            loading.value = false;
        }

    }
    async function onSubmit(){
        if (!valid.value) {
            error.value = 'Bitte überprüfe die Eingaben.';
            return;
        }
        if (!clusterListInput.value) {
            error.value = 'Cluster-IDs werden benötigt.';
            return;
        }
        addValues(clusterListInput.value);
    }
    function resetForm() {
        clusterListInput.value = '';
        valid.value = false;
        error.value = '';
        success.value = '';
    }
    async function addValues(newValuesList) {

        //loading.value = true;
        const clusterList = newValuesList.split(',').map(v => v.trim());
        const clusterListIntegerList = clusterList.map(v => parseInt(v, 10)).filter(v => !isNaN(v));

        //return records in availableClusters where cluster_name matches
        const newClusters = availableClusters.value.filter(c => clusterListIntegerList.includes(c.cluster_name));

        //filter from available Cluster e.g. ['cluster1', 'cluster2']
        const allNewClusters = [...validClusterList.value, ...newClusters]; 

        validClusterList.value = [...new Set(allNewClusters)];

        resetForm();

    }
    function openFileDialog() {
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.click();
        }
    }

    async function addCluster() {

        loading.value = true;
        error.value = '';
        success.value = '';       

        try {

            /*await db.execute('UPDATE organizations_lose SET cluster_ids = ? WHERE id = ?', [
                JSON.stringify(validClusterList.value.map(c => c.cluster_id)),
                props.selectedLos.id
            ]).then(() => {
                console.log( JSON.stringify(validClusterList.value.map(c => c.cluster_id)) );
                
            }).catch((e) => {
                console.error('Error updating records:', e);
                throw e; // Re-throw to handle in catch block
            });*/
            
            success.value = `Erfolgreich ${validClusterList.value.length} Trakte zugeordnet.`;
            emit('update:modelValue', false); // Close the dialog
            emit('confirm', props.selectedLos, validClusterList.value.map(c => c.cluster_id)); // Emit the selected cluster IDs
            resetForm();
            validClusterList.value = [];
        } catch (e) {
            error.value = 'Fehler beim Zuordnen der Trakte: ' + e.message;
        } finally {
            loading.value = false;
        }
    }
    function removeCluster(clusterId) {
        validClusterList.value = validClusterList.value.filter(c => c.cluster_id !== clusterId);
        console.log('Cluster removed:', clusterId);
    }

</script>


<template>
    <v-dialog v-model="props.modelValue" max-width="500" @click:outside="cancelAction">
        <v-card  rounded="lg">
            <v-toolbar>
                <v-btn
                    icon="mdi-email"
                ></v-btn>

                <v-toolbar-title>LOS: {{ props.selectedLos.name || 'Trakte zuordnen' }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="cancelAction"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>
            
            <v-card-text>
                <v-form v-model="valid" @submit.prevent="onSubmit">
                    <v-row class="my-4">
                        <v-text-field
                            label="Traktnummer(n)"
                            persistent-hint
                            type="text"
                            v-model.trim="clusterListInput"
                            
                            rounded="xl"
                            variant="outlined"
                            :rules="[rules.required, rules.commaSperatedListOfNumbers]"
                        ></v-text-field>
                        <v-btn type="submit" icon="mdi-send" :disabled="!valid" :loading="loading" color="primary" class="mx-2" ></v-btn>
                        <v-btn @click="openFileDialog" icon="mdi-file-delimited" :loading="loading" color="primary" ></v-btn>
                        <v-file-input  accept=".csv, text/plain" label="wähle eine Datei" @change="handleFileUpload" style="display: none;"></v-file-input>
                    </v-row>
                </v-form>

                <v-chip-group
                    v-if="validClusterList.length > 0"
                    class="my-4"
                    column
                >
                    <v-chip
                        v-for="(cluster, index) in validClusterList"
                        :key="index"
                        color="primary"
                        text-color="white"
                        class="ma-1"
                        append-icon="mdi-close"
                        @click="removeCluster(cluster.cluster_id)"
                    >
                        {{ cluster.cluster_name }}
                    </v-chip>
                </v-chip-group>

                <v-btn @click="addCluster" block :loading="loading"  rounded="xl" color="primary"  class="my-3"> ({{ validClusterList.length }}) Trakte dem Los zuordnen</v-btn>

            </v-card-text>
        </v-card>
    </v-dialog>
</template>