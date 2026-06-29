<script setup>
    import { onMounted, ref, computed } from 'vue';

    const filterParams = ref(null);
    const selectedWorkflowIds = ref([]);
    // Cross-cutting option: shows rows that have been accepted by the
    // Landesinventurleitung (completed_at_state != null), independent of the
    // per-row workflow id / color.
    const checkAllSelected = ref(false);

    const props = defineProps({
        params: Object
    });

    // Human-readable labels per color group (shown in the filter dropdown).
    const colorLabels = {
        red: 'Handlungsbedarf',
        yellow: 'Bereit zur Übergabe',
        green: 'In Bearbeitung / Erledigt'
    };

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
                    label: colorLabels[color] || (color.charAt(0).toUpperCase() + color.slice(1)),
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
        return selectedWorkflowIds.value.length > 0 || checkAllSelected.value;
    }

    function doesFilterPass(node) {
        if (!isFilterActive()) {
            return true;
        }

        const cellValue = node.data[filterParams.value.colDef.field];

        // Accepted rows are their own mutually-exclusive category (they show the
        // double-check icon), so they must NOT be matched by the color groups even
        // though their workflow id is green.
        const isAccepted = node.data.completed_at_state != null;

        // Compare workflow IDs (cellValue should be a workflow ID like 0, 1, 2, etc.)
        const matchesWorkflow = !isAccepted && selectedWorkflowIds.value.includes(cellValue);
        // 'check_all': rows accepted by the Landesinventurleitung.
        const matchesCheckAll = checkAllSelected.value && isAccepted;

        // Union semantics, consistent with selecting multiple color groups.
        return matchesWorkflow || matchesCheckAll;
    }

    function getModel() {
        if (!isFilterActive()) {
            return null;
        }
        return {
            filterType: 'workflow',
            values: selectedWorkflowIds.value,
            checkAll: checkAllSelected.value
        };
    }

    function setModel(model) {
        if (model && model.values) {
            selectedWorkflowIds.value = [...model.values];
        } else {
            selectedWorkflowIds.value = [];
        }
        checkAllSelected.value = !!(model && model.checkAll);
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

    function toggleCheckAll() {
        checkAllSelected.value = !checkAllSelected.value;
        onFilterChanged();
    }

    defineExpose({
        isFilterActive,
        doesFilterPass,
        getModel,
        setModel
    });

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
                    
                    <v-list-item-title>{{ option.label }}</v-list-item-title>

                    <template v-slot:append>
                        <v-checkbox-btn
                            :model-value="isColorSelected(option)"
                            color="primary"
                            density="compact"
                        ></v-checkbox-btn>
                    </template>
                </v-list-item>

                <!-- check_all: rows accepted by the Landesinventurleitung (completed_at_state != null) -->
                <v-list-item
                    key="check_all"
                    @click="toggleCheckAll"
                    class="px-1"
                >
                    <template v-slot:prepend>
                        <v-icon
                            color="primary"
                            class="me-3"
                            title="Akzeptiert (Landesinventurleitung)"
                        >mdi-check-all</v-icon>
                    </template>

                    <v-list-item-title>Akzeptiert (Landesinventurleitung)</v-list-item-title>

                    <template v-slot:append>
                        <v-checkbox-btn
                            :model-value="checkAllSelected"
                            color="primary"
                            density="compact"
                        ></v-checkbox-btn>
                    </template>
                </v-list-item>
            </v-list>
        </v-card-text>
    </v-card>
</template>