import { ref, onMounted } from 'vue';

<script setup>
    const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
    import { ref, onMounted } from 'vue'

    const url = 'https://ci.thuenen.de/rest/v1/';
    const schema = ref(null);

    async function _requestRestSchema() {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Content-Profile': 'inventory_archive',
                'apikey': apikey,
                //'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE,
                'Prefer': 'resolution=merge-duplicates'
            }
        });
        const data = await response.json()
        return data
    }

    onMounted(async () => {
        const data = await _requestRestSchema();
        schema.value = data;
        console.log('mounted', schema.value);
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