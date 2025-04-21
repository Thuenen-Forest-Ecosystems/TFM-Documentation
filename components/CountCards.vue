<script setup>
    import { ref, onMounted, getCurrentInstance } from 'vue'
    import { createClient } from '@supabase/supabase-js'

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const plainPlotIdsArray = ref(null);
    const plainClusterIdsArray = ref(null);
    const access_token = ref('');
    const jwtPayload = ref({});
    const is_admin = ref(false);
    const state_responsible = ref(null);
    const troop_id = ref(null);
    const state_responsible_name = ref(null);


    /**
     * 
     * Use either the wellknown or terraformer-wkt-parser library (or potentially others with WKT parsing capabilities) to correctly convert PostGIS geometry strings to GeoJSON in your JavaScript code.
     */

    const countTables = ref([
        {
            name: 'cluster',
            key: 'id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'plot',
            key: 'id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'plot_coordinates',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'tree',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'deadwood',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'position',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'regeneration',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'edges',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'plot_landmark',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'structure_gt4m',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        },
        {
            name: 'structure_lt4m',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null
        }
    ]);

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    };

    onMounted(async () => {
        const { data, error } = await supabase.auth.getSession()
        const user = data.session.user;
        const { data: userProfile, error: userProfileError } = await supabase.from('users_profile').select().eq('id', user.id).single();
        if (userProfileError) {
            console.error(userProfileError);
        } else {
            state_responsible.value = userProfile.state_responsible;
            troop_id.value = userProfile.troop_id;
            is_admin.value = userProfile.is_admin;
        }
        return;

        if (data) {
            access_token.value = data.session.access_token;
            jwtPayload.value = parseJwt(data.session.access_token);
            is_admin.value = jwtPayload.value.is_admin;
            state_responsible.value = jwtPayload.value.state_responsible;
            troop_id.value = jwtPayload.value.troop_id;
            _getStateResponsibleName(state_responsible.value);
        }
    });

    async function _getStateResponsibleName(stateCode){
        await supabase.schema('lookup').from('lookup_state').select('name_de, name_en').eq('code', stateCode).single().then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            state_responsible_name.value = data.name_de;
        });
    }

    const downloadTable = async (table) => {

        if(table.loading === true) return;
        table.loading = true;

        const fileName = table.name + '_' + new Date().toISOString() + '.csv';

        if(table.data){
            saveAsFile(table.data, fileName);
            table.loading = false;
            return;
        }

        if(!plainPlotIdsArray.value){
            let { data, error } = await supabase.schema('inventory_archive').from('plot').select('id').eq('federal_state', state_responsible.value);
            plainPlotIdsArray.value = data.map(plot => plot.id);
        }
        if(!plainClusterIdsArray.value){
            let result = await supabase.schema('inventory_archive').from('cluster').select('id').eq('state_responsible', state_responsible.value);
            plainClusterIdsArray.value = result.data.map(cluster => cluster.id);
        }
        if(plainPlotIdsArray.value.length === 0){
            alert('No plots found');
            table.loading = false;
            return;
        }
        table.data = await requestTreeByPlotIds(table, plainPlotIdsArray.value, plainClusterIdsArray.value);
       
        if (table.data) {
            saveAsFile(table.data, fileName);
        }else{
            console.error('Error downloading table', table.name);
        }
        table.loading = false;
    }
    const requestTreeByPlotIds = async (table, plotIdArray = [], clusterIdArray = []) => {
        let totalResponseCsv = '';
        // split in chunks of 100
        const chunkSize = 100;
        const chunks = [];
        if(table.name === 'cluster'){
            for (let i = 0; i < clusterIdArray.length; i += chunkSize) {
                chunks.push(clusterIdArray.slice(i, i + chunkSize));
            }
        }else{
            for (let i = 0; i < plotIdArray.length; i += chunkSize) {
                chunks.push(plotIdArray.slice(i, i + chunkSize));
            }
        }
        
        // request trees for each chunk
        table.totalChunks = chunks.length;
        table.chunkLoaded = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const {data: treesData, error: treesError} = await supabase.schema('inventory_archive').from(table.name).select('*').in(table.key || 'plot_id', chunk).csv();

            if (treesError) {
                console.error(treesError);
            }else{
                
                // check if empty
                const linesRaw = treesData.split('\n');
                // remove empty lines
                const lines = linesRaw.filter(line => line.trim() !== '');
                if(lines.length === 0){
                    continue;
                }

                table.currentRowsCount += lines.length - 1;

                if(totalResponseCsv !== ''){
                    // remove first line from treesData and add it to totalResponseCsv
                    
                    const data = lines.slice(1).join('\n');
                    
                    totalResponseCsv += '\n' + data;
                }else{
                    console.log(lines);
                    totalResponseCsv = treesData;
                }
            }
            table.chunkLoaded = i + 1;
        }
        return totalResponseCsv;
    }


    const saveAsFile = (data, filename) => {
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
    }

</script>

<template>
    <div v-if="state_responsible" style="margin-top:20px;">
        <v-list-item
            v-for="table in countTables"
            :key="table.name"
            :subtitle="table.totalChunks == 0 ? '' : (table.chunkLoaded * 100 / table.totalChunks).toFixed(2) + ' %'"
            :title="table.name"
        >
            <template v-slot:prepend>
                <v-icon color="white">mdi-format-list-bulleted</v-icon>
            </template>

            <template v-slot:append>
            <v-btn
                prepend-icon="mdi-download"
                color="grey-lighten-1"
                :disabled="table.loading"
                rounded="xl"
                @click="downloadTable(table)"
            >csv</v-btn>
            </template>
        </v-list-item>
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