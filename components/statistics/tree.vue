<script setup>
    import { onMounted, ref, getCurrentInstance } from 'vue'
    //import SpeciesCount from './charts/SpeciesCount.vue';
    import TreesByIntervalAndSpecies from './charts/TreesByIntervalAndSpecies.vue';
    const supabase = getCurrentInstance().appContext.config.globalProperties.$supabase;

    const tab = ref(null)
    const loading = ref(false)

    const props = defineProps({
        federal_state: {
            required: true
        }
    })

    const trees = ref([])
    const plotsByInterval = ref({})
    const treesByIntervalBySpecies = ref({});
    const treesBySpecies = ref({})
    const lookupTreeSpecies = ref({})

    function groupBy(array, key) {
        return array.reduce((result, currentValue) => {
            (result[currentValue[key]] = result[currentValue[key]] || []).push(
                currentValue
            );
            return result;
        }, {});
    }

    async function getDataBatch(batchSize = 1000, offset = 0) {
        const { data, error } = await supabase
            .schema('inventory_archive')
            .from('plot')
            .select('id, interval_name, tree(id, tree_species, dbh, tree_height)')
            .eq('federal_state', props.federal_state)
            .range(offset, offset + batchSize - 1);
        if (error) {
            console.error('Error fetching data:', error);
            return [];
        }
        return data;
    }

    async function getAllData(limit = null){
        let batchSize = 100000; // Reduced batch size for more reliable fetching
        let offset = 0;
        let allData = [];
        let totalFetched = 0;
        
        console.log('Starting data fetch...');
        
        while (true) {
            console.log(`Fetching batch: offset=${offset}, batchSize=${batchSize}`);
            const batch = await getDataBatch(batchSize, offset);
            
            if (batch.length === 0) {
                console.log('No more data to fetch');
                break;
            }
            
            allData = allData.concat(batch);
            totalFetched += batch.length;
            offset += batchSize;
            
            console.log(`Fetched ${batch.length} plots, total: ${totalFetched}`);
            
            // If we got less than the batch size, we've reached the end
            if (batch.length < batchSize) {
                console.log('Reached end of data (batch smaller than expected)');
                break;
            }
            
            // Apply limit if specified
            if (limit && totalFetched >= limit) {
                console.log(`Reached limit of ${limit} plots`);
                allData = allData.slice(0, limit);
                break;
            }
        }
        
        console.log(`Total plots fetched: ${allData.length}`);
        
        // Process the data for different chart types
        plotsByInterval.value = groupBy(allData, 'interval_name');

        // Create trees by interval by species structure
        treesByIntervalBySpecies.value = {};
        let totalTreeCount = 0;
        
        Object.entries(plotsByInterval.value).forEach(([interval, plots]) => {
            const trees = plots.flatMap(plot => plot.tree || []);
            const treesBySpecies = groupBy(trees, 'tree_species');
            treesByIntervalBySpecies.value[interval] = treesBySpecies;
            totalTreeCount += trees.length;
        });

        // Flatten all trees for overall statistics
        trees.value = Object.values(plotsByInterval.value)
            .flatMap(plots => plots.flatMap(plot => plot.tree || []));
        
        // Group all trees by species
        treesBySpecies.value = groupBy(trees.value, 'tree_species');

        console.log(`Total trees processed: ${trees.value.length}`);
        console.log(`Tree count verification: ${totalTreeCount}`);
        console.log('Intervals found:', Object.keys(plotsByInterval.value));
        console.log('Species found:', Object.keys(treesBySpecies.value).length);
    }

    // Fetch tree species lookup (if needed)
    async function getTreeSpeciesLookup() {
        const { data, error } = await supabase
            .schema('lookup')
            .from('lookup_tree_species')
            .select('*');
        if (error) {
            console.error('Error fetching tree species lookup:', error);
            return;
        }
        lookupTreeSpecies.value = data.reduce((acc, item) => {
            acc[item.code] = item.name_de;
            return acc;
        }, {});
    }

    onMounted(async () => {
        loading.value = true
        await getTreeSpeciesLookup();
        await getAllData();
        loading.value = false
    })
</script>

<template>
    <div>
        <div v-if="loading">Loading data...</div>
        <div v-else>
            <v-card class="my-4">
                <v-card-title>Total number of trees</v-card-title>
                <v-card-text class="text-center text-h1">
                    {{ trees.length }}
                </v-card-text>
            </v-card>
            <v-card class="my-4">
                <v-card-title>Number of species</v-card-title>
                <v-card-text class="text-center text-h1">
                     {{ Object.keys(treesBySpecies).length }}
                </v-card-text>
            </v-card>
            
            
            <!-- Trees by Interval and Species Chart -->
            <v-card class="my-4">
                <v-card-text>
                    <TreesByIntervalAndSpecies :treesByIntervalBySpecies="treesByIntervalBySpecies" :treeSpecies="lookupTreeSpecies"/>
                </v-card-text>
            </v-card>
        </div>
    </div>
</template>