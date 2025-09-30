<script setup>
    import { onMounted, ref, watch, getCurrentInstance } from 'vue';
    import { getOrganizationById, getTroopById, workflowFromRecord } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;


    const props = defineProps({
        plot_id: {
            type: String,
            required: true
        }
    });

    const latestPlot = ref(null);
    let plotData = ref([]);
    const activeItem = ref(null);

    const loading = ref(false);

    const emit = defineEmits(['select:record']);


    function sortPlotData() {
        plotData.value.sort((a, b) => a.sortByDate - b.sortByDate);
    }

    const addAsyncDataToItems = async (items) => {
        return await Promise.all(items.map(async (item) => {
            if (item.responsible_troop) {
                item.troopData = await getTroopById(supabase, item.responsible_troop);
            }

            if (item.responsible_provider) {
                // If troopData is still null but responsible_troop exists, fetch it
                item.providerData = await getOrganizationById(supabase, item.responsible_provider);
            }
            if (item.responsible_state) {
                // If troopData is still null but responsible_troop exists, fetch it
                item.stateData = await getOrganizationById(supabase, item.responsible_state);
            }
            if (item.responsible_administration) {
                // If troopData is still null but responsible_troop exists, fetch it
                item.administrationData = await getOrganizationById(supabase, item.responsible_administration);
            }

            return item;
        }));
    };

    const getHistory = async (plotId) => {
        const { data, error } = await supabase
            .from('record_changes')
            .select('*')
            .eq('plot_id', plotId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching history:', error);
            return [];
        }


        return data; // Replace the old data with the updated data
    };

    const getLatest = async (plotId) => {
        const { data, error } = await supabase
            .from('records')
            .select('*')
            .eq('plot_id', plotId)
            .single();

        if (error) {
            console.error('Error fetching latest plot:', error);
            return;
        }
        data.sortByDate = data.updated_at;
        latestPlot.value = data;
        plotData.value.push(data); // add current record

        const historyData = await getHistory(plotId);
        historyData.forEach(record => {
            record.sortByDate = record.created_at;
            plotData.value.push(record); // add historical records
        });

        const updatedData = await addAsyncDataToItems(plotData.value);
        plotData.value = updatedData;

        sortPlotData();

        // Preselect the latest item
        if (plotData.value.length > 0) {
            activeItem.value = plotData.value[0];
            emit('select:record', activeItem.value);
        }
    };

    onMounted(async () => {
        loading.value = true;
        await getLatest(props.plot_id);
        loading.value = false;
    });

    watch(() => props.plot_id, async (newPlotId) => {
        if (!newPlotId) return;
        loading.value = true;
        await getLatest(newPlotId);
        loading.value = false;
    });

    function isDifferent(item1, item2) {
        return JSON.stringify(item1) !== JSON.stringify(item2);
    }

    function emitActiveItem(item) {
        activeItem.value = item;
        emit('select:record', item);
    }

    const items = [
    { title: 'Click Me' },
    { title: 'Click Me' },
    { title: 'Click Me' },
    { title: 'Click Me 2' },
  ]

</script>



<template>
    <v-timeline
        direction="horizontal" line-inset="12"
        v-bind="$attrs"
        align="center" density="compact" class="ma-2">
        <v-timeline-item
            size="small"
            v-for="(item, index) in plotData"
            :key="index"
            :dot-color="item.is_valid ? 'primary' : 'red'"
            @click="emitActiveItem(item)"
            class="clickable-timeline-item"
            :fill-dot="activeItem === item"
        >
          
            <v-menu open-on-hover>
                <template v-slot:activator="{ props }">
                    <div v-bind="props" >
                        <p class="mb-2 text-center" style="white-space: nowrap;">
                            {{ new Date(item.sortByDate).toLocaleDateString() }} {{ new Date(item.sortByDate).toLocaleTimeString() }}
                        </p>
                        <!--<strong v-else>Aktueller Status</strong>-->

                        <v-chip class="mb-2 text-caption">
                            {{ workflowFromRecord(item).title }}
                        </v-chip>
                    </div>
                </template>

                <v-card>
                    <v-card variant="tonal" class="mb-1" v-if="!plotData[index - 1] || isDifferent(item.responsible_troop, plotData[index - 1]?.responsible_troop) ||  isDifferent(item.completed_at_troop, plotData[index - 1]?.completed_at_troop)">
                    <template v-slot:title>
                        {{item.troopData ? (item.troopData?.name ? item.troopData.name : 'no name') : (item.responsible_troop ? item.responsible_troop : '-') }}
                    </template>
                    <template v-slot:subtitle >
                        {{ item.troopData ? (item.troopData.is_control_troop ? 'Kontrolltrupp' : `Aufnahmetrupp`) : 'Trupp' }}
                    </template>

                    <v-card-text>
                        <v-chip :color="item.completed_at_troop ? 'green' : 'yellow'">
                            <span v-if="item.completed_at_troop">
                                {{ new Date(item.completed_at_troop).toLocaleDateString() }}
                                {{ new Date(item.completed_at_troop).toLocaleTimeString() }}
                            </span>
                            <span v-else>
                                offen
                            </span>
                        </v-chip>
                    </v-card-text>
                    <!--<template v-slot:append>
                        <v-chip v-if="item.troopData">
                            {{ item.troopData.is_control_troop ? 'KT' : `AT` }}
                        </v-chip>
                    </template>-->
                </v-card>
                

                <v-card title="Dienstleister" variant="tonal" class="mb-1" v-if="!plotData[index - 1] || isDifferent(item.responsible_provider, plotData[index - 1]?.responsible_provider)">
                    <template v-slot:title>
                        {{ item.providerData ? item.providerData.name : (item.responsible_provider ? item.responsible_provider : '-') }}
                    </template>
                    <template v-slot:subtitle>
                        Dienstleister
                    </template>
                </v-card>

                <v-card title="Landesinventurleitung" variant="tonal" class="pa-2" v-if="!plotData[index - 1] || isDifferent(item.responsible_state, plotData[index - 1]?.responsible_state) ||  isDifferent(item.completed_at_state, plotData[index - 1]?.completed_at_state)">
                    <template v-slot:title>
                        {{ item.stateData ? item.stateData.name : (item.responsible_state ? item.responsible_state : '-') }}
                    </template>
                    <template v-slot:subtitle>
                        Landesinventurleitung
                    </template>
                    <v-card-text>
                        <v-chip :color="item.completed_at_state ? 'green' : 'yellow'">
                            <span v-if="item.completed_at_state">
                                {{ new Date(item.completed_at_state).toLocaleDateString() }}
                                {{ new Date(item.completed_at_state).toLocaleTimeString() }}
                            </span>
                            <span v-else>
                                offen
                            </span>
                        </v-chip>
                    </v-card-text>
                </v-card>
                </v-card>
            </v-menu>
            
        </v-timeline-item>
        <v-timeline-item
            v-if="latestPlot"
            size="small">
            <div class="d-flex flex-column">
                <div class="text-caption">
                    erstellt
                </div>
                <strong class="me-4">{{ new Date(latestPlot.created_at).toLocaleDateString() }}</strong>
            </div>
        </v-timeline-item>
    </v-timeline>
</template>

<style scoped>
    .clickable-timeline-item {
        position: relative;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .clickable-timeline-item:hover {
        background-color: rgba(0, 0, 0, 0.04);
        border-radius: 4px;
    }

    .creation-timeline-item {
        opacity: 0.7;
    }
    .popout-card {
        position: absolute;
        bottom: 100%; /* Adjust as needed */
        left: 100%; /* Position to the right of the timeline item */
        z-index: 100;
        width: 250px; /* Adjust width as needed */
        transition: opacity 0.2s ease;
    }
</style>