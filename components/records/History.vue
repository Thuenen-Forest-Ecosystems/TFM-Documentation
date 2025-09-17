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

    const emit = defineEmits(['select:record']);


    function sortPlotData() {
        plotData.value.sort((a, b) => b.sortByDate - a.sortByDate);
    }

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
        
        

        const updatedData = await Promise.all(
            data.map(async (item) => {
                item.sortByDate = item.created_at;
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
            })
        );


        plotData.value = updatedData; // Replace the old data with the updated data
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
        plotData.value.push(data);

        getHistory(data.plot_id);
        sortPlotData();
    };

    onMounted(async () => {
        await getLatest(props.plot_id);
    });

    watch(() => props.plot_id, async (newPlotId) => {
        await getLatest(newPlotId);
    });

    function isDifferent(item1, item2) {
        return JSON.stringify(item1) !== JSON.stringify(item2);
    }

    function emitActiveItem(item) {
        activeItem.value = item;
        emit('select:record', item);
    }

</script>



<template>
    <v-timeline
        v-bind="$attrs"
        align="start" density="compact" class="ma-2" style="width: 400px;">
        <v-timeline-item
            size="small"
            v-for="(item, index) in plotData"
            :key="index"
            :dot-color="item.is_valid ? 'primary' : 'red'"
            @click="emitActiveItem(item)"
            class="clickable-timeline-item"
            :fill-dot="activeItem === item"
        >
            <div class="d-flex flex-column">
                <strong v-if="index!==0" class="me-4">{{ new Date(item.sortByDate).toLocaleDateString() }} {{ new Date(item.sortByDate).toLocaleTimeString() }}</strong>
                <strong v-else>Aktueller Status</strong>

                <div class="mb-2 text-caption">
                    {{ workflowFromRecord(item).title }}
                </div>

                    
                    <v-card variant="tonal" class="mb-1" v-if="!plotData[index - 1] || isDifferent(item.responsible_troop, plotData[index - 1]?.responsible_troop) ||  isDifferent(item.completed_at_troop, plotData[index - 1]?.completed_at_troop)">
                        <template v-slot:title>
                            {{item.troopData ? item.troopData.name : item.responsible_troop }}
                        </template>
                        <template v-slot:subtitle>
                            Trupp
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
                        <template v-slot:append>
                            <v-chip v-if="item.troopData">
                                {{ item.troopData.is_control_troop ? 'KT' : `AT` }}
                            </v-chip>
                        </template>
                    </v-card>
                    

                    <v-card title="Dienstleister" variant="tonal" class="mb-1" v-if="!plotData[index - 1] || isDifferent(item.responsible_provider, plotData[index - 1]?.responsible_provider)">
                        <template v-slot:title>
                            {{ item.providerData ? item.providerData.name : `${item.responsible_provider}` }}
                        </template>
                        <template v-slot:subtitle>
                            Dienstleister
                        </template>
                    </v-card>


                    <v-card title="Landesinventurleitung" variant="tonal" class="pa-2" v-if="!plotData[index - 1] || isDifferent(item.responsible_state, plotData[index - 1]?.responsible_state) ||  isDifferent(item.completed_at_state, plotData[index - 1]?.completed_at_state)">
                        <template v-slot:title>
                            {{ item.stateData ? item.stateData.name : `${item.responsible_state}` }}
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
                    <!--
                    <v-card class="my-2" v-if="!plotData[index - 1] || isDifferent(item.responsible_administration, plotData[index - 1]?.responsible_administration)">
                        <p class="text-caption">Bundesinventurleitung:</p>
                        {{ item.administrationData ? item.administrationData.name : '' }}

                        <div class="my-2" v-if="!plotData[index - 1] || isDifferent(item.completed_at_administration, plotData[index - 1]?.completed_at_administration)">
                            <p class="text-caption">Bundesinventurleitung abgeschlossen:</p>
                            {{ item.completed_at_administration ? new Date(item.completed_at_administration).toLocaleDateString() : '' }}
                            {{ item.completed_at_administration ? new Date(item.completed_at_administration).toLocaleTimeString() : '' }}
                        </div>
                    </v-card>
                    -->
            </div>
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
</style>