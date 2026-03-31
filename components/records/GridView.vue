<script setup>
    import { onMounted, ref, computed } from 'vue';
    import GridViewTableTab from './GridViewTableTab.vue';
    import GridViewGridTab from './GridViewGridTab.vue';

    const tab = ref(null);
    const nestedTabs = ref({});

    const props = defineProps({
        data: {
            type: Object,
            required: true,
        },
        schema: {
            type: Object,
            required: true,
        },
        // Single layout item from style-map (drives content rendering)
        styleTab: {
            type: Object,
            required: false,
            default: null
        },
        // Legacy: full styleMap (manages its own tabs internally)
        styleMap: {
            type: Object,
            required: false,
            default: null
        },
    });

    const tabObjects = ref({});
    const autoGenLoaded = ref(false);

    function findInType(types, key) {
        if (Array.isArray(types)) {
            return types.some(type => findInType(type, key));
        }
        if (typeof types === 'object' && types !== null) {
            return key in types.properties;
        }
        if (types === key) {
            return true;
        }
        return false;
    }

    function getAllObjectsFromSchema(schema) {
        const objects = {};
        for (const key in schema.properties) {
            const property = schema.properties[key];
            if (findInType(property.type, 'array')) {
                objects[key] = property;
                objects[key].showAsTable = true;
            }
        }
        return objects;
    }

    function getNonObjectProperties(schema) {
        const nonObjects = {
            title: schema.title || 'Details',
            showAsTable: false
        };
        for (const key in schema.properties) {
            const property = schema.properties[key];
            if (!findInType(property.type, 'array')) {
                nonObjects[key] = property;
                nonObjects[key].showAsTable = false;
            }
        }
        return nonObjects;
    }

    // Build a filtered schema from a style-map form item's properties list.
    // Always returns a filtered schema - never falls back to the full schema.
    function getFormSchema(formItem, baseSchema = null) {
        const schema = baseSchema || props.schema;
        if (!schema?.properties) return { ...(schema || {}), properties: {} };
        const fieldKeys = (formItem.properties || []).map(p => p.name).filter(Boolean);
        if (fieldKeys.length === 0) return schema;
        const filteredProps = Object.fromEntries(
            fieldKeys
                .filter(key => schema.properties[key])
                .map(key => [key, schema.properties[key]])
        );
        return { ...schema, properties: filteredProps };
    }

    // Resolve data for a dotted property path like "subplots_relative_position.items"
    function getNestedData(propertyPath) {
        if (!propertyPath) return null;
        const parts = propertyPath.split('.');
        let value = props.data;
        for (const part of parts) {
            if (part === 'items' && Array.isArray(value)) break; // .items on array = the array itself
            value = value?.[part] ?? null;
        }
        return Array.isArray(value) ? value : (value ? [value] : []);
    }

    // Resolve items schema for a dotted property path
    function getNestedSchema(propertyPath) {
        if (!propertyPath || !props.schema?.properties) return null;
        const topKey = propertyPath.split('.')[0];
        return props.schema.properties[topKey]?.items ?? null;
    }

    // Legacy: styleMap manages its own tabs
    const styleMapTabs = computed(() => {
        if (!props.styleMap?.layout?.items) return null;
        return props.styleMap.layout.items.filter(
            item => item.id !== 'messages' && item.id !== 'position_column'
        );
    });

    onMounted(() => {
        // styleTab mode: no internal tabs needed
        if (props.styleTab) return;

        // Legacy styleMap mode
        if (props.styleMap?.layout?.items) {
            const tabs = props.styleMap.layout.items.filter(
                item => item.id !== 'messages' && item.id !== 'position_column'
            );
            if (tabs.length > 0) tab.value = tabs[0].id;
            return;
        }

        // Auto-generated mode (only when neither styleTab nor styleMap provided)
        if (!props.schema?.properties) return;
        const nonObjects = getNonObjectProperties(props.schema);
        tabObjects.value = { plot: nonObjects, ...getAllObjectsFromSchema(props.schema) };
        const firstKey = Object.keys(tabObjects.value)[0];
        tab.value = firstKey;
        autoGenLoaded.value = true;
    });
</script>

<template>
    <div>
        <!-- === STYLE-TAB MODE: render single tab item's content === -->
        <template v-if="styleTab">
            <!-- Direct array/datagrid -->
            <GridViewTableTab
                v-if="styleTab.component === 'datagrid' && styleTab.property"
                :data="props.data?.[styleTab.property] || []"
                :schema="props.schema?.properties?.[styleTab.property]?.items"
            />
            <!-- Column: cards, nested tabs, direct arrays -->
            <div v-else-if="styleTab.type === 'column'" class="pa-1">
                <template v-for="item in (styleTab.items || [])" :key="item.id || item.label">

                    <!-- Card item with form/table children -->
                    <v-card v-if="item.type === 'card'" variant="tonal" class="ma-2">
                        <v-card-title v-if="item.label" class="text-subtitle-2 pa-3">{{ item.label }}</v-card-title>
                        <template v-for="formItem in (item.items || [])" :key="formItem.id">
                            <!-- Form with property path → render as form with nested data -->
                            <GridViewGridTab
                                v-if="formItem.type === 'form' && formItem.property"
                                :data="getNestedData(formItem.property)?.[0] || {}"
                                :schema="getFormSchema(formItem, getNestedSchema(formItem.property))"
                            />
                            <!-- Normal form -->
                            <GridViewGridTab
                                v-else-if="formItem.type === 'form'"
                                :data="props.data"
                                :schema="getFormSchema(formItem)"
                            />
                        </template>
                    </v-card>

                    <!-- Nested tabs (e.g. Bestockung: kleiner/größer 4m) -->
                    <div v-else-if="item.type === 'tabs'" class="ma-2">
                        <v-tabs v-model="nestedTabs[styleTab.id]" align-tabs="center">
                            <v-tab
                                v-for="t in (item.items || [])"
                                :key="t.label"
                                :text="t.label"
                                :value="t.label"
                            />
                        </v-tabs>
                        <v-tabs-window v-model="nestedTabs[styleTab.id]">
                            <v-tabs-window-item
                                v-for="t in (item.items || [])"
                                :key="t.label"
                                :value="t.label"
                            >
                                <template v-for="subItem in (t.items || [])" :key="subItem.id || subItem.label">
                                    <GridViewGridTab
                                        v-if="subItem.type === 'form'"
                                        :data="props.data"
                                        :schema="getFormSchema(subItem)"
                                    />
                                    <GridViewTableTab
                                        v-else-if="subItem.component === 'datagrid' && subItem.property"
                                        :data="props.data?.[subItem.property] || []"
                                        :schema="props.schema?.properties?.[subItem.property]?.items"
                                    />
                                </template>
                            </v-tabs-window-item>
                        </v-tabs-window>
                    </div>

                    <!-- Direct array/datagrid within column (e.g. regeneration in Verjüngung) -->
                    <GridViewTableTab
                        v-else-if="item.component === 'datagrid' && item.property"
                        :data="props.data?.[item.property] || []"
                        :schema="props.schema?.properties?.[item.property]?.items"
                        class="ma-2"
                    />

                </template>
            </div>
        </template>

        <!-- === LEGACY styleMap MODE (self-managed tabs) === -->
        <template v-else-if="styleMapTabs">
            <v-tabs v-model="tab">
                <v-tab v-for="t in styleMapTabs" :key="t.id" :text="t.label" :value="t.id"></v-tab>
            </v-tabs>
            <v-tabs-window v-model="tab">
                <v-tabs-window-item v-for="t in styleMapTabs" :key="t.id" :value="t.id">
                    <GridViewTableTab
                        v-if="t.component === 'datagrid' && t.property && props.data"
                        :data="props.data[t.property] || []"
                        :schema="props.schema?.properties[t.property]?.items"
                    />
                    <div v-else-if="t.type === 'column'" class="pa-1">
                        <template v-for="card in (t.items || [])" :key="card.id">
                            <v-card v-if="card.type === 'card'" variant="tonal" class="ma-2">
                                <v-card-title class="text-subtitle-2 pa-3">{{ card.label }}</v-card-title>
                                <template v-for="formItem in (card.items || [])" :key="formItem.id">
                                    <GridViewGridTab v-if="formItem.type === 'form'" :data="props.data" :schema="getFormSchema(formItem)" />
                                </template>
                            </v-card>
                        </template>
                    </div>
                </v-tabs-window-item>
            </v-tabs-window>
        </template>

        <!-- === AUTO-GENERATED MODE === -->
        <template v-else-if="autoGenLoaded">
            <v-tabs v-model="tab">
                <v-tab v-for="(object, index) in tabObjects" :key="index" :text="object.title" :value="index"></v-tab>
            </v-tabs>
            <v-tabs-window v-model="tab">
                <v-tabs-window-item v-for="(object, key) in tabObjects" :key="key" :value="key">
                    <GridViewTableTab v-if="object.showAsTable" :data="props.data[key]" :schema="object.items" />
                    <GridViewGridTab v-else :data="props.data" :schema="props.schema" />
                </v-tabs-window-item>
            </v-tabs-window>
        </template>
    </div>
</template>