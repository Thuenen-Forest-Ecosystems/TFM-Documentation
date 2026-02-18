<script>
    let cachedVersions = null;
    let fetchPromise = null;
</script>

<script setup>
    import { onMounted, ref, getCurrentInstance, computed, shallowRef } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    let versions = shallowRef([]);

    const props = defineProps({
        modelValue: {
            type: Object,
            required: false,
            default: null
        },
        is_loading: {
            type: Boolean,
            required: false,
            default: false
        },
        default_schema_id: {
            type: String,
            required: false,
            default: null
        }
    });

    const emit = defineEmits(['update:modelValue']);

    onMounted(async () => {
        console.log('🔄 VersionSelection mounted with default_schema_id:', props.default_schema_id, 'current modelValue:', props.modelValue);
        
        if (cachedVersions) {
            versions.value = cachedVersions;
        } else {
            if (!fetchPromise) {
                fetchPromise = supabase
                    .from('schemas')
                    .select('id, directory, version, title')
                    .eq('interval_name', 'ci2027')
                    .eq('is_visible', true)
                    .not('directory', 'is', null)
                    .not('version', 'is', null)
                    .not('title', 'is', null)
                    .order('version', { ascending: false });
            }
            
            const { data, error } = await fetchPromise;

            if (error) {
                console.error('Error fetching plausibility:', error);
                fetchPromise = null;
                return;
            }
            
            try {
                const newVersions = data.map(d => ({
                    id: d.id,
                    version: d.version,
                    name: d.title,
                    directory: d.directory
                }));
                cachedVersions = newVersions;
                versions.value = newVersions;
            } catch (e) {
                console.error('Error reading plausibility bundle:', e);
                fetchPromise = null;
            }
        }

        if (versions.value.length > 0) {
            // Determine default version
            let defaultVersion = versions.value[0];
            
            if (props.default_schema_id) {
                const matchedVersion = versions.value.find(v => v.id === props.default_schema_id);
                if (matchedVersion) {
                    defaultVersion = matchedVersion;
                    console.log('📌 VersionSelection: Found record\'s validated schema:', defaultVersion);
                } else {
                    console.warn('⚠️ Schema ID from record not found:', props.default_schema_id, 'Available:', versions.value.map(v => v.id));
                    console.log('📌 VersionSelection: Falling back to latest version:', defaultVersion);
                }
            } else {
                console.log('📌 VersionSelection: No default_schema_id, using latest version:', defaultVersion);
            }
            
            // Emit default if no current value OR if current value is different from default
            if (!props.modelValue || props.modelValue.id !== defaultVersion.id) {
                console.log('✅ VersionSelection: Emitting default version:', defaultVersion);
                emit('update:modelValue', defaultVersion);
            } else {
                console.log('ℹ️ VersionSelection: Default matches current selection, no update needed');
            }
        }
    });

    const selectedVersion = computed({
        get() {
            return props.modelValue?.id || null;
        },
        set(value) {
            if (!versions.value || versions.value.length === 0 || !value) {
                return;
            }
            
            const fullObject = versions.value.find(v => v.id === value);
            
            if (fullObject && (!props.modelValue || props.modelValue.id !== fullObject.id)) {
                console.log('🔄 VersionSelection: User selected new version:', fullObject);
                emit('update:modelValue', fullObject);
            }
        }
    });
</script>

<template>
    <v-select
        rounded="xl"
        variant="outlined"
        density="compact"
        :items="versions"
        v-model="selectedVersion"
        item-title="name"
        item-value="id"
        :loading="props.is_loading"
    >
        <template v-slot:item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps">
                <template v-slot:append v-if="item.raw.id === props.default_schema_id">
                    <v-icon icon="mdi-check-circle" color="primary" size="small"></v-icon>
                </template>
            </v-list-item>
        </template>
    </v-select>
</template>