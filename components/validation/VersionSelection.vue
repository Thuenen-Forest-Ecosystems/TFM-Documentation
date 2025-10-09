<script setup>
    import { onMounted, ref, getCurrentInstance, computed } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    let versions = ref([]);

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
        const { data, error } = await supabase
            .from('schemas')
            .select('directory, version, title')
            .eq('interval_name', 'ci2027')
            .eq('is_visible', true)
            .not('directory', 'is', null)
            .not('version', 'is', null)
            .not('title', 'is', null)
            .order('version', { ascending: false });
            
        if (error) {
            console.error('Error fetching plausibility:', error);
            return;
        }
        
        try {
            const newVersions = data.map(d => ({
                id: d.version,
                name: d.title,
                directory: d.directory
            }));
            versions.value = newVersions;

            if (newVersions.length > 0 && !props.modelValue) {
                emit('update:modelValue', newVersions[0]);
            }
        } catch (e) {
            console.error('Error reading plausibility bundle:', e);
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