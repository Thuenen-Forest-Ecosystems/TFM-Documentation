<script setup>
    import { onMounted, ref, getCurrentInstance, watch } from 'vue'
    import { apiRecords } from './Utils';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

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
        },
        records: {
            type: Array,
            default: () => []
        },
        loading: {
            type: Boolean,
            default: false
        }
    });

    const plotsLength = ref(0);
    const clustersLength = ref(0);
    const validPlotsLength = ref(0);
    const troopNullLength = ref(0);
    const stateNullLength = ref(0);
    const providerNullLength = ref(0);

    const groupByOrganizationType = ref(null);
    const groupedStats = ref({});
    const troopStats = ref([]);

    const countUniqueTroops = ref(0);

    const organizations = ref([]);
    const troops = ref([]);

    async function updateStats(){
        plotsLength.value = data.value.length;
        // Group By cluster_id and count unique ones
        const uniqueClusters = new Set(data.value.map(item => item.cluster_id));
        clustersLength.value = uniqueClusters.size;

        validPlotsLength.value = data.value.filter(item => item.is_valid).length;

        // responsible_troop === null
        troopNullLength.value = data.value.filter(item => !item.responsible_troop).length;
        
        stateNullLength.value = data.value.filter(item => !item.responsible_state).length;
        providerNullLength.value = data.value.filter(item => !item.responsible_provider).length;

        countUniqueTroops.value = new Set(data.value.filter(item => item.responsible_troop).map(item => item.responsible_troop)).size;
        console.log('Unique Troops Count:', countUniqueTroops.value, troopNullLength.value);

        // Calculate grouped statistics
        if (groupByOrganizationType.value) {
            const grouped = {};
            
            data.value.forEach(item => {
                const key = item[groupByOrganizationType.value] || 'Nicht zugewiesen';
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(item);
            });

            // Calculate stats for each group
            groupedStats.value = Object.entries(grouped)
                .filter(([orgId]) => orgId !== 'Nicht zugewiesen') // Exclude unassigned
                .map(([orgId, records]) => {
                    const uniqueClusters = new Set(records.map(item => item.cluster_id));
                    
                    // Find organization name and description
                    const org = organizations.value.find(o => o.id === orgId);
                    const orgName = org ? org.name : orgId;
                    const orgDescription = org ? org.description : null;
                    
                    return {
                        organizationId: orgId,
                        organizationName: orgName,
                        organizationDescription: orgDescription,
                        plotsLength: records.length,
                        clustersLength: uniqueClusters.size,
                        validPlotsLength: records.filter(item => item.is_valid).length,
                        troopNullLength: records.filter(item => !item.responsible_troop).length,
                        stateNullLength: records.filter(item => !item.responsible_state).length,
                        providerNullLength: records.filter(item => !item.responsible_provider).length,
                        countUniqueTroops: new Set(records.filter(item => item.responsible_troop).map(item => item.responsible_troop)).size
                    };
                }).sort((a, b) => b.plotsLength - a.plotsLength); // Sort by plot count descending
        }

        // Calculate troop statistics
        if (troops.value.length > 0) {
            const troopGrouped = {};
            
            data.value.forEach(item => {
                const key = item.responsible_troop || 'Nicht zugewiesen';
                if (!troopGrouped[key]) {
                    troopGrouped[key] = [];
                }
                troopGrouped[key].push(item);
            });

            troopStats.value = Object.entries(troopGrouped)
                .filter(([troopId]) => troopId !== 'Nicht zugewiesen') // Exclude unassigned
                .map(([troopId, records]) => {
                    const uniqueClusters = new Set(records.map(item => item.cluster_id));
                    
                    // Find troop name
                    const troop = troops.value.find(t => t.id === troopId);
                    const troopName = troop ? troop.name : troopId;
                    const isControlTroop = troop ? troop.is_control_troop : false;
                    
                    return {
                        troopId: troopId,
                        troopName: troopName,
                        isControlTroop: isControlTroop,
                        plotsLength: records.length,
                        clustersLength: uniqueClusters.size,
                        validPlotsLength: records.filter(item => item.is_valid).length,
                        troopNullLength: records.filter(item => !item.responsible_troop).length,
                        stateNullLength: records.filter(item => !item.responsible_state).length,
                        providerNullLength: records.filter(item => !item.responsible_provider).length
                    };
                }).sort((a, b) => b.plotsLength - a.plotsLength);
        }
    }

    async function getOrganizations(){
        const { data: orgData, error } = await supabase
            .from('organizations')
            .select('id, name, description');

        if (error) {
            console.error('Error fetching organizations:', error);
            return;
        }

        return organizations.value = orgData;
    }
    async function getTroops(organization_id){
        const { data: troopData, error } = await supabase
            .from('troop')
            .select('id, name, is_control_troop, organization_id')
            //.eq('organization_id', organization_id)
            .eq('deleted', false);

        if (error) {
            console.error('Error fetching troops:', error);
            return;
        }

        return troops.value = troopData;
    }

    watch(() => props.records, (newRecords) => {
        data.value = newRecords;
        updateStats();
    }, { immediate: true, deep: true });

    onMounted(async () => {

        await getOrganizations();
        await getTroops(props.organization_id);

        if(props.organization_type === 'root'){
            groupByOrganizationType.value = 'responsible_state';
        }else if (props.organization_type === 'country'){
            groupByOrganizationType.value = 'responsible_provider';
        }


        // This is a placeholder for future functionality
        //data.value = props.records; // || await apiRecords(supabase, 'view_records_details', props.organization_id, props.organization_type)

        // print first 5 records to console
        

    });
</script>

<template>
    <v-container>
        <div v-if="props.loading">
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
                            <p class="text-caption">ohne verantwortliche Trupps</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <!--Red if > 0 else green background-->
                <v-col style="min-width: 200px;" v-if="props.organization_type === 'root'">
                    <v-card class="ma-2 text-center" :color="stateNullLength > 0 ? 'red lighten-4' : 'green lighten-4'">
                        <v-card-text>
                            <p class="text-h3">{{ stateNullLength }}</p>
                            <p class="text-caption">ohne verantwortliche Landesinventurleitung</p>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col style="min-width: 200px;" v-if="props.organization_type !== 'provider'">
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
                            <p class="text-caption">zugewiesene Trupps</p>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <!-- Grouped Statistics -->
            <v-row v-if="groupByOrganizationType && groupedStats.length > 0" class="mt-4">
                <v-col cols="12">
                    <h3 class="text-h5 mb-2">Statistiken nach {{ 
                        groupByOrganizationType === 'responsible_state' ? 'Bundesland' :
                        groupByOrganizationType === 'responsible_provider' ? 'Dienstleister' :
                        groupByOrganizationType === 'responsible_administration' ? 'Verwaltung' :
                        groupByOrganizationType === 'responsible_troop' ? 'Trupp' : 'Organisation'
                    }}</h3>
                </v-col>
                
                <v-col cols="12" v-for="group in groupedStats" :key="group.organizationId">
                    <v-card class="mb-4">
                        <v-card-title class="text-h6">
                            {{ group.organizationName }}
                        </v-card-title>
                        <v-card-subtitle v-if="group.organizationDescription">
                            {{ group.organizationDescription }}
                        </v-card-subtitle>
                        <v-card-text>
                            <v-row no-gutters>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined">
                                        <v-card-text>
                                            <p class="text-h6">{{ group.plotsLength }}</p>
                                            <p class="text-caption">Ecken</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined">
                                        <v-card-text>
                                            <p class="text-h6">{{ group.clustersLength }}</p>
                                            <p class="text-caption">Trakte</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined" :color="group.validPlotsLength == group.plotsLength ? 'green lighten-4' : 'red lighten-4'">
                                        <v-card-text>
                                            <p class="text-h6">{{ group.validPlotsLength }}</p>
                                            <p class="text-caption">valide Ecken</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined" :color="group.troopNullLength > 0 ? 'yellow lighten-4' : 'green lighten-4'">
                                        <v-card-text>
                                            <p class="text-h6">{{ group.troopNullLength }}</p>
                                            <p class="text-caption">ohne Trupps</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined">
                                        <v-card-text>
                                            <p class="text-h6">{{ group.providerNullLength }}</p>
                                            <p class="text-caption">ohne Dienstleister</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined">
                                        <v-card-text>
                                            <p class="text-h6">{{ group.countUniqueTroops }}</p>
                                            <p class="text-caption">Trupps</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <!-- Troop Statistics -->
            <v-row v-if="troopStats.length > 0" class="mt-4">
                <v-col cols="12">
                    <h3 class="text-h5 mb-2">Statistiken nach Trupps</h3>
                </v-col>
                
                <v-col cols="12" v-for="troop in troopStats" :key="troop.troopId">
                    <v-card class="mb-4">
                        <v-card-title class="text-h6">
                            {{ troop.troopName }}
                        </v-card-title>
                        <v-card-subtitle>
                            {{ troop.isControlTroop ? 'Kontroll-Trupp' : 'Aufnahme-Trupp' }}
                        </v-card-subtitle>
                        <v-card-text>
                            <v-row no-gutters>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined">
                                        <v-card-text>
                                            <p class="text-h6">{{ troop.plotsLength }}</p>
                                            <p class="text-caption">Ecken</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined">
                                        <v-card-text>
                                            <p class="text-h6">{{ troop.clustersLength }}</p>
                                            <p class="text-caption">Trakte</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                                <v-col style="min-width: 150px;">
                                    <v-card class="ma-1 text-center" variant="outlined" :color="troop.validPlotsLength == troop.plotsLength ? 'green lighten-4' : 'red lighten-4'">
                                        <v-card-text>
                                            <p class="text-h6">{{ troop.validPlotsLength }}</p>
                                            <p class="text-caption">valide Ecken</p>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </div>
    </v-container>
</template>