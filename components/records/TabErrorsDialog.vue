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

    function getValidationNote(error) {
        return error?.savedNote || error?.note || error?.rawError?.note || null;
    }

    function getPlausibilityType(error) {
        return error?.error?.type || error?.type || error?.rawError?.type || 'error';
    }

    function getPlausibilityTitle(error) {
        return error?.error?.note || error?.error?.text || error?.message || 'Unbekannter Fehler';
    }

    function getPlausibilityText(error) {
        return error?.error?.text || error?.message || null;
    }

    function getPlausibilityCode(error) {
        return error?.error?.code || error?.rawError?.code || null;
    }

    function getPlausibilityNote(error) {
        return error?.savedNote || error?.note || error?.rawError?.note || null;
    }

    function close() {
        emit('update:modelValue', false);
    }
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="700" scrollable>
        <v-card>
            <v-toolbar flat density="compact">
                <v-toolbar-title>Fehler & Warnungen: {{ tabLabel }}</v-toolbar-title>
                <template v-slot:append>
                    <v-btn icon="mdi-close" variant="text" @click="close" />
                </template>
            </v-toolbar>
            <v-card-text class="pa-0">
                <!-- Validation errors -->
                <v-list v-if="validationErrors.length > 0">
                    <v-list-subheader>Validierung ({{ validationErrors.length }})</v-list-subheader>
                    <v-list-item v-for="(error, index) in validationErrors" :key="'v-' + index">
                        <template v-slot:prepend>
                            <v-icon icon="mdi-alert-octagon" color="red" />
                        </template>
                        <v-list-item-title class="text-wrap">{{ error.message }}</v-list-item-title>
                        <v-list-item-subtitle class="error-details">
                            <!--<div>Schema Path: {{ error.schemaPath }}</div>
                            <div v-if="error.instancePath">Instance Path: {{ error.instancePath }}</div>-->
                            <div v-if="getValidationNote(error)" class="error-note">
                                <span class="error-note-label">Notiz:</span>
                                <span>{{ getValidationNote(error) }}</span>
                            </div>
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>

                <!-- Plausibility errors -->
                <v-list v-if="plausibilityErrors.length > 0">
                    <v-list-subheader>Plausibilität ({{ plausibilityErrors.length }})</v-list-subheader>
                    <v-list-item v-for="(error, index) in plausibilityErrors" :key="'p-' + index">
                        <template v-slot:prepend>
                            <v-icon
                                :icon="getPlausibilityType(error) === 'error' ? 'mdi-alert-octagon' : 'mdi-alert-circle'"
                                :color="getPlausibilityType(error) === 'error' ? 'red' : 'orange'"
                            />
                        </template>
                        <v-list-item-title class="text-wrap">{{ getPlausibilityTitle(error) }}</v-list-item-title>
                        <v-list-item-subtitle class="error-details">
                            <div v-if="getPlausibilityText(error)">{{ getPlausibilityText(error) }}</div>
                            <!--<div v-if="getPlausibilityCode(error)">Code: {{ getPlausibilityCode(error) }}</div>
                            <div v-if="error.instancePath">Instance Path: {{ error.instancePath }}</div>-->
                            <div v-if="getPlausibilityNote(error)" class="error-note">
                                <span class="error-note-label">Notiz:</span>
                                <span>{{ getPlausibilityNote(error) }}</span>
                            </div>
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

<style scoped>
    .error-details {
        display: block !important;
        overflow: visible !important;
        line-clamp: unset !important;
        -webkit-line-clamp: unset !important;
        -webkit-box-orient: initial !important;
    }

    .error-note {
        margin-top: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        border-left: 3px solid rgb(var(--v-theme-warning));
        background-color: rgba(var(--v-theme-warning), 0.16);
        color: rgba(var(--v-theme-on-surface), 0.95);
        line-height: 1.35;
    }

    .error-note-label {
        font-weight: 700;
        margin-right: 4px;
    }
</style>
