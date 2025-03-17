<script setup>
    import { ref, onMounted, getCurrentInstance } from 'vue'
    import { createClient } from '@supabase/supabase-js'

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const countTables = ref([
        {
            name: 'plot',
            count: 0,
            loading: false
        },
        {
            name: 'cluster',
            count: 0,
            loading: false
        },
        {
            name: 'tree',
            count: 0,
            loading: false
        }
    ]);

    const count = async (table, plotIdArray) => {

        // https://ci.thuenen.de/rest/v1/cluster?select=plot%28*%29&state_responsible=eq.5
        //const { count, error } = await supabase.schema('inventory_archive').from(table.name).select('*', { count: 'exact', head: true }).eq('state_responsible', 5);
        let count = 0, error = null;
        
        
        if(table.name === 'plot'){
            //const { data:plotsData, error: plotsError, count: plotsCount } = await supabase.schema('inventory_archive').from('plot').select('*').in('cluster_id', plotIdArray);
            //const { data:plotsData, error: plotsError, count: plotsCount } = await supabase.schema('inventory_archive').from('cluster').select('plot!fk_plot_cluster(id)').eq('state_responsible', 5);//.in('cluster_id', plotIdArray);
            count = plotIdArray.length * 4;
        }else if(table.name === 'tree'){
            // *,plot(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*)
            const { data:treesData, error: treesError } = await supabase.schema('inventory_archive').from('cluster').select('plot!fk_plot_cluster(id, tree(*, plot_id))').eq('state_responsible', 5);//.in('cluster_id', plotIdArray);
            for (const cluster of treesData) {
                for (const plot of cluster.plot) {
                    count += plot.tree.length;
                }
            }
            console.log(treesData);
        }else if(table.name === 'cluster'){
            count = plotIdArray.length;
        }

        if (error) {
            console.error(error, count);
        }

        table.count = count;
    }

    onMounted(async () => {
        let { data, error } = await supabase.schema('inventory_archive').from('cluster').select('id').eq('state_responsible', 5);
        const plotIdArray = data.map(plot => plot.id);
        countTables.value.forEach(table => {
            count(table, plotIdArray);
        });
    });

    const testDownload = async () => {
        console.log('testDownload');
        const { data, error } = await supabase.schema('inventory_archive').from('cluster').select('plot(*)').eq('state_responsible', 5);
        console.log(data);
    }

    const downloadTable = async (table) => {
        table.loading = true;
        //const { data, error } = await supabase.schema('inventory_archive').from('cluster').select('plot!fk_plot_cluster(id)').eq('state_responsible', 5);
        const { data, error } = await supabase.schema('inventory_archive').from(table.name).select('*').csv();
        table.loading = false;
        if (error) {
            console.error(error);
        }else{
            let csvContent = "data:text/csv;charset=utf-8," + data;
            var encodedUri = encodeURI(csvContent);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", table.name + ".csv");
            document.body.appendChild(link); // Required for FF
            link.click();
        }
        
    }


</script>

<template>
    <div style="margin-top:20px;">
        <div class="card square" v-for="table in countTables">
            <div class="table-name">{{table.name.toUpperCase()}}</div>
            <p>≈ {{table.count}} Rows</p>
            <div v-if="table.loading">Loading...</div>
            <a v-else href="#" @click="downloadTable(table)">Download</a>
        </div>
    </div>
</template>

<style scoped>
    .table-name {
        font-size: 30px;
        font-weight: bold;
    }
    .card {
        border-radius: 5px;
        padding: 30px;
        margin: 10px;
        display: inline-block;
        text-align: center;
        background-color: rgba(150, 150, 150, .2);
    }
    .square {
        aspect-ratio: 1/1;
        height: 200px;
    }
</style>