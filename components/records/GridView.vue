<script setup>
    import { onMounted, ref } from 'vue';
    import GridViewTableTab from './GridViewTableTab.vue';
    import GridViewGridTab from './GridViewGridTab.vue';

    const tab = ref(null);

    const props = defineProps({
        data: {
            type: Object,
            required: true,
        },
        schema: {
            type: Object,
            required: true,
        },
    });

    const tabObjects = ref({
        "plot": {
            title: "Eckendaten",
            showAsTable: false
        }
    });

    function findInType(types, key) {
        if (Array.isArray(types)) {
            return types.some(type => findInType(type, key));
        }
        if (typeof types === 'object' && types !== null) {
            return key in types.properties;
        }
        if (types === key) {
            return true;
        }
        return false;
    }

    function getAllObjectsFromSchema(schema) {
        const objects = {};
        for (const key in schema.properties) {
            const property = schema.properties[key];
            if (findInType(property.type, 'array')) {
                objects[key] = property;
                objects[key].showAsTable = true;
            }
        }
        
        return objects;
    }
    function getNonObjectProperties(schema) {
        const nonObjects = {
            title: schema.title || 'Details',
            showAsTable: false
        };
        for (const key in schema.properties) {
            const property = schema.properties[key];
            if (!findInType(property.type, 'array')) {
                nonObjects[key] = property;
                nonObjects[key].showAsTable = false;
            }
        }
        return nonObjects;
    }

    onMounted(() => {
        // Get non-object properties
        tabObjects.value.plot = getNonObjectProperties(props.schema);
        tabObjects.value = {...tabObjects.value, ...getAllObjectsFromSchema(props.schema)};
        console.log('Tab objects:', tabObjects.value);
        // initialize tab to first key
        const firstKey = Object.keys(tabObjects.value)[0];
        tab.value = firstKey;
    });
</script>


<template>
    <div>
        <v-tabs v-model="tab">
            <v-tab v-for="(object, index) in tabObjects" :key="index" :text="object.title" :value="index"></v-tab>
        </v-tabs>
        <v-tabs-window v-model="tab">
            <!-- not index but key of object-->
            <v-tabs-window-item v-for="(object, key) in tabObjects" :key="key" :value="key">
                <GridViewTableTab v-if="object.showAsTable" :data="props.data[key]" :schema="object.items" />
                <GridViewGridTab v-else :data="props.data" :schema="props.schema" />
            </v-tabs-window-item>
        </v-tabs-window>
    </div>
</template>