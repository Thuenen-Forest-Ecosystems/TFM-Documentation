<script setup>
    import { onMounted, ref, computed } from 'vue';
    
    const props = defineProps({
        data: {
            type: Object,
            required: true,
        },
        schema: {
            type: Object,
            required: true,
        },
        validationErrors: {
            type: Array,
            default: () => []
        },
        plausibilityErrors: {
            type: Array,
            default: () => []
        },
    });

    /*
    // Simplified type checking function
    function isValidType(type) {
        console.log('Checking type:', type); // Debug log
        
        // Handle simple string types
        if (typeof type === 'string') {
            return ['string', 'number', 'boolean'].includes(type);
        }
        
        // Handle array of types
        if (Array.isArray(type)) {
            return type.some(t => ['string', 'number', 'boolean'].includes(t));
        }
        
        return false;
    }*/

    function hasNotType(type){
        // array and object are not valid
        if (typeof type === 'string') {
            return !['array', 'object'].includes(type);
        }

        if (Array.isArray(type)) {
            return !type.some(t => ['array', 'object'].includes(t));
        }

        return false;

    }

    // Check if a field should be displayed based on schema configuration
    function shouldDisplayField(property) {
        /* Check frontend.display
        if (property.$migration?.frontend?.display === false) {
            return false;
        }*/
        
        // Check $tfm.form.ui:options.display
        if (property.$tfm?.form?.['ui:options']?.display === false) {
            return false;
        }
        
        return true;
    }

    // Filter valid properties
    const validProperties = computed(() => {
        if (!props.schema?.properties) return {};
        
        return Object.entries(props.schema.properties)
            .filter(([key, property]) => {
                // Existing type validation
                if (!property || !property.type || !hasNotType(property.type)) {
                    return false;
                }
                
                // New display validation
                if (!shouldDisplayField(property)) {
                    return false;
                }
                
                return true;
            })
            .reduce((acc, [key, property]) => {
                acc[key] = property;
                return acc;
            }, {});
    });

    // Collect validation and plausibility errors for a specific field key
    function getFieldErrors(key) {
        const validation = props.validationErrors.filter(e => {
            const p = e.instancePath || '';
            return p === `/${key}` || p.startsWith(`/${key}/`);
        });
        const plausibility = props.plausibilityErrors.filter(e => {
            const p = e.instancePath || '';
            return p === `/${key}` || p.startsWith(`/${key}/`);
        });
        return {
            validation,
            plausibility,
            hasError: validation.length > 0 || plausibility.some(e => e.error?.type === 'error'),
            hasWarning: plausibility.some(e => e.error?.type !== 'error'),
            validationMessages: validation.map(e => e.message),
        };
    }

    // Get display value (handle enums)
    function getDisplayValue(key, property) {
        const value = props.data[key];

        // Check if the property has an enum
        if (property.enum && Array.isArray(property.enum)) {
            const enumIndex = property.enum.indexOf(value);
            if (enumIndex !== -1 && property['$tfm']?.name_de) {
                return (value ? ` ${value} | ` : '') +property['$tfm'].name_de[enumIndex]; // Use the German name (or adjust as needed)
            }
        }

        // Fallback to the raw value
        return value || ' ';
    }

</script>


<template>
    <v-container v-if="props.schema && props.schema.properties">
        <v-row>
            <v-col
                v-for="(property, key) in validProperties"
                :key="key"
                cols="12"
                sm="6"
                md="4"
            >
                
                    <v-text-field
                        :label="property.title || key"
                        :model-value="getDisplayValue(key, property)"
                        variant="solo-filled"
                        readonly
                        :error="getFieldErrors(key).hasError"
                        :messages="getFieldErrors(key).hasError ? getFieldErrors(key).validationMessages : []"
                    >
                    <template v-slot:append-inner>
                        <v-tooltip v-if="getFieldErrors(key).plausibility.length > 0">
                            <template #activator="{ props: tp }">
                                <v-icon
                                    v-bind="tp"
                                    density="compact"
                                    :color="getFieldErrors(key).plausibility.some(e => e.error?.type === 'error') ? 'red' : 'orange'"
                                >
                                    {{ getFieldErrors(key).plausibility.some(e => e.error?.type === 'error') ? 'mdi-alert-octagon' : 'mdi-alert-circle' }}
                                </v-icon>
                            </template>
                            <div v-for="(e, i) in getFieldErrors(key).plausibility" :key="i">{{ e.error?.note || e.error?.text }}</div>
                        </v-tooltip>
                        <v-tooltip>
                            <template #activator="{ props: ip }">
                                <v-icon v-bind="ip" density="compact">mdi-information</v-icon>
                            </template>
                            <span>{{ property.description || '' }}</span>
                        </v-tooltip>
                    </template>
                    </v-text-field>
            </v-col>
        </v-row>
    </v-container>
</template>