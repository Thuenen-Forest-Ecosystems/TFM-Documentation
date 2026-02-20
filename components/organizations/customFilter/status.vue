<script setup>
    import { onMounted, ref, computed } from 'vue';

    const filterParams = ref(null);
    const selectedWorkflowIds = ref([]);

    const props = defineProps({
        params: Object
    });

    // Build color options from workflows passed via filterParams
    const colorOptions = computed(() => {
        if (!filterParams.value?.workflows) return [];
        
        // Group workflows by color
        const colorMap = new Map();
        filterParams.value.workflows.forEach(workflow => {
            const color = workflow.searchText;
            if (!colorMap.has(color)) {
                colorMap.set(color, {
                    color: color,
                    label: color.charAt(0).toUpperCase() + color.slice(1),
                    workflowIds: []
                });
            }
            colorMap.get(color).workflowIds.push(workflow.id);
        });
        
        return Array.from(colorMap.values());
    });

    onMounted(() => {
        console.log('onMounted called with props.params:', props.params); // Debug log
        filterParams.value = props.params;
    });

    function isFilterActive() {
        return selectedWorkflowIds.value.length > 0;
    }

    function doesFilterPass(node) {
        if (!isFilterActive()) {
            return true;
        }

        const cellValue = node.data[filterParams.value.colDef.field];
        console.log('Filtering - cellValue:', cellValue, 'selectedWorkflowIds:', selectedWorkflowIds.value); // Debug log

        // Compare workflow IDs (cellValue should be a workflow ID like 0, 1, 2, etc.)
        return selectedWorkflowIds.value.includes(cellValue);
    }

    function getModel() {
        if (!isFilterActive()) {
            return null;
        }
        return { 
            filterType: 'workflow',
            values: selectedWorkflowIds.value 
        };
    }

    function setModel(model) {
        if (model && model.values) {
            selectedWorkflowIds.value = [...model.values];
        } else {
            selectedWorkflowIds.value = [];
        }
    }

    function onFilterChanged() {
        console.log('onFilterChanged called, selectedWorkflowIds:', selectedWorkflowIds.value); // Debug log
        if (filterParams.value && filterParams.value.filterChangedCallback) {
            filterParams.value.filterChangedCallback();
        }
    }

    function toggleColor(colorOption) {
        colorOption.workflowIds.forEach(id => {
            const index = selectedWorkflowIds.value.indexOf(id);
            if (index > -1) {
                selectedWorkflowIds.value.splice(index, 1);
            } else {
                selectedWorkflowIds.value.push(id);
            }
        });
        onFilterChanged();
    }

    function isColorSelected(colorOption) {
        return colorOption.workflowIds.some(id => selectedWorkflowIds.value.includes(id));
    }

</script>

<template>
    <v-card flat class="pa-3" style="min-width: 250px;">
        <v-card-text class="pa-0">
            <!-- Color Options -->
            <v-list density="compact" class="pa-0">
                <v-list-item
                    v-for="option in colorOptions"
                    :key="option.color"
                    @click="() => toggleColor(option)"
                    class="px-1"
                >
                    <template v-slot:prepend>
                        <v-icon 
                            :color="option.color"
                            class="me-3"
                        >{{ option.color === 'red' ? 'mdi-close-octagon' : option.color === 'yellow' ? 'mdi-alert' : 'mdi-check' }}</v-icon>
                    </template>
                    
                    <!--<v-list-item-title>{{ option.label }}</v-list-item-title>-->
                    
                    <template v-slot:append>
                        <v-checkbox-btn
                            :model-value="isColorSelected(option)"
                            color="primary"
                            density="compact"
                        ></v-checkbox-btn>
                    </template>
                </v-list-item>
            </v-list>
        </v-card-text>
    </v-card>
</template>