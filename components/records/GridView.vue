<script setup>
    import { onMounted, ref } from 'vue';
    import GridViewTableTab from './GridViewTableTab.vue';

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
        "plot": {}
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
            }
        }
        return objects;
    }

    onMounted(() => {
        tabObjects.value = getAllObjectsFromSchema(props.schema);
        console.log('Tab objects:', tabObjects.value);
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
                <GridViewTableTab :data="props.data[key]" :schema="object.items" />
            </v-tabs-window-item>
        </v-tabs-window>
    </div>
</template>