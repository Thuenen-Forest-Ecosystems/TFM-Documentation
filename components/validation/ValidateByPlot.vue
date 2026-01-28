<script setup>
    import { onMounted, ref, watch, getCurrentInstance } from 'vue';
    import localize from 'ajv-i18n';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const validationErrors = ref([]);
    const plausibilityErrors = ref([]);
    const isValid = ref(null);
    const isValidating = ref(false);

    const props = defineProps({
        record: { // is properties
            type: Object,
            required: true
        },
        validate: {
            type: Function,
            required: true
        },
        tfm: {
            type: Object,
            required: true
        }
    });
    /*async function validationOnline(){
        console.log(props.record)
        const { data, error } = await supabase.functions.invoke('validation', {
            body: JSON.stringify({ cluster: { plot: [
                props.record.previous_properties
            ] } })
        })

        if (error) {
            console.error('Error during online validation:', error);
            return;
        }

        console.log('Online validation result:', data);
    }*/
    async function validation(){
        if (!props.record || !props.validate || !props.tfm) return;

        validationErrors.value = [];

        isValidating.value = true;
        isValid.value = props.validate(props.record.properties);
        validationErrors.value = props.validate.errors ? [...props.validate.errors] : [];
        localize.de(validationErrors.value);

        try {
            
            const current = {"ffh":0,"tree":[],"coast":false,"sandy":null,"biotope":null,"histwald":false,"land_use":null,"plot_name":3,"biosphaere":0,"natur_park":106,"cluster_name":9999904,"terrain_form":null,"accessibility":1,"federal_state":12,"forest_office":12008,"forest_status":5,"interval_name":"bwi2022","marker_status":null,"national_park":0,"property_type":null,"terrain_slope":null,"marker_azimuth":0,"marker_profile":null,"elevation_level":null,"ffh_forest_type":null,"growth_district":1019,"marker_distance":0,"forest_community":1,"sampling_stratum":1216,"terrain_exposure":null,"natur_schutzgebiet":0,"vogel_schutzgebiet":0,"property_size_class":null,"protected_landscape":true,"forest_community_field":null,"biogeographische_region":2,"harvest_restriction_wetness":null,"harvest_restriction_low_yield":null,"harvest_restriction_scattered":null,"harvest_restriction_fragmented":null,"harvest_restriction_nature_reserve":null,"harvest_restriction_protection_forest":null,"harvest_restriction_insufficient_access":null,"harvest_restriction_other_internalcause":null,"harvest_restriction_recreational_forest":null,"harvest_restriction_private_conservation":null,"edges":[],"structure_lt4m":[],"structure_gt4m":[],"regeneration":[],"deadwood":[],"position":{"ffh":0,"tree":[],"coast":false,"sandy":null,"biotope":null,"histwald":false,"land_use":null,"plot_name":3,"biosphaere":0,"natur_park":106,"cluster_name":9999904,"terrain_form":null,"accessibility":1,"federal_state":12,"forest_office":12008,"forest_status":5,"interval_name":"bwi2022","marker_status":null,"national_park":0,"property_type":null,"terrain_slope":null,"marker_azimuth":0,"marker_profile":null,"elevation_level":null,"ffh_forest_type":null,"growth_district":1019,"marker_distance":0,"forest_community":1,"sampling_stratum":1216,"terrain_exposure":null,"natur_schutzgebiet":0,"vogel_schutzgebiet":0,"property_size_class":null,"protected_landscape":true,"forest_community_field":null,"biogeographische_region":2,"harvest_restriction_wetness":null,"harvest_restriction_low_yield":null,"harvest_restriction_scattered":null,"harvest_restriction_fragmented":null,"harvest_restriction_nature_reserve":null,"harvest_restriction_protection_forest":null,"harvest_restriction_insufficient_access":null,"harvest_restriction_other_internalcause":null,"harvest_restriction_recreational_forest":null,"harvest_restriction_private_conservation":null,"edges":[],"structure_lt4m":[],"structure_gt4m":[],"regeneration":[],"deadwood":[],"position":{"rtcm_age":null,"quality":3,"satellites_count_mean":null,"pdop_mean":null,"hdop_mean":null,"position_mean":{"latitude":52.82535352199999,"longitude":13.810317594000004},"position_median":{"latitude":52.8253514,"longitude":13.8103179},"measurement_count":100,"start_measurement":"2025-12-03T18:20:44.058404","stop_measurement":"2025-12-03T18:22:23.410886","mean_accuracy":7.063550004959106}}};
            const pref = {"id":"2b84fea0-5d9f-4aa6-b212-794e7f69c9dd","ffh":0,"tree":[],"coast":false,"edges":[],"sandy":null,"intkey":"-9999904-1-_bwi2022","biotope":null,"deadwood":[],"histwald":false,"land_use":null,"position":{},"plot_name":1,"stand_age":null,"biosphaere":0,"cluster_id":"1413bc27-4c40-40d5-8caf-1c416b6ac0af","natur_park":106,"cluster_name":9999904,"regeneration":[],"terrain_form":null,"accessibility":1,"federal_state":12,"forest_office":12008,"forest_status":5,"interval_name":"bwi2022","marker_status":null,"national_park":0,"plot_landmark":[],"property_type":null,"terrain_slope":null,"harvest_method":0,"harvest_reason":null,"marker_azimuth":0,"marker_profile":null,"structure_gt4m":[],"structure_lt4m":[],"elevation_level":null,"ffh_forest_type":null,"growth_district":1019,"management_type":null,"marker_distance":0,"stand_structure":null,"acquisition_date":null,"forest_community":1,"plot_coordinates":{"id":"5b39f839-7a79-4057-ac8c-4baeb6a921d4","plot_id":"2b84fea0-5d9f-4aa6-b212-794e7f69c9dd","cartesian_x":4877683.20896972,"cartesian_y":1914904.18755294,"center_location":{"crs":{"type":"name","properties":{"name":"EPSG:4326"}},"type":"Point","coordinates":[13.81298513,52.82418664]}},"sampling_stratum":1216,"terrain_exposure":null,"harvest_condition":null,"fence_regeneration":null,"natur_schutzgebiet":0,"vogel_schutzgebiet":0,"harvest_restriction":null,"property_size_class":null,"protected_landscape":true,"ffh_forest_type_field":null,"forest_community_field":null,"biogeographische_region":2,"stand_development_phase":null,"trees_less_4meter_layer":null,"stand_layer_regeneration":null,"trees_less_4meter_coverage":null,"harvest_restriction_wetness":null,"harvest_restriction_low_yield":null,"harvest_restriction_scattered":null,"trees_greater_4meter_mirrored":null,"harvest_restriction_fragmented":null,"harvest_restriction_nature_reserve":null,"harvest_restriction_protection_forest":null,"trees_greater_4meter_basal_area_factor":null,"harvest_restriction_insufficient_access":null,"harvest_restriction_other_internalcause":null,"harvest_restriction_recreational_forest":null,"harvest_restriction_private_conservation":null};
            plausibilityErrors.value = await props.tfm.runPlots([current], null, [pref]);

            console.log('props.tfm.runPlots# called with:', plausibilityErrors);
            console.log(props.record.properties);
            console.log(current);

            console.log(props.record.previous_properties);
            console.log(pref);

            plausibilityErrors.value = await props.tfm.runPlots([props.record.properties], null, [props.record.previous_properties]);
        } catch (error) {
            console.warn('Error during online validation call:', error);
        } finally {
            isValidating.value = false;
        }
        console.log('Validation finished. isValid:', isValid.value, 'Validation Errors:', validationErrors.value, 'Plausibility Errors:', plausibilityErrors.value);
    }

    /*watch([props.record, props.validate, props.tfm], (newRecord, newValidate, newTfm) => {
        validation();
    });*/

    watch(() => [props.record, props.validate, props.tfm], (newVals) => {
            validation(); // Call your validation logic or any other function
        },
        { deep: true } // Enables deep watching for nested properties
    );

    onMounted(() => {
        validation();
    });

</script>

<template>
    <v-expansion-panels v-if="!isValidating">
        <v-expansion-panel :disabled="validationErrors.length == 0">
            <v-expansion-panel-title>Fehler Validierung ({{ validationErrors.length }})</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-list lines="two">
                    <v-list-item v-for="(error, index) in validationErrors" :key="index">
                        <v-list-item-title class="text-wrap">{{ error.message }}</v-list-item-title>
                        <v-list-item-subtitle>Schema Path: {{ error.schemaPath }}</v-list-item-subtitle>
                        <template v-slot:append>
                            <v-btn
                                color="grey-lighten-1"
                                icon="mdi-information"
                                variant="text"
                            ></v-btn>
                        </template>
                    </v-list-item>
                </v-list>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel :disabled="plausibilityErrors.length == 0">
            <v-expansion-panel-title>Fehler Plausibilität ({{ plausibilityErrors.length }})</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-list lines="two">
                    <v-list-item v-for="(error, index) in plausibilityErrors" :key="index">
                        <template v-slot:prepend>
                            <v-tooltip :text="error.error.type === 'error' ? `Fehler: ${error.error.code}` : `Warnung: ${error.error.code}`">
                                <template v-slot:activator="{ props }">
                                    <v-icon v-bind="props" :icon="error.error.type === 'error' ? 'mdi-alert-octagon' : 'mdi-alert-circle'" :color="error.error.type === 'error' ? 'red' : 'orange'"></v-icon>
                                </template>
                            </v-tooltip>
                        </template>
                        <v-list-item-title class="text-wrap">{{ error.error.note }}</v-list-item-title>
                        <v-list-item-subtitle>{{ error.error.text }}</v-list-item-subtitle>
                        <template v-slot:append>
                            <v-btn
                                color="grey-lighten-1"
                                icon="mdi-information"
                                variant="text"
                            ></v-btn>
                        </template>
                    </v-list-item>
                </v-list>
            </v-expansion-panel-text>
        </v-expansion-panel>
    </v-expansion-panels>
    <v-progress-circular
        v-else
        indeterminate
        color="primary"
        class="ma-4"
    ></v-progress-circular>
</template>