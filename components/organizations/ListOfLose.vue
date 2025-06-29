<script setup>
    import { getCurrentInstance, onMounted, useAttrs, ref, watch } from 'vue';
    import { useRouter } from 'vitepress'
    import DialogResponsible from './DialogResponsible.vue';
    import DialogTextfield from './DialogTextfield.vue';
import DialogAddPlotsToLos from './DialogAddPlotsToLos.vue';


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
    const addPlotDialog = ref(false);
    const nameDialog = ref(false);
    const existingLose = ref([]);
    const addLosLoading = ref(false);

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
        },
        is_root: {
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

        clustersAssigned.value = [];
        if (assignedClusterIds.length === 0) {
            console.log('No clusters assigned to any los.');
            return;
        }
        // Fetch clusters from available based on assignedClusterIds
        clustersAssigned.value = availableClusters.value.filter(cluster => assignedClusterIds.includes(cluster.id));

        // get data from records table
        /*const {data, error} = await supabase.from('records').select('id:cluster_id, cluster_name').in('cluster_id', assignedClusterIds);
        
        if (error) {
            console.error('Error fetching clusters:', error);
            return;
        }
        console.log('clustersAssigned', data);
        clustersAssigned.value = data;
        return;*/

        //const clusterIds = clusterData.map(item => item.cluster_id);
        //clustersAssigned.value.push(...clusterIds);
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
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching lose:', error);
                } else {
                    lose.value = data || [];
                    _updateAssignedClusters(lose.value);
                    existingLose.value = lose.value.map(l => l.name.toLowerCase());
                }
            })
            .catch((e) => {
                console.error('An unexpected error occurred while fetching lose:', e);
            });
    }

    function _addLose(loseName) {

        if (loseName && props.organization_id) {
            addLosLoading.value = true;
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
                    addLosLoading.value = false;
                    nameDialog.value = false; // Close the dialog
                })
                .catch((e) => {
                    console.error('An unexpected error occurred while adding lose:', e);
                    addLosLoading.value = false;
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
        if (!losDetails || !losDetails.id) {
            console.error('Error: losDetails and losDetails.id are required.');
            return;
        }

        console.log('Adding clusters to los:', losDetails);
        // Open the dialog to add clusters
        selectedLos.value = losDetails;
        addPlotDialog.value = true;
        

        // Reset the input field in the dialog
        const clusterNameInput = document.querySelector('#clusterNameInput');
        if (clusterNameInput) {
            clusterNameInput.value = '';
        }
    }
    async function _addClusterToLosDialog_deprecated(losDetails){
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

        /// filter already clustersAssigned
        const filteredClusterNames = trimmedClusterNames.filter(name => {
            return !clustersAssigned.value.some(cluster => cluster.cluster_name === name);
        });
        if (filteredClusterNames.length === 0) {
            snackbarText.value = 'All provided cluster names are already assigned.';
            snackbar.value = true;
            snackbarColor.value = 'warning';
            return;
        }
        

        await _addClusterToLose(losDetails, filteredClusterNames);
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
    async function _addClusterToLoseFromDialog(losDetails, uniqueClusterIds){

        const { data, error } = await supabase
            .from('organizations_lose')
            .update({ cluster_ids: uniqueClusterIds })
            .eq('id', losDetails.id)
            .select()
            .single();

        if (error) {
            console.error('Error adding cluster to lose:', error);
        } else {
            _requestData(props.organization_id);
            losDetails.value = data;
            _updateAssignedClusters([losDetails.value]);
        }
    }
    async function _addClusterToLose(losDetails, clusterNames) {
        if (!losDetails || !clusterNames) return;

        //await _requestData(props.organization_id);

       
        
        // Remove duplicates
        let uniqueClusterNames = [...new Set(clusterNames)];

        // Filter out any cluster IDs that are not in availableClusters
        //const finalClusterIds = await _filterClustersAvailableFromDb(uniqueClusterIds);

        // Filter out any cluster IDs that are not in availableClusters
        const finalClusterNames = uniqueClusterNames.filter(name => {
            return availableClusters.value.some(cluster => cluster.cluster_name === name);
        });

        // array of ids from cluster_name
        const clusterIds = finalClusterNames.map(name => {
            const cluster = availableClusters.value.find(cluster => cluster.cluster_name === name);
            return cluster ? cluster.id : null;
        }).filter(id => id !== null);

        if (clusterIds.length === 0) {
            snackbarText.value = 'No valid cluster names provided.';
            snackbar.value = true;
            snackbarColor.value = 'error';
            return;
        }

        const currentClusterIds = losDetails.cluster_ids || [];
        currentClusterIds.push(...clusterIds);

        // Remove duplicates
        const uniqueClusterIds = [...new Set(currentClusterIds)];
        console.log('Adding clusters to lose:', uniqueClusterIds);

        const { data, error } = await supabase
            .from('organizations_lose')
            .update({ cluster_ids: uniqueClusterIds })
            .eq('id', losDetails.id)
            .select()
            .single();

        if (error) {
            console.error('Error adding cluster to lose:', error);
        } else {
            console.log('Data',data);
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
            let data, error;
            if(props.is_root) {
                // Fetch all clusters if the user is a root organization
                ({data, error} = await supabase.from('records').select('id:cluster_id, cluster_name').order('cluster_name', { ascending: false }).limit(4000));
            } else {
                // Fetch only clusters that are not assigned to any lose
                ({data, error} = await supabase.from('records').select('id:cluster_id, cluster_name').order('cluster_name', { ascending: false }));
            }

            if (error) {
                console.error('Error fetching available clusters:', error);
            } else {
                availableClusters.value = data || [];
                _updateAssignedClusters(lose.value);
            }
        } catch (e) {
            console.error('An unexpected error occurred while fetching available clusters:', e);
        }
    }

    watch(() => props.organization_id, (newVal) => {
        if (newVal) {
            _requestData(newVal);
            getClustersAvailable();
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
        getClustersAvailable();
        _getCompanies();
        _getTroops();
    });

    async function _handleConfirm (value) {
        // Handle the confirm action
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
    <v-toolbar  class="mb-4" color="transparent" style="border-bottom: 1px solid rgba(120, 120, 120, 0.12);">
        <!-- Add icon for adding users to troops -->
        <v-btn icon="mdi-view-grid" variant="text"></v-btn>
        <v-toolbar-title>{{ props.title }}</v-toolbar-title>
        <!-- Only if Admin -->
        <v-btn v-if="props.is_admin" rounded="xl" variant="tonal" @click="nameDialog = true">
            NEu <v-icon>mdi-view-grid-plus</v-icon>
        </v-btn>
    </v-toolbar>
    
    <div class="text-center mb-4" v-if="!lose.length">
        <v-alert type="warning" variant="tonal">
            Es wurden noch keine Lose hinzugefügt.<br/>Klicke auf "Neu", um ein neues Los hinzuzufügen.
        </v-alert>
    </div>

    <v-card v-for="los in lose" :key="los.id" class="mb-4" variant="tonal">
        
        <v-card-item style="background-color: rgba(0, 0, 0, 0.1);">
            <template v-slot:prepend>
                <v-icon>mdi-rectangle</v-icon>
            </template>
            <template v-slot:append>
                <v-btn
                    v-if="props.is_admin"
                    icon="mdi-pencil"
                    variant="text"
                    @click="(e) => _openResponsibleDialog(los)"
                ></v-btn>
                <v-btn
                    v-if="props.is_admin"
                    icon="mdi-delete"
                    variant="plain"
                    @click="(e) => _removeLose(e, los.id)"
                ></v-btn>
            </template>

            <v-card-title class="py-2">
                {{ los.name }}
                <v-chip variant="elevated" v-if="los.responsible_organization_id">{{ companies.find(company => company.id === los.responsible_organization_id)?.name || 'Unknown Company' }}</v-chip>
                <v-chip variant="elevated" v-else-if="los.troop_id">{{ troops.find(troop => troop.id === los.troop_id)?.name || 'Unknown Troop' }}</v-chip>
                <v-chip variant="elevated" color="yellow" v-else>noch nicht zugewiesen</v-chip>
            </v-card-title>
            

        </v-card-item>
        <v-card-text>
            <v-list v-if="los.cluster_ids && los.cluster_ids.length > 0" class="pa-0">
                <v-list-item v-for="clusterId in los.cluster_ids" :key="clusterId">
                    ClusterName: {{ availableClusters?.find(cluster => cluster.id === clusterId)?.cluster_name || 'Unknown Cluster' }}
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
            </v-list>
            <div class="text-center ma-2 text-body-2 text-medium-emphasis" v-if="los.cluster_ids && los.cluster_ids.length === 0">
                Es wurde noch kein Trakt hinzugefügt.
            </div>
        </v-card-text>
        <template v-slot:actions>
            <v-spacer></v-spacer>
            <v-btn
                v-if="props.is_admin"
                variant="tonal"
                class="mx-auto"
                @click="_addClusterToLosDialog(los)"
                rounded="xl"
            >
                Trakt Hinzufügen
                <v-icon>mdi-plus</v-icon>
                
            </v-btn>
        </template>
    </v-card>

    
    <DialogTextfield
        v-model="nameDialog"
        :value="''"
        :title="'Los hinzufügen'"
        :text="'Bitte gib den Namen des Los ein, das du hinzufügen möchtest.'"
        :btnText="'Los Hinzufügen'"
        :icon="'mdi-view-grid-plus'"
        :loading="addLosLoading"
        :disabled="existingLose"
        :placeholder="'z.b. Los Sachsen, Rhein-Sieg-Kreis, Los Angeles'"
        @close="() => { nameDialog = false; }"
        @confirm="_addLose"
    />

    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
        {{ snackbarText }}
        <template v-slot:action="{ attrs }">
            <v-btn text v-bind="attrs" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>

    <DialogAddPlotsToLos
        v-model="addPlotDialog"
        :selectedLos="selectedLos"
        @confirm="_addClusterToLoseFromDialog"
    />
    <DialogResponsible
        v-model="responsibleDialog"
        :selected="selectedLos"
        @close="_handleClose"
        @confirm="(value) => _handleConfirm(value)"
    />
</template>
