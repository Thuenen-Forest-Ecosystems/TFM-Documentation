<script setup>

    import { onMounted, ref, getCurrentInstance } from 'vue';
    import ClusterSelection from '../components/ClusterSelection.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const selectedCluster = ref(null);
    const loading = ref(false);


    const loadStorageFiles = async () => {
        
        try {
            loading.value = true;
            supabase
                .storage
                .from('schema')
                .download('schema.json')
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error fetching storage files:', error);
                    } else {
                        // blob to text conversion
                        const reader = new FileReader();
                        reader.onload = () => {
                            const jsonData = JSON.parse(reader.result);
                            instance.appContext.config.globalProperties.$schema = jsonData;
                            console.log('Schema loaded:', jsonData);
                        };
                        reader.readAsText(data);
                        console.log('Storage files loaded:', data);
                    }
                });
        } catch (error) {
            console.error('Error loading storage files:', error);
        } finally {
            loading.value = false;
        }
    };

    onMounted(() => {
        loadStorageFiles();

        // https://ci.thuenen.de/storage/v1/object/sign/schema/validation.js?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJzY2hlbWEvdmFsaWRhdGlvbi5qcyIsImlhdCI6MTc1MzcxNzgzNywiZXhwIjoxODE2Nzg5ODM3fQ.1cyRV839c43Za27HxVpPS3eWLz-on4IqDjkOKiOgTBM
        const script = document.createElement('script');
        script.src = 'https://ci.thuenen.de/storage/v1/object/sign/schema/validation.js?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJzY2hlbWEvdmFsaWRhdGlvbi5qcyIsImlhdCI6MTc1MzcxNzgzNywiZXhwIjoxODE2Nzg5ODM3fQ.1cyRV839c43Za27HxVpPS3eWLz-on4IqDjkOKiOgTBM';
        script.async = true;
        script.onload = () => {
            console.log('Validation script loaded successfully');
            const tfm = new TFM(host, apikey);
            console.log('TFM instance created', tfm);
        };
        script.onerror = () => {
            console.error('Error loading validation script');
        };
        document.head.appendChild(script);
    });

</script>


# Validation
<ClusterSelection v-if="!loading" v-model="selectedCluster" />

Cluster Selection