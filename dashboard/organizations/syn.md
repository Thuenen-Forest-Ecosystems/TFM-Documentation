
<script setup>
    import { usePowerSync } from '@powersync/vue';
    const powersync = usePowerSync();
    import SyncStatus from '../../components/SyncStatus.vue';

    import { ref } from 'vue';

    const list = ref([]);

    const powersync = usePowerSync();
    console.log('Powersync instance:', powersync.value);
    powersync.value.getAll('SELECT * from records').then((l) => list.value = l).catch((e) => console.error(e)).finally(() => {
        console.log('List of records:', list.value);
    });
</script>

# Sync

<SyncStatus />

{{ list.length }} records found.