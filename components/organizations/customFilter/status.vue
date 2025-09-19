<script setup>
    import { onMounted, ref } from 'vue';

    const filterParams = ref(null);
    const selectedColors = ref([]);

    const props = defineProps({
        params: Object
    });

    //const params = ref(null);

    // Update colorOptions to match the actual hex values from your data
    const colorOptions = [
        { value: 'red', label: 'Red', color: 'red' },
        { value: 'green', label: 'Green', color: 'green' },    // This should match your hardcoded 'green'
        { value: 'yellow', label: 'Yellow', color: 'yellow' }
    ];

    onMounted(() => {
        console.log('onMounted called with props.params:', props.params); // Debug log
        filterParams.value = props.params;
    });

    function isFilterActive() {
        return selectedColors.value.length > 0;
    }

    function doesFilterPass(node) {
        console.log('doesFilterPass called with node:', node); // Debug log
        if (!isFilterActive()) {
            return true;
        }

        const cellValue = node.data[filterParams.value.colDef.field];
        console.log('Filtering - cellValue:', cellValue, 'selectedColors:', selectedColors.value); // Debug log

        // Ensure cellValue is compared as a string
        return selectedColors.value.includes(cellValue?.toString());
    }

    function getModel() {
        if (!isFilterActive()) {
            return null;
        }
        return { 
            filterType: 'color',
            values: selectedColors.value 
        };
    }

    function setModel(model) {
        if (model && model.values) {
            selectedColors.value = [...model.values];
        } else {
            selectedColors.value = [];
        }
    }

    function onFilterChanged() {
        console.log('onFilterChanged called, selectedColors:', selectedColors.value, filterParams.value); // Debug log
        if (filterParams.value && filterParams.value.filterChangedCallback) {
            filterParams.value.filterChangedCallback();
        }
    }

</script>

<template>
    <v-card flat class="pa-3" style="min-width: 250px;">
        <v-card-text class="pa-0">
            <!-- Color Options -->
            <v-list density="compact" class="pa-0">
                <v-list-item
                    v-for="option in colorOptions"
                    :key="option.value"
                    @click="() => {
                        const index = selectedColors.indexOf(option.value);
                        if (index > -1) {
                            selectedColors.splice(index, 1);
                        } else {
                            selectedColors.push(option.value);
                        }
                        onFilterChanged();
                    }"
                    class="px-1"
                >
                    <template v-slot:prepend>
                        <v-avatar 
                            size="20" 
                            :color="option.color"
                            class="me-3"
                        ></v-avatar>
                    </template>
                    
                    <v-list-item-title>{{ option.label }}</v-list-item-title>
                    
                    <template v-slot:append>
                        <v-checkbox-btn
                            :model-value="selectedColors.includes(option.value)"
                            color="primary"
                            density="compact"
                        ></v-checkbox-btn>
                    </template>
                </v-list-item>
            </v-list>
        </v-card-text>
    </v-card>
</template>