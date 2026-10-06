<script setup>
    import { computed } from 'vue';

    // Read-only count of the rows of one record array, declared in the
    // style-map as `"component": "array_summary"` (e.g. the WZP4 sample trees
    // shown in the Bestockung tab, TFM-client-app#348). Mirrors the app's
    // ArraySummary widget: `options.filter` uses the same field/operator/values
    // rules the datagrids parse, every rule has to match, and a row whose field
    // is absent is not counted. Informative only - never a validation.
    const props = defineProps({
        item: {
            type: Object,
            required: true,
        },
        data: {
            type: Object,
            default: () => ({}),
        },
    });

    function matchesRule(rule, value) {
        const values = Array.isArray(rule.values) ? rule.values : (Array.isArray(rule.notIn) ? rule.notIn : []);
        switch (rule.operator || 'notIn') {
            case 'notIn':
                return !values.includes(value);
            case 'in':
                return values.includes(value);
            case 'equals':
                return value === values[0];
            case 'notEquals':
                return value !== values[0];
            case 'greaterThan':
                return typeof value === 'number' && typeof values[0] === 'number' && value > values[0];
            case 'lessThan':
                return typeof value === 'number' && typeof values[0] === 'number' && value < values[0];
            default:
                return true;
        }
    }

    const count = computed(() => {
        const rows = props.data?.[props.item?.property];
        if (!Array.isArray(rows)) return 0;
        const rules = (Array.isArray(props.item?.options?.filter) ? props.item.options.filter : [])
            .filter(rule => rule && typeof rule === 'object' && rule.field);
        return rows.filter(row =>
            row && typeof row === 'object' && rules.every(rule => matchesRule(rule, row[rule.field]))
        ).length;
    });

    const description = computed(() => props.item?.options?.description || null);
</script>

<template>
    <v-card variant="tonal" class="ma-2">
        <div class="d-flex align-center pa-3">
            <v-icon v-if="props.item?.icon" :icon="'mdi-' + props.item.icon" class="mr-3" />
            <div class="flex-grow-1">
                <div class="text-subtitle-2">{{ props.item?.label || props.item?.id }}</div>
                <div v-if="description" class="text-caption text-medium-emphasis">{{ description }}</div>
            </div>
            <div class="text-h6 font-weight-bold text-primary ml-3">{{ count }}</div>
        </div>
    </v-card>
</template>
