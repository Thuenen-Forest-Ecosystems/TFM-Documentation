<script setup>
    const props = defineProps({
        modelValue: {
            type: Boolean,
            required: true
        },
        tabLabel: {
            type: String,
            default: ''
        },
        validationErrors: {
            type: Array,
            default: () => []
        },
        plausibilityErrors: {
            type: Array,
            default: () => []
        }
    });

    const emit = defineEmits(['update:modelValue']);

    function close() {
        emit('update:modelValue', false);
    }
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="700" scrollable>
        <v-card>
            <v-toolbar flat density="compact">
                <v-toolbar-title>Fehler: {{ tabLabel }}</v-toolbar-title>
                <template v-slot:append>
                    <v-btn icon="mdi-close" variant="text" @click="close" />
                </template>
            </v-toolbar>
            <v-card-text class="pa-0">
                <!-- Validation errors -->
                <v-list v-if="validationErrors.length > 0" lines="three">
                    <v-list-subheader>Validierung ({{ validationErrors.length }})</v-list-subheader>
                    <v-list-item v-for="(error, index) in validationErrors" :key="'v-' + index">
                        <template v-slot:prepend>
                            <v-icon icon="mdi-alert-octagon" color="red" />
                        </template>
                        <v-list-item-title class="text-wrap">{{ error.message }}</v-list-item-title>
                        <v-list-item-subtitle>
                            <div>Schema Path: {{ error.schemaPath }}</div>
                            <div v-if="error.instancePath">Instance Path: {{ error.instancePath }}</div>
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>

                <!-- Plausibility errors -->
                <v-list v-if="plausibilityErrors.length > 0" lines="three">
                    <v-list-subheader>Plausibilität ({{ plausibilityErrors.length }})</v-list-subheader>
                    <v-list-item v-for="(error, index) in plausibilityErrors" :key="'p-' + index">
                        <template v-slot:prepend>
                            <v-icon
                                :icon="error.error?.type === 'error' ? 'mdi-alert-octagon' : 'mdi-alert-circle'"
                                :color="error.error?.type === 'error' ? 'red' : 'orange'"
                            />
                        </template>
                        <v-list-item-title class="text-wrap">{{ error.error?.note || error.error?.text }}</v-list-item-title>
                        <v-list-item-subtitle>
                            <div v-if="error.error?.text">{{ error.error.text }}</div>
                            <div v-if="error.error?.code">Code: {{ error.error.code }}</div>
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>

                <!-- No errors -->
                <v-card-text v-if="validationErrors.length === 0 && plausibilityErrors.length === 0">
                    Keine Fehler für diesen Tab.
                </v-card-text>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>
