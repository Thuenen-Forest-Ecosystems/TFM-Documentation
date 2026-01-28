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
        }
    });

    const emit = defineEmits(['update:modelValue']);

    onMounted(async () => {
        if (cachedVersions) {
            versions.value = cachedVersions;
        } else {
            if (!fetchPromise) {
                fetchPromise = supabase
                    .from('schemas')
                    .select('directory, version, title')
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
                    id: d.version,
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

        if (versions.value.length > 0 && !props.modelValue) {
            emit('update:modelValue', versions.value[0]);
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
    ></v-select>
</template>