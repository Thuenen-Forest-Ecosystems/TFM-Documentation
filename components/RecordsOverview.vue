<script setup>
    import { defineProps, onMounted } from 'vue';
    import ListOfClusterRecord from './organizations/ListOfClusterRecord.vue';

    const props = defineProps({
        organization_id: String,
        organization_type: String,
        los: Array,
        cluster: Object
    });
</script>


<template>
    <ListOfClusterRecord :organization_id="props.organization_id" :organization_type="props.organization_type" @confirm="cancelUpdate" :cluster="props.cluster" />
</template>