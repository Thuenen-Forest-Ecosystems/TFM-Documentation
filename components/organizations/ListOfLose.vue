<script setup>
    import { getCurrentInstance, onMounted, useAttrs, ref, watch } from 'vue';
    import { useRouter } from 'vitepress'
    import DialogResponsible from './DialogResponsible.vue';


    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const lose = ref([]);
    const router = useRouter()

    const clustersAssigned = ref([]);
    const availableClusters = ref([]);
    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('info');

    const selectedLos = ref(null);

    const responsibleDialog = ref(false);

    const troops = ref([]);
    const companies = ref([]);

    const props = defineProps({
        organization_id: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: ''
        },
        is_admin: {
            type: Boolean,
            default: false
        }
    });

    async function _getTroops() {
        if (!props.organization_id) return [];
        try {
            const { data, error } = await supabase
                .from('troop')
                .select('*')
                .eq('organization_id', props.organization_id);
            if (error) {
                console.error('Error fetching troops:', error);
                return [];
            }
            troops.value = data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching troops:', e);
            return [];
        }
    }
    async function _getCompanies(){
        if (!props.organization_id) return [];
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('parent_organization_id', props.organization_id);
            if (error) {
                console.error('Error fetching companies:', error);
                return [];
            }
            companies.value = data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching companies:', e);
            return [];
        }
    }

    async function _updateAssignedClusters(clusterData){
        // 
        const assignedClusterIds = [];
        for (const los of clusterData) {
            if (los.cluster_ids && los.cluster_ids.length > 0) {
                assignedClusterIds.push(...los.cluster_ids);
            }
        }

        // get data from records table
        const {data, error} = await supabase.from('records').select('id:cluster_id, cluster_name').in('cluster_id', assignedClusterIds);
        console.log(data);
        if (error) {
            console.error('Error fetching clusters:', error);
            return;
        }
        clustersAssigned.value = data;
        return;

        const clusterIds = clusterData.map(item => item.cluster_id);
        clustersAssigned.value.push(...clusterIds);
    }
    function _requestData(organizationId) {
        if (!organizationId) {
            console.error('Error: organization_id is required.');
            return;
        }

        supabase
            .from('organizations_lose')
            .select('*')
            .eq('organization_id', organizationId)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching lose:', error);
                } else {
                    lose.value = data || [];
                    _updateAssignedClusters(lose.value);
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while fetching lose:', e);
            });
    }

    function _addLose() {
        const loseName = prompt('Enter lose name:');

        if (loseName && props.organization_id) {
            supabase
                .from('organizations_lose')
                .insert({ 
                    name: loseName,
                    organization_id: props.organization_id
                })
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error adding lose:', error);
                    } else {
                        _requestData(props.organization_id); // Refresh the list
                    }
                })
                .catch((e) => {
                    console.error('An unexpected error occurred while adding lose:', e);
                });
        } else {
            console.error('Error: Lose name is required and organization_id must be set.');
        }
    }

    

    function _removeLose(e, loseId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item
        if (!loseId) {
            console.error('Error: loseId is required.');
            return;
        }

        supabase
            .from('organizations_lose')
            .delete()
            .eq('id', loseId)
            .then(({ error }) => {
                if (error) {
                    console.error('Error removing lose:', error);
                } else {
                    _requestData(props.organization_id); // Refresh the list
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while removing lose:', e);
            });
    }
    async function _removeCluster(e, losId, clusterId) {
        e.stopPropagation(); // Prevent the click from propagating to the list item
        if (!losId || !clusterId) {
            console.error('Error: losId and clusterId are required.');
            return;
        }

        // Fetch the current los details
        const { data: losDetails, error: fetchError } = await supabase
            .from('organizations_lose')
            .select('*')
            .eq('id', losId)
            .single();

        if (fetchError) {
            console.error('Error fetching los details:', fetchError);
            return;
        }

        // Remove the clusterId from the losDetails.cluster_ids array
        const updatedClusterIds = losDetails.cluster_ids.filter(id => id !== clusterId);

        // Update the los with the new cluster_ids
        const { data, error } = await supabase
            .from('organizations_lose')
            .update({ cluster_ids: updatedClusterIds })
            .eq('id', losId)
            .select()
            .single();

        if (error) {
            console.error('Error removing cluster from los:', error);
        } else {
            _requestData(props.organization_id); // Refresh the list
            snackbarText.value = 'Cluster removed successfully.';
            snackbar.value = true;
            snackbarColor.value = 'success';
        }
    }
    function _openResponsibleDialog(los) {
        selectedLos.value = { ...los }; // Create a shallow copy of los to avoid mutating the original object
        responsibleDialog.value = true;
    }

    

    async function _addClusterToLosDialog(losDetails){
        const clusterName = prompt('Enter cluster name:');

        const clusterNameArray = clusterName ? clusterName.split(',') : [];
        if (!clusterNameArray || clusterNameArray.length === 0) {
            return;
        }

        // to strings

        // Trim whitespace from each cluster name
        const trimmedClusterNames = clusterNameArray.map(name => name.trim()).filter(name => name !== '');
        if (trimmedClusterNames.length === 0) {
            snackbarText.value = 'No valid cluster names provided.';
            snackbar.value = true;
            snackbarColor.value = 'error';
            return;
        }

        // all names must be unique
        //const uniqueClusterNames = [...new Set(trimmedClusterNames)];

        // convert all uniqueClusterNames to integer or remove if not a number
        /*const uniqueClusterNamesInteger = uniqueClusterNames.map(name => {
            const num = parseInt(name, 10);
            return isNaN(num) ? null : num;
        }).filter(name => name !== null);*/

        // name to integer


        // filter cluster names that are not in availableClusters
        //const clusterNames = uniqueClusterNames.filter(name => {
        //    return availableClusters.value.some(c => c.cluster_name === name);
        //});
//
        //
        //const clusterIds = availableClusters.value
        //    .filter(c => clusterNames.includes(c.cluster_name))
        //    .map(c => c.id);
//
        //if (clusterIds.length === 0) {
        //    snackbarText.value = 'No valid cluster names provided.';
        //    snackbar.value = true;
        //    snackbarColor.value = 'error';
        //    return;
        //}

        await _addClusterToLose(losDetails, trimmedClusterNames);
    }
    async function _filterClustersAvailableFromDb(cluster_ids){
        if (!cluster_ids || cluster_ids.length === 0) return [];

        try {
            const { data, error } = await supabase
                .from('records')
                .select('id:cluster_id, cluster_name')
                .in('cluster_name', cluster_ids);

            if (error) {
                console.error('Error fetching available clusters:', error);
                return [];
            }
            
            // Filter out any cluster IDs that are not in availableClusters
            const validClusters = data.filter(cluster => cluster_ids.includes(cluster.cluster_name));
            return validClusters.map(cluster => cluster.id);
        } catch (e) {
            console.error('An unexpected error occurred while fetching available clusters:', e);
            return [];
        }
    }
    async function _addClusterToLose(losDetails, clusterIds) {
        if (!losDetails || !clusterIds) return;

        //await _requestData(props.organization_id);
        
        // Remove duplicates
        const uniqueClusterIds = [...new Set(clusterIds)];

        // Filter out any cluster IDs that are not in availableClusters
        const validClusterIds = await _filterClustersAvailableFromDb(uniqueClusterIds);

        // Remove duplicates again after filtering
        const finalClusterIds = [...new Set(validClusterIds)];

        if (finalClusterIds.length === 0) {
            snackbarText.value = 'No valid cluster names provided.';
            snackbar.value = true;
            snackbarColor.value = 'error';
            return;
        }

        const currentClusterIds = losDetails.cluster_ids || [];
        currentClusterIds.push(...finalClusterIds);

        const { data, error } = await supabase
            .from('organizations_lose')
            .update({ cluster_ids: currentClusterIds })
            .eq('id', losDetails.id)
            .select()
            .single();

        if (error) {
            console.error('Error adding cluster to lose:', error);
        } else {
            losDetails.value = data;
            _updateAssignedClusters([losDetails.value]);
        }
    }


    // root organization only
    async function getClustersAvailable() {
        if (!props.organization_id) {
            console.error('Error: organization_id is required to fetch available clusters.');
            return;
        }

        try {

            const {data, error} = await supabase
                    .from('records')
                    .select('id:cluster_id, cluster_name');

            if (error) {
                console.error('Error fetching available clusters:', error);
            } else {
                availableClusters.value = data;
                console.log(availableClusters.value);
            }
        } catch (e) {
            console.error('An unexpected error occurred while fetching available clusters:', e);
        }
    }

    watch(() => props.organization_id, (newVal) => {
        if (newVal) {
            _requestData(newVal);
            //getClustersAvailable();
            _getCompanies();
            _getTroops();
        }
    });

    onMounted(() => {
        if (!props.organization_id) {
            console.error('Error: organization_id is required in attributes.');
            return;
        }
        _requestData(props.organization_id);
        //getClustersAvailable();
        _getCompanies();
        _getTroops();
    });

    async function _handleConfirm (value) {
        // Handle the confirm action
        console.log('Confirmed:', value);
        console.log('Updated Los:', selectedLos.value);
        const { data, error } = await supabase
            .from('organizations_lose')
            .update({ responsible_organization_id: value.responsible_organization_id, troop_id: value.troop_id })
            .eq('id', value.id)
            .select()
            .single();

        if (error) {
            snackbarText.value = 'Error updating responsible users: ' + error.message;
            snackbarColor.value = 'error';
            snackbar.value = true;
        } else {
            responsibleDialog.value = false; // Close the dialog
            snackbarText.value = 'Responsible users updated successfully.';
            snackbarColor.value = 'success';
            snackbar.value = true;
            _requestData(props.organization_id); // Refresh the list
        }
    };
    function _handleClose () {
        // Handle the close action
        responsibleDialog.value = false;
        selectedLos.value = null; // Reset selectedLos when dialog is closed
    };
</script>

<template>
    <v-toolbar class="mb-4">
        <!-- Add icon for adding users to troops -->
        <v-btn icon="mdi-view-grid" variant="text"></v-btn>
        <v-toolbar-title>{{ props.title }}</v-toolbar-title>
        <!-- Only if Admin -->
        <v-btn v-if="props.is_admin" rounded="xl" variant="tonal" @click="_addLose">
            <v-icon>mdi-plus</v-icon>hinzufügen
        </v-btn>
    </v-toolbar>
    <v-card v-for="los in lose" :key="los.id" class="mb-4">
        
        <v-card-item>
            <template v-slot:append>
                <v-btn
                    v-if="props.is_admin"
                    color="grey-lighten-1"
                    icon="mdi-account"
                    variant="text"
                    @click="(e) => _openResponsibleDialog(los)"
                ></v-btn>
                <v-btn
                    v-if="props.is_admin"
                    color="grey-lighten-1"
                    icon="mdi-delete"
                    variant="text"
                    @click="(e) => _removeLose(e, los.id)"
                ></v-btn>
            </template>

            <v-card-title>{{ los.name }}</v-card-title>

            <v-card-subtitle v-if="los.responsible_organization_id">Verantwortliche Dienstleister: {{ companies.find(company => company.id === los.responsible_organization_id)?.name || 'Unknown Company' }}</v-card-subtitle>
            <v-card-subtitle v-else-if="los.troop_id">Verantwortliche Trupp: {{ troops.find(troop => troop.id === los.troop_id)?.name || 'Unknown Troop' }}</v-card-subtitle>
            <v-card-subtitle v-else>Keine Verantwortlichen zugewiesen</v-card-subtitle>

        </v-card-item>
        <v-card-text>
            <v-list>
                <v-list-item v-for="clusterId in los.cluster_ids" :key="clusterId">
                    ClusterName: {{ clustersAssigned.find(cluster => cluster.id === clusterId)?.cluster_name || 'Unknown Cluster' }}
                    <template v-slot:append>
                
                    <v-btn
                        v-if="props.is_admin"
                        color="grey-lighten-1"
                        icon="mdi-delete"
                        variant="text"
                        @click="(e) => _removeCluster(e, los.id, clusterId)"
                    ></v-btn>
            </template>
                </v-list-item>
                <v-list-item v-if="los.cluster_ids && los.cluster_ids.length === 0">
                    <div class="text-center">
                        <v-icon class="mb-2">mdi-information</v-icon>
                        <p>No clusters assigned to this Los</p>
                    </div>
                </v-list-item>
            </v-list>
        </v-card-text>
        <template v-slot:actions>
            <v-btn
                v-if="props.is_admin"
                variant="outlined"
                class="mx-auto"
                @click="_addClusterToLosDialog(los)"
            >
                <v-icon>mdi-plus</v-icon>
                Cluster Hinzufügen
               
            </v-btn>
        </template>
    </v-card>

    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
    <DialogResponsible v-model="responsibleDialog" :selected="selectedLos" @close="_handleClose" @confirm="(value) => _handleConfirm(value)"/>
</template>
