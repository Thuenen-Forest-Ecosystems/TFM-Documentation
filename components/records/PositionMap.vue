<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue';

    const props = defineProps({
        record: {
            type: Object,
            required: true
        }
    });

    const mapContainer = ref(null);
    let map = null;

    const position = computed(() => props.record?.properties?.position);

    const positionMedian = computed(() => {
        const p = position.value?.position_median;
        if (p?.coordinates && p.coordinates.length === 2) return p.coordinates;
        if (p?.longitude != null && p?.latitude != null) return [p.longitude, p.latitude];
        return null;
    });

    const positionMean = computed(() => {
        const p = position.value?.position_mean;
        if (p?.coordinates && p.coordinates.length === 2) return p.coordinates;
        if (p?.longitude != null && p?.latitude != null) return [p.longitude, p.latitude];
        return null;
    });

    const plotCoordinates = computed(() => {
        const c = props.record?.properties?.plot_coordinates?.center_location;
        if (c?.coordinates && c.coordinates.length === 2) return c.coordinates;
        return null;
    });

    const mapCenter = computed(() => positionMedian.value || positionMean.value || plotCoordinates.value);

    const hasPosition = computed(() => !!mapCenter.value);

    const hdop = computed(() => position.value?.hdop_mean);
    const pdop = computed(() => position.value?.pdop_mean);
    const satellites = computed(() => position.value?.satellites_count_mean);
    const measurementCount = computed(() => position.value?.measurement_count);
    const totalRecordedCount = computed(() => position.value?.total_recorded_count);
    const device = computed(() => position.value?.device_gnss);
    const quality = computed(() => position.value?.quality);
    const overallQuality = computed(() => position.value?.overall_quality);
    const meanAccuracy = computed(() => position.value?.mean_accuracy);
    const rtcmAge = computed(() => position.value?.rtcm_age);
    const detailedQuality = computed(() => position.value?.detailed_quality);
    const startMeasurement = computed(() => position.value?.start_measurement);
    const stopMeasurement = computed(() => position.value?.stop_measurement);

    function formatTime(iso) {
        if (!iso) return null;
        return new Date(iso).toLocaleString();
    }

    const style = {
        version: 8,
        sources: {
            osm: {
                type: 'raster',
                tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap Contributors',
                maxzoom: 19
            }
        },
        layers: [
            { id: 'osm', type: 'raster', source: 'osm' }
        ]
    };

    function initMap() {
        if (!mapContainer.value || !mapCenter.value) return;

        map = new maplibregl.Map({
            container: mapContainer.value,
            style,
            center: mapCenter.value,
            zoom: 17
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
            map.resize();
            addMarkers();
        });
    }

    function addMarkers() {
        if (!map) return;

        // Median position marker (primary - blue)
        if (positionMedian.value) {
            new maplibregl.Marker({ color: '#1565C0' })
                .setLngLat(positionMedian.value)
                .setPopup(new maplibregl.Popup().setHTML('<strong>Median</strong><br>Position (Median der Messungen)'))
                .addTo(map);
        }

        // Mean position marker (orange)
        if (positionMean.value) {
            new maplibregl.Marker({ color: '#EF6C00' })
                .setLngLat(positionMean.value)
                .setPopup(new maplibregl.Popup().setHTML('<strong>Mittel</strong><br>Position (Mittelwert der Messungen)'))
                .addTo(map);
        }

        // Plot coordinate marker (planned position - green)
        if (plotCoordinates.value) {
            new maplibregl.Marker({ color: '#2E7D32' })
                .setLngLat(plotCoordinates.value)
                .setPopup(new maplibregl.Popup().setHTML('<strong>Soll-Position</strong><br>Geplante Koordinaten der Traktecke'))
                .addTo(map);
        }

        // Fit bounds if multiple points exist
        const points = [positionMedian.value, positionMean.value, plotCoordinates.value].filter(Boolean);
        if (points.length > 1) {
            const bounds = new maplibregl.LngLatBounds();
            points.forEach(p => bounds.extend(p));
            map.fitBounds(bounds, { padding: 80, maxZoom: 18 });
        }
    }

    onMounted(async () => {
        if (hasPosition.value) {
            await nextTick();
            initMap();
        }
    });

    watch(() => props.record?.id, async () => {
        if (map) {
            map.remove();
            map = null;
        }
        if (hasPosition.value) {
            await nextTick();
            setTimeout(() => initMap(), 50);
        }
    });

    onBeforeUnmount(() => {
        if (map) {
            map.remove();
            map = null;
        }
    });
</script>

<template>
    <v-card variant="tonal" class="ma-3">
        <v-toolbar color="transparent">
            <v-toolbar-title>Gemessene Position</v-toolbar-title>
        </v-toolbar>
        <v-card-text v-if="!hasPosition">
            <v-alert type="info" density="compact" variant="tonal">
                Keine Positionsdaten vorhanden.
            </v-alert>
        </v-card-text>
        <template v-else>
            <v-row no-gutters>
                <v-col cols="12" md="8">
                    <div ref="mapContainer" class="position-map"></div>
                </v-col>
                <v-col cols="12" md="4">
                    <v-card-text>
                        <div class="d-flex flex-wrap ga-4">
                            <div class="d-flex align-center ga-2" v-if="positionMedian">
                                <v-icon color="blue-darken-3" size="small">mdi-map-marker</v-icon>
                                <span class="text-caption">Median</span>
                            </div>
                            <div class="d-flex align-center ga-2" v-if="positionMean">
                                <v-icon color="orange-darken-3" size="small">mdi-map-marker</v-icon>
                                <span class="text-caption">Mittel</span>
                            </div>
                            <div class="d-flex align-center ga-2" v-if="plotCoordinates">
                                <v-icon color="green-darken-3" size="small">mdi-map-marker</v-icon>
                                <span class="text-caption">Soll-Position</span>
                            </div>
                        </div>

                        <v-table density="compact" class="mt-2">
                            <tbody>
                                <tr v-if="meanAccuracy != null">
                                    <td class="text-caption font-weight-medium">Mittl. Genauigkeit</td>
                                    <td class="text-caption">{{ meanAccuracy.toFixed(1) }} cm</td>
                                </tr>
                                <tr v-if="hdop != null">
                                    <td class="text-caption font-weight-medium">HDOP</td>
                                    <td class="text-caption">{{ hdop.toFixed(2) }}</td>
                                </tr>
                                <tr v-if="pdop != null">
                                    <td class="text-caption font-weight-medium">PDOP</td>
                                    <td class="text-caption">{{ pdop.toFixed(2) }}</td>
                                </tr>
                                <tr v-if="satellites != null">
                                    <td class="text-caption font-weight-medium">Satelliten (Ø)</td>
                                    <td class="text-caption">{{ satellites }}</td>
                                </tr>
                                <tr v-if="measurementCount != null">
                                    <td class="text-caption font-weight-medium">Messungen</td>
                                    <td class="text-caption">
                                        {{ measurementCount }}
                                        <span v-if="totalRecordedCount != null && totalRecordedCount !== measurementCount" class="text-medium-emphasis"> / {{ totalRecordedCount }}</span>
                                    </td>
                                </tr>
                                <tr v-if="rtcmAge != null">
                                    <td class="text-caption font-weight-medium">RTCM-Alter</td>
                                    <td class="text-caption">{{ rtcmAge }}</td>
                                </tr>
                                <tr v-if="startMeasurement">
                                    <td class="text-caption font-weight-medium">Messbeginn</td>
                                    <td class="text-caption">{{ formatTime(startMeasurement) }}</td>
                                </tr>
                                <tr v-if="stopMeasurement">
                                    <td class="text-caption font-weight-medium">Messende</td>
                                    <td class="text-caption">{{ formatTime(stopMeasurement) }}</td>
                                </tr>
                                <tr v-if="device">
                                    <td class="text-caption font-weight-medium">GNSS-Gerät</td>
                                    <td class="text-caption">{{ device }}</td>
                                </tr>
                                <tr v-if="quality != null">
                                    <td class="text-caption font-weight-medium">Qualitätscode</td>
                                    <td class="text-caption">{{ quality }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-card-text>
                </v-col>
            </v-row>
        </template>
    </v-card>
</template>

<style scoped>
    .position-map {
        width: 100%;
        height: 350px;
        min-height: 250px;
    }

    :deep(.maplibregl-popup-content) {
        color: #333;
        background: #fff;
    }

    :deep(.maplibregl-popup-tip) {
        border-top-color: #fff;
        border-bottom-color: #fff;
    }
</style>
