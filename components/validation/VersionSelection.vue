<script setup>

    import { onMounted, ref, getCurrentInstance, computed } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    let versions = ref([]);

    // Sync <VersionSelection v-model="selectedVersion" /> with selectedVersion in ClusterDetails.vue
    const props = defineProps({
        modelValue: {
            type: Object, // Adjust the type based on your `selectedVersion` structure
            required: false,
            default: null
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

    // Create a computed property for two-way binding
    const selectedVersion = computed({
        get() {
            return props.modelValue;
        },
        set(value) {
            console.log('Raw value from v-select:', value, 'versions:', versions.value);
            
            let fullObject;
            
            if (typeof value === 'string') {
                // Try to find by id first, then by name
                fullObject = versions.value.find(v => v.id === value) || 
                            versions.value.find(v => v.name === value);
            } else if (typeof value === 'object' && value !== null) {
                fullObject = value;
            }
            
            console.log('Emitting selected version:', fullObject);
            emit('update:modelValue', fullObject);
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
        return-object
    ></v-select>
</template>