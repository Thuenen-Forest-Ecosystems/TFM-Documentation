<script setup>
    import { onMounted, ref, getCurrentInstance } from 'vue'
import { apiRecords } from './Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const loading = ref(false);
    const data = ref([]);

    const props = defineProps({
        organization_id: {
            type: String,
            required: true
        },
        organization_type: {
            type: String,
            required: false,
            default: null
        }
    });

    const plotsLength = ref(0);
    const clustersLength = ref(0);
    const validPlotsLength = ref(0);
    const troopNullLength = ref(0);
    const stateNullLength = ref(0);
    const providerNullLength = ref(0);

    const countUniqueTroops = ref(0);

    onMounted(async () => {
        loading.value = true;
        // This is a placeholder for future functionality
        data.value = await apiRecords(supabase, 'view_records_details', props.organization_id, props.organization_type)

        plotsLength.value = data.value.length;
        // Group By cluster_id and count unique ones
        const uniqueClusters = new Set(data.value.map(item => item.cluster_id));
        clustersLength.value = uniqueClusters.size;

        validPlotsLength.value = data.value.filter(item => item.is_valid).length;

        // responsible_troop === null
        troopNullLength.value = data.value.filter(item => !item.responsible_troop).length;
        
        stateNullLength.value = data.value.filter(item => !item.responsible_state).length;
        providerNullLength.value = data.value.filter(item => !item.responsible_provider).length;

        countUniqueTroops.value = new Set(data.value.map(item => item.responsible_troop)).size;

        
        loading.value = false;
    });
</script>

<template>
    <v-container>
        <div v-if="loading">
            <v-row>
                <v-col style="min-width: 200px;" v-for="i in [1,2,3,4,5,6,7]"><!--8 placeholders-->
                    <v-skeleton-loader  type="article" />
                </v-col>
            </v-row>
        </div>
        <div v-else>
            <v-row no-gutters>
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center">
                        <v-card-text>
                            <p class="text-h3">{{ plotsLength }}</p>
                            <p class="text-caption">Ecken</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center">
                        <v-card-text>
                            <p class="text-h3">{{ clustersLength }}</p>
                            <p class="text-caption">Trakte</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center" :color="validPlotsLength == plotsLength ? 'green lighten-4' : 'red lighten-4'">
                        <v-card-text>
                            <p class="text-h3">{{ validPlotsLength }}</p>
                            <p class="text-caption">valide Ecken</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center" :color="troopNullLength > 0 ? 'yellow lighten-4' : 'green lighten-4'">
                        <v-card-text>
                            <p class="text-h3">{{ troopNullLength }}</p>
                            <p class="text-caption">ohne verantwortliche Truppe</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <!--Red if > 0 else green background-->
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center" :color="stateNullLength > 0 ? 'red lighten-4' : 'green lighten-4'">
                        <v-card-text>
                            <p class="text-h3">{{ stateNullLength }}</p>
                            <p class="text-caption">ohne verantwortliche Landesinventurleitung</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center">
                        <v-card-text>
                            <p class="text-h3">{{ providerNullLength }}</p>
                            <p class="text-caption">ohne verantwortlichen Dienstleister</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col style="min-width: 200px;">
                    <v-card class="ma-2 text-center">
                        <v-card-text>
                            <p class="text-h3">{{ countUniqueTroops }}</p>
                            <p class="text-caption">Trupps beschäftigt</p>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </div>
    </v-container>
</template>