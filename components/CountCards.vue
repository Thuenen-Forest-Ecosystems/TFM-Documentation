<script setup>
    import { ref, onMounted, getCurrentInstance } from 'vue'
    import { parse } from 'wkt';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const plainPlotIdsArray = ref(null);
    const plainClusterIdsArray = ref(null);
    const access_token = ref('');
    const jwtPayload = ref({});
    const is_admin = ref(false);
    const state_responsible = ref(null);
    const states_responsible = ref([]);
    const troop_id = ref(null);
    const state_responsible_name = ref(null);

    const selections = [
        'bwi2012',
        'ci2017',
        'bwi2022'
    ];
    const selectedInterval = ref('bwi2022');


    /**
     * 
     * Use either the wellknown or terraformer-wkt-parser library (or potentially others with WKT parsing capabilities) to correctly convert PostGIS geometry strings to GeoJSON in your JavaScript code.
     */

    const countTables = ref([
        {
            title: 'Cluster',
            name: 'cluster',
            key: 'id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            title: 'Plots',
            name: 'plot',
            key: 'id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['geojson', 'json', 'csv']
        },
        {
            title: 'Trees',
            name: 'tree',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['geojson', 'json', 'csv']
        },
        {
            title: 'Totholz',
            name: 'deadwood',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            title: 'Position',
            name: 'position',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            name: 'regeneration',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            name: 'edges',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            name: 'plot_landmark',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            name: 'structure_gt4m',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        },
        {
            name: 'structure_lt4m',
            key: 'plot_id',
            count: 0,
            totalChunks: 0,
            chunkLoaded: 0,
            currentRowsCount: 0,
            loading: false,
            data: null,
            saveAs: ['json', 'csv']
        }
    ]);

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
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

            troop_id.value = userProfile.troop_id;
            is_admin.value = userProfile.is_admin;
            
            if(is_admin.value){
                _getAllStates();
            }else if(userProfile.state_responsible){
                state_responsible.value = userProfile.state_responsible;
                states_responsible.value.push(await _getStateResponsibleName(state_responsible.value));
            }
        }
    });

    async function _getAllStates(){
        const { data, error } = await supabase
            .schema('lookup')
            .from('lookup_state')
            
            .select()
            .neq('code', '0');
        if (error) {
            console.error(error);
        } else {
            states_responsible.value = data;
        }
    }
    async function _getStateResponsibleName(stateCode){
        if(!stateCode) return;

        const { data, error } = await supabase
            .schema('lookup')
            .from('lookup_state')
            .select()
            .eq('code', stateCode)
            .single();

        state_responsible_name.value = data.name_de;
        return data;
    }

    const downloadTable = async (table, type, country) => {

       

        if(country == null) return;
        if(country.code == null) return;

        if(country.loading == null) country.loading = {};
        if(country.data == null) country.data = {};

        if(country.loading[table.code] === true) return;
        //table.loading = true;
        country.loading[table.code] = true;

        const fileName = table.name + '_' + new Date().toISOString() + '_' + country.code  + '.' + type;

       

        if(country.data[table.name]){
            saveAsFile(table, fileName, country.data[table.name]);
            //table.loading = false;
            country.loading[table.code] = false;
            return;
        }

        if(!country.plainPlotIdsArray && table.name !== 'cluster'){
            let { data, error } = await supabase
                .schema('inventory_archive')
                .from('plot')
                .select('id')
                .eq('interval_name', selectedInterval.value)
                .eq('federal_state', country.code);
            country.plainPlotIdsArray = data.map(plot => plot.id);
        }
        if(!plainClusterIdsArray.value){
            console.log(country.code);
            let result = await supabase.schema('inventory_archive').from('cluster').select('id').eq('state_responsible', country.code);
            //country.plainPlotIdsArray = result.data.map(cluster => cluster.id);
            plainClusterIdsArray.value = result.data.map(cluster => cluster.id);
        }
        if(country.plainPlotIdsArray?.length === 0 && table.name !== 'cluster'){
            alert('No plots found');
            //table.loading = false;
            country.loading[table.code] = false;
            return;
        }
        table.data = await requestTreeByPlotIds(table, country.plainPlotIdsArray, plainClusterIdsArray.value, country);
        country.data[table.name] = table.data;

        
       
        if (table.data, country.data[table.name]) {
            saveAsFile(table, fileName, country.data[table.name]);
        }else{
            console.error('Error downloading table', table.name);
        }
        //table.loading = false;
        country.loading[table.code] = false;
    }

    const requestTreeByPlotIds = async (table, plotIdArray = [], clusterIdArray = [], country = {}) => {

        let allFetchedObjects = [];
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
            let treesData = null;
            let treesError = null;

            if(table.name === 'plot'){
                const { data, error } = await supabase
                    .schema('inventory_archive')
                    .from(table.name)
                    .select('*, plot_coordinates(*)')
                    .in(table.key || 'plot_id', chunk);
                if (error) {
                    treesError = error;
                } else {
                    treesData = data;
                }
            }else if(table.name === 'tree'){
                const { data, error } = await supabase
                    .schema('inventory_archive')
                    .from(table.name)
                    .select('*, tree_coordinates(*)')
                    .in(table.key || 'plot_id', chunk);
                if (error) {
                    treesError = error;
                } else {
                    treesData = data;
                }
            }else{
                const { data, error } = await supabase
                    .schema('inventory_archive')
                    .from(table.name)
                    .select('*')
                    .in(table.key || 'plot_id', chunk);

                if (error) {
                    treesError = error;
                } else {
                    treesData = data;
                }
            }

            if (treesError) {
                console.error(treesError);
            }else{
                if (treesData && treesData.length > 0) {
                    allFetchedObjects.push(...treesData);
                    table.currentRowsCount += treesData.length;
                }

                // if table.name == 'plot'

                /* check if empty
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
                }*/
            }
            table.chunkLoaded = i + 1;
        }
        return allFetchedObjects;
    }

    const convertJsonToCsv = (table) => {
        const jsonArray = table.data;
        if (!jsonArray || jsonArray.length === 0) {
            return '';
        }

        for (const row of jsonArray) {
            if(table.name === 'plot' && row.plot_coordinates && row.plot_coordinates.center_location && row.plot_coordinates.center_location.coordinates){
                row.latitude = row.plot_coordinates.center_location.coordinates[1];
                row.longitude = row.plot_coordinates.center_location.coordinates[0];
            }else if(table.name === 'tree' && row.tree_coordinates && row.tree_coordinates.center_location && row.tree_coordinates.center_location.coordinates){
                row.latitude = row.tree_coordinates.center_location.coordinates[1];
                row.longitude = row.tree_coordinates.center_location.coordinates[0];
            }
        }



        const headers = Object.keys(jsonArray[0]);
        const csvRows = [headers.join(',')]; // Header row

        for (const row of jsonArray) {

                const values = headers.map(header => {
                let cellValue = row[header];
                if (cellValue === null || cellValue === undefined) {
                    cellValue = '';
                } else if (typeof cellValue === 'object') {
                    cellValue = JSON.stringify(cellValue); // Handle nested objects/arrays
                }
                const escaped = ('' + cellValue).replace(/"/g, '""'); // Escape double quotes
                return `"${escaped}"`; // Quote all fields
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    };


    const saveAsFile = (table, filename, data) => {
        let dataToSave = '';
        let mimeType = 'text/plain;charset=utf-8;';

        const typeofdata = typeof data;
       
        
        if (Array.isArray(data) && data.length > 0 && typeofdata === 'object' && filename.endsWith('.csv')) {
            // If data is an array of objects and filename suggests CSV, convert to CSV
            dataToSave = convertJsonToCsv(table);
            mimeType = 'text/csv;charset=utf-8;';
        } else if (typeofdata === 'string') {
            // If data is already a string
            dataToSave =data;
            if (filename.endsWith('.csv')) {
                mimeType = 'text/csv;charset=utf-8;';
            } else if (filename.endsWith('.json')) {
                mimeType = 'application/json;charset=utf-8;';
            }
        } else if (typeofdata === 'object' && filename.endsWith('.json')) {
            // If data is an object and filename suggests JSON, stringify
            dataToSave = JSON.stringify(data, null, 2);
            mimeType = 'application/json;charset=utf-8;';
        } else if (filename.endsWith('.geojson')) {
            // If data is an object and filename suggests GeoJSON, convert to GeoJSON
            const geojson = {
                type: 'FeatureCollection',
                features:data.map((feature) =>{
                    const properties = { ...feature };
                    let coordinates = null;
                    if(table.name === 'plot'){
                        coordinates = feature.plot_coordinates.center_location.coordinates;
                        delete properties.plot_coordinates;
                    }else if(table.name === 'tree'){
                        coordinates = feature.tree_coordinates.tree_location.coordinates;
                        delete properties.tree_coordinates;
                    }
                    
                    return {
                        type: 'Feature',
                        properties,
                        geometry: {
                            type: 'Point',
                            coordinates
                        }
                    };
                })
            };
            dataToSave = JSON.stringify(geojson, null, 2);
            mimeType = 'application/geo+json;charset=utf-8;';
        }
        else {
            console.error('Unsupported data type for saveAsFile or filename extension mismatch.');
            alert('Could not prepare data for download.');
            return;
        }

        const blob = new Blob([dataToSave], { type: mimeType });
        const link = document.createElement('a');
        if (link.href) {
          URL.revokeObjectURL(link.href);
        }
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

</script>

<template>
    <v-btn-toggle
        v-model="selectedInterval"
        color="primary"
        rounded="0"
        group
    >
        <v-btn 
            v-for="selection in selections"
            :key="selection"
            :value="selection"
            @click="selectedInterval = selection">
            {{ selection }}
        </v-btn>
    </v-btn-toggle>
    <div v-for="country in states_responsible" :key="country.code">
        <h3>{{ country.name_de }}</h3>
        <div style="margin-top:20px;">
            <v-list-item
                v-for="table in countTables"
                :key="table.name"
                :subtitle="table.totalChunks == 0 ? '' : (table.chunkLoaded * 100 / table.totalChunks).toFixed(2) + ' %'"
                :title="table.title || table.name"
            >
                <template v-slot:prepend>
                    <v-icon color="white">mdi-format-list-bulleted</v-icon>
                </template>

                <template v-slot:append>
                    <div v-for="type in table.saveAs">
                        &nbsp;
                        <v-btn
                            :key="type"
                            :loading="table.loading"
                            prepend-icon="mdi-download"
                            color="grey-lighten-1"
                            :disabled="table.loading"
                            rounded="xl"
                            @click="downloadTable(table, type, country)"
                        >{{ type }}</v-btn>
                    </div>
                </template>
            </v-list-item>
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