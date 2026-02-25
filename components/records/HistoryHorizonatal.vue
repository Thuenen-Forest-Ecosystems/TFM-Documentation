<script setup>
    import { onMounted, ref, watch, computed, getCurrentInstance } from 'vue';
    import { getOrganizationById, getTroopById, workflowFromRecord } from '../Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;


    const props = defineProps({
        plot_id: {
            type: String,
            required: true
        },
        selected: {
            type: Object,
            required: false,
            default: null
        }
    });

    const latestPlot = ref(null);
    let plotData = ref([]);
    const activeItem = ref(null);

    const loading = ref(false);

    const emit = defineEmits(['select:record', 'update:record']);

    const restoreItem = ref(null);
    const showConfirmDialog = ref(false);
    const restoring = ref(false);
    const restoreError = ref(null);

    // Whether the currently active item is a historical snapshot
    const isHistorical = computed(() => {
        return activeItem.value && latestPlot.value && activeItem.value !== latestPlot.value;
    });

    function goToLatest() {
        if (latestPlot.value) {
            emitActiveItem(latestPlot.value);
        }
    }


    function sortPlotData() {
        plotData.value.sort((a, b) => a.sortByDate - b.sortByDate);
    }

    const userProfileCache = new Map();

    async function getUserProfile(userId) {
        if (!userId) return null;
        if (userProfileCache.has(userId)) return userProfileCache.get(userId);
        const { data, error } = await supabase
            .from('users_profile')
            .select('id, email, user_name')
            .eq('id', userId)
            .single();
        if (error) {
            console.error('Error fetching user profile:', error);
            userProfileCache.set(userId, null);
            return null;
        }
        userProfileCache.set(userId, data);
        return data;
    }

    const addAsyncDataToItems = async (items) => {
        return await Promise.all(items.map(async (item) => {
            if (item.responsible_troop) {
                item.troopData = await getTroopById(supabase, item.responsible_troop);
            }

            if (item.responsible_provider) {
                item.providerData = await getOrganizationById(supabase, item.responsible_provider);
            }
            if (item.responsible_state) {
                item.stateData = await getOrganizationById(supabase, item.responsible_state);
            }
            if (item.responsible_administration) {
                item.administrationData = await getOrganizationById(supabase, item.responsible_administration);
            }
            if (item.updated_by) {
                item.updatedByProfile = await getUserProfile(item.updated_by);
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
            // acvtivate selected item
            if (props.selected && props.selected.id) {
                const foundItem = plotData.value.find(item => item.id === props.selected.id);
                if (foundItem) {
                    emitActiveItem(foundItem);
                    return;
                }
            } 
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
        //await getLatest(newPlotId);
        loading.value = false;
    });

    function formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    function isDifferent(item1, item2) {
        return JSON.stringify(item1) !== JSON.stringify(item2);
    }

    function emitActiveItem(item) {
        activeItem.value = item;
        console.log('EMIT', item, props.plot_id);
        emit('select:record', item);
    }

    function confirmRestore(item) {
        restoreItem.value = item;
        restoreError.value = null;
        showConfirmDialog.value = true;
    }

    async function executeRestore() {
        if (!restoreItem.value || !latestPlot.value) return;

        restoring.value = true;
        restoreError.value = null;

        const item = restoreItem.value;
        const { data, error } = await supabase
            .from('records')
            .update({
                properties: item.properties,
                completed_at_troop: item.completed_at_troop,
                completed_at_state: item.completed_at_state,
                completed_at_administration: item.completed_at_administration,
                responsible_administration: item.responsible_administration,
                responsible_state: item.responsible_state,
                responsible_provider: item.responsible_provider,
                responsible_troop: item.responsible_troop,
            })
            .eq('plot_id', latestPlot.value.plot_id)
            .select()
            .single();

        restoring.value = false;

        if (error) {
            console.error('Error restoring record:', error);
            restoreError.value = error.message || 'Fehler beim Zurücksetzen';
            return;
        }

        showConfirmDialog.value = false;

        // Refresh the history list
        plotData.value = [];
        latestPlot.value = null;
        loading.value = true;
        await getLatest(props.plot_id);
        loading.value = false;

        // Emit the updated record to parent
        emit('update:record', data);
    }

</script>



<template>
    <v-list v-bind="$attrs" class="pa-0">
        <v-progress-linear v-if="loading" indeterminate color="primary" />

        <v-list-item
            v-for="(item, index) in plotData"
            :key="index"
            :active="activeItem === item"
            @click="emitActiveItem(item)"
            class="history-list-item"
            :border="true"
        >
            <template v-slot:prepend>
                <v-icon
                    :icon="item === latestPlot ? 'mdi-star' : 'mdi-history'"
                    size="small"
                    class="me-2"
                />
            </template>

            <!-- 25.02.2026 17:33 -->

            <v-list-item-title class="d-flex align-center ga-2 flex-wrap">
                <span>{{ formatDate(item.sortByDate) }}</span>
                <v-chip size="x-small" variant="outlined" v-if="item === latestPlot">aktuell</v-chip>
                <v-chip v-if="item.updatedByProfile" size="x-small" variant="tonal" prepend-icon="mdi-pencil">
                    {{ item.updatedByProfile.user_name || item.updatedByProfile.email }}
                </v-chip>
                <v-chip v-else-if="item.updated_by" size="x-small" variant="tonal" prepend-icon="mdi-pencil" class="text-disabled">
                    {{ item.updated_by.substring(0, 8) }}…
                </v-chip>
            </v-list-item-title>

            <v-list-item-subtitle class="d-flex align-center ga-2 flex-wrap mt-1">
                <v-chip size="x-small" label>
                    {{ workflowFromRecord(item).title }}
                </v-chip>
                <span v-if="item.troopData" class="text-caption">
                    {{ item.troopData.name || 'no name' }}
                    ({{ item.troopData.is_control_troop ? 'KT' : 'AT' }})
                </span>
                <span v-if="item.providerData" class="text-caption">
                    {{ item.providerData.name }}
                </span>
                <span v-if="item.stateData" class="text-caption">
                    {{ item.stateData.name }}
                </span>
            </v-list-item-subtitle>

            <template v-slot:append>
                <div class="d-flex align-center ga-2">
                    <!--<v-btn
                        v-if="item !== latestPlot"
                        size="small"
                        variant="tonal"
                        color="warning"
                        prepend-icon="mdi-restore"
                        @click.stop="confirmRestore(item)"
                    >
                        Zurücksetzen
                    </v-btn>-->
                    <v-chip v-if="activeItem === item" color="primary" size="small" variant="elevated">
                        <v-icon start icon="mdi-check" /> Ausgewählt
                    </v-chip>
                </div>
            </template>
        </v-list-item>

        <v-list-item v-if="latestPlot" disabled class="text-caption">
            <template v-slot:prepend>
                <v-icon icon="mdi-creation" size="small" class="me-2" />
            </template>
            <v-list-item-title class="text-caption">
                Erstellt am {{ formatDate(latestPlot.created_at) }}
            </v-list-item-title>
        </v-list-item>
    </v-list>

    <!-- Historical data bottom sheet (teleported to body so it's visible when dialog is closed) -->
    <Teleport to="body">
        <v-slide-y-reverse-transition>
            <v-sheet
                v-if="isHistorical"
                class="history-bottom-sheet"
                color="warning"
                elevation="8"
            >
                <div class="d-flex align-center justify-space-between flex-wrap ga-2 pa-3">
                    <div class="d-flex align-center ga-2">
                        <v-icon icon="mdi-history" />
                        <div>
                            <div class="font-weight-medium">Historischer Datensatz</div>
                            <div class="text-caption">
                                Stand vom {{ formatDate(activeItem.sortByDate || activeItem.created_at) }}
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-center ga-2">
                        <v-btn
                            variant="outlined"
                            size="small"
                            prepend-icon="mdi-restore"
                            rounded="xl"
                            @click="confirmRestore(activeItem)"
                        >
                            Zurücksetzen
                        </v-btn>
                        <v-btn
                            variant="outlined"
                            size="small"
                            rounded="xl"
                            @click="goToLatest"
                        >
                            Aktuellen Status anzeigen
                        </v-btn>
                    </div>
                </div>
            </v-sheet>
        </v-slide-y-reverse-transition>
    </Teleport>

    <!-- Restore Confirmation Dialog -->
    <v-dialog v-model="showConfirmDialog" max-width="500" persistent>
        <v-card>
            <v-card-title>Zurücksetzen bestätigen</v-card-title>
            <v-card-text>
                <p>Soll der aktuelle Datensatz mit dem Stand vom
                    <strong>{{ restoreItem ? formatDate(restoreItem.sortByDate) : '' }}</strong>
                    überschrieben werden?
                </p>
                <p class="text-caption mt-2">Diese Aktion erstellt automatisch einen neuen Eintrag in der Historie.</p>
                <v-alert v-if="restoreError" type="error" density="compact" class="mt-3">{{ restoreError }}</v-alert>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="showConfirmDialog = false" :disabled="restoring">Abbrechen</v-btn>
                <v-btn color="warning" variant="flat" @click="executeRestore" :loading="restoring" prepend-icon="mdi-restore">Zurücksetzen</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
    .history-list-item {
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
</style>

<style>
    .history-bottom-sheet {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 2501;
    }
</style>