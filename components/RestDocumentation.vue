<script setup>    
    import { ref, onMounted, getCurrentInstance } from 'vue'
    import { useAttrs } from 'vue';
    import { createClient } from '@supabase/supabase-js'

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;
   
    const supabase = createClient(url, apikey)


    const contentProfile = useAttrs('content-profile');
    
    const schema = ref(null);

   

    async function _requestRestSchema(token) {
       
        let data = null, error = null;
        try{
            const headers = {
                'Content-Type': 'application/json',
                'Accept-Profile': contentProfile.contentProfile,
                'apikey': apikey,
            };
            if(token){
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(`${url}/rest/v1/`, {
                method: 'GET',
                headers
            });
            
            if(response.status !== 200){
                error = await response.json();
            }else{
                data = await response.json();
            }
        } catch (error) {
            error = error;
        }
        return {data, error};
    }

    onMounted(async () => {
        const {data, error} = await _requestRestSchema( );
        if(data){
            schema.value = data;
        }else{
            console.error(error);
        }
    })

    const filterProperties = (properties) => {
        return Object.entries(properties).filter(([key, value]) => key !== 'intkey');
    }

    const filterTables = (tables) => {
        return Object.entries(tables).filter(([key, value]) => key !== 'table_template');
    }
    
</script>

<template>
    <div v-if="schema">
        <div v-for="(definition in filterTables(schema.definitions)">
            <h2 style="text-transform: capitalize;">{{ definition[0] }}</h2>
            <p>{{ definition[1].description || '' }}</p>
            <h3>Required</h3>
            <p>
                <span v-for="required in definition[1].required ">
                    <Badge type="warning" >
                        {{required}}  
                    </Badge>
                </span>
            </p>
            <h3>Properties</h3>
            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Type</th>
                        <th>Format</th>
                        <th>Description</th>
                        <th>Default</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(property in filterProperties(definition[1].properties)">
                        <td><b>{{ property[0] }}</b></td>
                        <td>{{ property[1].type }}</td>
                        <td>{{ property[1].format || '' }}</td>
                        <td>{{ property[1].description }}</td>
                        <td>{{ property[1].default }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>