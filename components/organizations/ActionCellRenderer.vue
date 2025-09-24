<!-- filepath: /Users/b-mini/sites/thuenen/tfm/TFM-Documentation/components/ActionCellRenderer.vue -->
<script setup>
    import { withBase } from 'vitepress';
    import { onMounted, ref, shallowRef } from 'vue';
    import ClusterDetails from '../records/ClusterDetails.vue';

    const dialog = shallowRef(false)

    const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });

    function handleClick(e) {

        e.preventDefault();
        e.stopPropagation();

        if (props.params.onActionClick) {
            props.params.onActionClick(props.params.data);
        }

        //dialog.value = true

        //window.location.href = withBase('/dashboard/records/?clusterId=' + props.params.data.cluster_id);
    
    }
</script>

<template>
    <v-btn
        variant="plain"
        icon="mdi-eye-outline"
        density="compact"
        @click="handleClick"
    ></v-btn>

    <v-dialog
      v-model="dialog"
      fullscreen
    >
        <v-card>
            <v-toolbar>
                <v-btn
                    icon="mdi-close"
                    @click="dialog = false"
                ></v-btn>

                <v-toolbar-title>Trakt: {{ props.params.data.cluster_name }}</v-toolbar-title>

                
            </v-toolbar>
            <ClusterDetails :clusterId="props.params.data.cluster_id"/>
        </v-card>
    </v-dialog>
</template>