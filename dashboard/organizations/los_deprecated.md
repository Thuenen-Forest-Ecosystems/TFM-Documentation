<script setup>
    import { onMounted, ref, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js'
    import { withBase } from 'vitepress'

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase

    const queryParams = ref({});
    const loseDetails = ref({});

    async function _addClusterToLoseDialog(){
        const clusterName = prompt('Enter cluster name:');

        const clusterNameArray = clusterName ? clusterName.split(',') : [];
        if (!clusterNameArray || clusterNameArray.length === 0) {
            return;
        }

        // Trim whitespace from each cluster name
        const trimmedClusterNames = clusterNameArray.map(name => name.trim()).filter(name => name !== '');
        if (trimmedClusterNames.length === 0) {
            snackbarText.value = 'No valid cluster names provided.';
            snackbar.value = true;
            snackbarColor.value = 'error';
            return;
        }

        // all names must be unique
        const uniqueClusterNames = [...new Set(trimmedClusterNames)];

        // convert all uniqueClusterNames to integer or remove if not a number
        const uniqueClusterNamesInteger = uniqueClusterNames.map(name => {
            const num = parseInt(name, 10);
            return isNaN(num) ? null : num;
        }).filter(name => name !== null);

        await _addClusterToLose(loseDetails.value.id, uniqueClusterNames);
    }
    async function _addClusterToLose(loseId, clusterIds) {
        if (!loseId || !clusterIds) return;

        await _requestDataById(loseId);

        const currentClusterIds = loseDetails.value.cluster_ids || [];
        currentClusterIds.push(...clusterIds);

        const { data, error } = await supabase
            .from('organizations_lose')
            .update({ cluster_ids: clusterIds })
            .eq('id', loseId)
            .select()
            .single();

        if (error) {
            console.error('Error adding cluster to lose:', error);
        } else {
            loseDetails.value = data;
        }
    }

    // Add a function to handle navigation back
    function goBack() {
        try {
            window.history.back();
        } catch (e) {
            // Fallback if history isn't available
            router.go(-1);
        }
    }

    async function _requestDataById(loseId) {
        if (!loseId) return;

        const { data, error } = await supabase
            .from('organizations_lose')
            .select('*')
            .eq('id', loseId)
            .single();

        if (error) {
            console.error('Error fetching lose details by ID:', error);
        } else {
            loseDetails.value = data;
        }
    }
    
    onMounted(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams.entries()) {
            queryParams.value[key] = value;
        }

        await _requestDataById(queryParams.value.losId);

    });
</script>


<v-toolbar color="transparent" flat v-if="loseDetails">
    <v-btn icon="mdi-arrow-left" @click="goBack()"></v-btn>
    <v-toolbar-title>
        <div class="d-flex flex-column">
            <span class="text-h6">{{loseDetails.name}}</span>
            <span class="text-caption text-grey">{{loseDetails.description}}</span>
        </div>
    </v-toolbar-title>
    <div class="d-flex ga-1">
        <!--<v-btn icon="mdi-pencil" @click="_editLos(loseDetails.value.id, loseDetails.value.name)"></v-btn>-->
        <v-btn icon="mdi-delete" @click="_deleteLos(loseDetails.value.id)"></v-btn>
    </div>
    <v-button
        class="ml-auto"
        color="primary"
        @click="_addClusterToLoseDialog()"
    >
       _addTroopToRecords
    </v-button>
</v-toolbar>



<p>
   Details: {{loseDetails}}
</p>