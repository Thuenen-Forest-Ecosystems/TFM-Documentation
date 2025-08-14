<script setup>
import { computed } from 'vue';

const props = defineProps({
    data: {
        required: true,
    },
    schema: {
        type: Object,
        required: true,
    },
    path: {
        type: String,
        default: '',
    },
    schemaPath: {
        type: String,
        default: '',
    },
    depth: {
        type: Number,
        default: 0,
    },
    maxDepth: {
        type: Number,
        default: 10,
    },
    expandedNodes: {
        type: Set,
        required: true,
    },
    propertyKey: {
        type: String,
        default: null,
    }
});

const emit = defineEmits(['toggle']);

// Get data type for styling
const getDataType = (value) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

// Format display value
const formatValue = (value, type) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (type === 'string') return `"${value}"`;
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'number') return value.toString();
    return value;
};

// Get appropriate icon based on data type
const getTypeIcon = (type, isExpanded = false) => {
    switch (type) {
        case 'object':
            return isExpanded ? 'mdi-folder-open' : 'mdi-folder';
        case 'array':
            return isExpanded ? 'mdi-format-list-bulleted' : 'mdi-format-list-bulleted-square';
        case 'string':
            return 'mdi-format-quote-close';
        case 'number':
            return 'mdi-numeric';
        case 'boolean':
            return 'mdi-checkbox-marked';
        case 'null':
            return 'mdi-null';
        default:
            return 'mdi-help-circle';
    }
};

// Get color based on data type
const getTypeColor = (type) => {
    switch (type) {
        case 'object':
            return 'primary';
        case 'array':
            return 'secondary';
        case 'string':
            return 'success';
        case 'number':
            return 'info';
        case 'boolean':
            return 'warning';
        case 'null':
            return 'error';
        default:
            return 'grey';
    }
};

// Check if value is expandable (object or non-empty array)
const isExpandable = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'object' && Object.keys(value).length > 0;
};

// Get summary for collapsed objects/arrays
const getSummary = (value, type) => {
    if (type === 'object') {
        const keys = Object.keys(value);
        return `${keys.length} ${keys.length === 1 ? 'Eintrag' : 'Einträge'}`;
    }
    if (type === 'array') {
        return `${value.length} ${value.length === 1 ? 'Element' : 'Elemente'}`;
    }
    return '';
};

// Navigate through schema based on path
const getSchemaAtPath = (schemaPath) => {
    if (!schemaPath || schemaPath === '') return props.schema;
    
    const parts = schemaPath.split('.');
    let currentSchema = props.schema;
    
    for (const part of parts) {
        if (currentSchema?.properties?.[part]) {
            currentSchema = currentSchema.properties[part];
        } else if (currentSchema?.items?.properties?.[part]) {
            // Handle arrays with object items
            currentSchema = currentSchema.items.properties[part];
        } else if (currentSchema?.items) {
            // Handle array items
            currentSchema = currentSchema.items;
        } else {
            return null;
        }
    }
    
    return currentSchema;
};

// Get property title from schema
const getPropertyTitle = (key, schemaPath) => {
    const schema = getSchemaAtPath(schemaPath);
    if (schema?.properties?.[key]?.title) {
        return schema.properties[key].title;
    }
    if (schema?.properties?.[key]?.description) {
        return schema.properties[key].description;
    }
    return key;
};

// Computed properties
const dataType = computed(() => getDataType(props.data));
const isCurrentlyExpandable = computed(() => isExpandable(props.data));
const isExpanded = computed(() => props.expandedNodes.has(props.path));
const canExpand = computed(() => props.depth < props.maxDepth && isCurrentlyExpandable.value);

// Handle toggle
const handleToggle = () => {
    if (isCurrentlyExpandable.value) {
        emit('toggle', props.path);
    }
};

// Get children for rendering
const getChildren = () => {
    if (!isCurrentlyExpandable.value || !isExpanded.value) return [];
    
    if (Array.isArray(props.data)) {
        return props.data.map((item, index) => ({
            key: index.toString(),
            value: item,
            path: props.path ? `${props.path}.${index}` : index.toString(),
            schemaPath: props.schemaPath ? `${props.schemaPath}.items` : 'items'
        }));
    } else {
        return Object.entries(props.data).map(([key, value]) => ({
            key,
            value,
            path: props.path ? `${props.path}.${key}` : key,
            schemaPath: props.schemaPath ? `${props.schemaPath}.${key}` : key
        }));
    }
};

const displayKey = computed(() => {
    if (props.propertyKey) {
        return getPropertyTitle(props.propertyKey, props.schemaPath.split('.').slice(0, -1).join('.'));
    }
    return props.path.split('.').pop() || 'root';
});
</script>

<template>
    <div class="json-node" :class="{ nested: depth > 0 }">
        <div class="node-header d-flex align-center">
            <!-- Expand/Collapse Button -->
            <v-btn
                v-if="isCurrentlyExpandable"
                :icon="true"
                variant="text"
                size="small"
                class="expand-button"
                @click="handleToggle"
                :disabled="!canExpand"
            >
                <v-icon 
                    :icon="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="small"
                />
            </v-btn>
            <div v-else class="expand-button"></div>
            
            <!-- Type Icon -->
            <v-icon 
                :icon="getTypeIcon(dataType, isExpanded)" 
                size="small"
                class="mr-2"
            />
            
            <!-- Property Key/Name -->
            <span 
                v-if="propertyKey || path"
                class="property-key mr-2"
                :title="propertyKey ? getPropertyTitle(propertyKey, schemaPath.split('.').slice(0, -1).join('.')) : displayKey"
            >
                {{ propertyKey ? getPropertyTitle(propertyKey, schemaPath.split('.').slice(0, -1).join('.')) : displayKey }}:
            </span>
            
            <!-- Value or Summary -->
            <span v-if="!isCurrentlyExpandable" class="property-value" :class="`${dataType}-value`">
                {{ formatValue(data, dataType) }}
            </span>
            <span v-else-if="!isExpanded" class="expandable-summary">
                {{ getSummary(data, dataType) }}
            </span>
            <span v-else-if="dataType === 'object'" class="expandable-summary">
                
            </span>
            <span v-else-if="dataType === 'array'" class="expandable-summary">
                {{ data.length }}
            </span>
        </div>
        
        <!-- Children (when expanded) -->
        <template v-if="isExpanded && isCurrentlyExpandable">
            <JsonNode
                v-for="child in getChildren()"
                :key="child.path"
                :data="child.value"
                :schema="schema"
                :path="child.path"
                :schema-path="child.schemaPath"
                :depth="depth + 1"
                :max-depth="maxDepth"
                :expanded-nodes="expandedNodes"
                :property-key="child.key"
                @toggle="$emit('toggle', $event)"
            />
            
            <!-- Closing brackets -->
            <div class="node-footer" :class="{ nested: depth >= 0 }">
                <div class="expand-button"></div>
                <span v-if="dataType === 'object'" class="expandable-summary"></span>
                <span v-else-if="dataType === 'array'" class="expandable-summary"></span>
            </div>
        </template>
    </div>
</template>

<style scoped>
.json-node {
    margin-left: 0;
}

.json-node.nested {
    margin-left: 24px;
    border-left: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    padding-left: 16px;
}

.node-header {
    min-height: 32px;
    padding: 2px 0;
}

.node-footer {
    display: flex;
    align-items: center;
    min-height: 24px;
    padding: 2px 0;
}

.property-key {
    font-weight: 500;
    cursor: help;
}

.property-value {
    margin-left: 4px;
}

.string-value {
    color: rgb(var(--v-theme-success));
}

.number-value {
    color: rgb(var(--v-theme-info));
}

.boolean-value {
    color: rgb(var(--v-theme-warning));
}

.null-value {
    color: rgb(var(--v-theme-error));
    font-style: italic;
}

.expandable-summary {
    color: rgba(var(--v-theme-on-surface), 0.6);
    font-style: italic;
    margin-left: 4px;
}

.expand-button {
    min-width: 32px !important;
    width: 32px !important;
    height: 32px !important;
}
</style>
