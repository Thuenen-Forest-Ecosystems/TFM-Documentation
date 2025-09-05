<script setup>
    import { onMounted, ref, watch, getCurrentInstance } from 'vue';
import { workflowFromRecord } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;


    const props = defineProps({
        plot_id: {
            type: String,
            required: true
        }
    });

    const latestPlot = ref(null);
    const plotData = ref([]);


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
        data.map(item => {
            item.sortByDate = item.created_at;
        });
        plotData.value.push(...data);
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

</script>



<template>
    <div class="font-weight-bold ms-1 mb-2">Today</div>
    <v-timeline align="start" density="compact">
        <v-timeline-item
            size="small"
            v-for="(item, index) in plotData"
            :key="index"
            :dot-color="item.is_valid ? 'primary' : 'red'"
        >
            <div class="d-flex flex-column">
                <strong v-if="index!==0" class="me-4 mb-2">{{ new Date(item.sortByDate).toLocaleDateString() }} {{ new Date(item.sortByDate).toLocaleTimeString() }}</strong>
                <strong v-else>Aktueller Status</strong>

                <p>
                    Status: {{ workflowFromRecord(item).title }}
                </p>

                <div class="text-caption" v-if="!plotData[index - 1] ||  isDifferent(item.completed_at_troop, plotData[index - 1]?.completed_at_troop)">
                    <strong>Trupp Abgeschlossen:</strong>
                    {{ item.completed_at_troop ? new Date(item.completed_at_troop).toLocaleDateString() : '' }}
                    {{ item.completed_at_troop ? new Date(item.completed_at_troop).toLocaleTimeString() : '' }}
                </div>
                <div class="text-caption" v-if="!plotData[index - 1] || isDifferent(item.completed_at_state, plotData[index - 1]?.completed_at_state)">
                    <strong>Landesinventurleitung abgeschlossen:</strong>
                    {{ item.completed_at_state ? new Date(item.completed_at_state).toLocaleDateString() : '' }}
                    {{ item.completed_at_state ? new Date(item.completed_at_state).toLocaleTimeString() : '' }}
                </div>
                <div class="text-caption" v-if="!plotData[index - 1] || isDifferent(item.completed_at_administration, plotData[index - 1]?.completed_at_administration)">
                    <strong>Bundesinventurleitung abgeschlossen:</strong>
                    {{ item.completed_at_administration ? new Date(item.completed_at_administration).toLocaleDateString() : '' }}
                    {{ item.completed_at_administration ? new Date(item.completed_at_administration).toLocaleTimeString() : '' }}
                </div>

                <div class="text-caption" v-if="!plotData[index - 1] || isDifferent(item.responsible_troop, plotData[index - 1]?.responsible_troop)">
                    <strong>Trupp verantwortlich:</strong>
                    {{ item.responsible_troop ? item.responsible_troop : '' }}
                </div>
                <div class="text-caption" v-if="!plotData[index - 1] || isDifferent(item.responsible_provider, plotData[index - 1]?.responsible_provider)">
                    <strong>Dienstleister verantwortlich:</strong>
                    {{ item.responsible_provider ? item.responsible_provider : '' }}
                </div>
                <div class="text-caption" v-if="!plotData[index - 1] || isDifferent(item.responsible_state, plotData[index - 1]?.responsible_state)">
                    <strong>Landesinventurleitung verantwortlich:</strong>
                    {{ item.responsible_state ? item.responsible_state : '' }}
                </div>
                <div class="text-caption" v-if="!plotData[index - 1] || isDifferent(item.responsible_administration, plotData[index - 1]?.responsible_administration)">
                    <strong>Bundesinventurleitung verantwortlich:</strong>
                    {{ item.responsible_administration ? item.responsible_administration : '' }}
                </div>
                
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