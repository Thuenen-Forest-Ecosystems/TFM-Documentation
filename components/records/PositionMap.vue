<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';

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
        return null;
    });

    const positionMean = computed(() => {
        const p = position.value?.position_mean;
        if (p?.coordinates && p.coordinates.length === 2) return p.coordinates;
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
    const device = computed(() => position.value?.device_gnss);
    const quality = computed(() => position.value?.quality);

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

    onMounted(() => {
        if (hasPosition.value) {
            initMap();
        }
    });

    watch(() => props.record?.id, () => {
        if (map) {
            map.remove();
            map = null;
        }
        if (hasPosition.value) {
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
            <div ref="mapContainer" class="position-map"></div>

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
                        <tr v-if="hdop != null">
                            <td class="text-caption font-weight-medium">HDOP</td>
                            <td class="text-caption">{{ hdop }}</td>
                        </tr>
                        <tr v-if="pdop != null">
                            <td class="text-caption font-weight-medium">PDOP</td>
                            <td class="text-caption">{{ pdop }}</td>
                        </tr>
                        <tr v-if="satellites != null">
                            <td class="text-caption font-weight-medium">Satelliten</td>
                            <td class="text-caption">{{ satellites }}</td>
                        </tr>
                        <tr v-if="measurementCount != null">
                            <td class="text-caption font-weight-medium">Messungen</td>
                            <td class="text-caption">{{ measurementCount }}</td>
                        </tr>
                        <tr v-if="device">
                            <td class="text-caption font-weight-medium">GNSS-Gerät</td>
                            <td class="text-caption">{{ device }}</td>
                        </tr>
                        <tr v-if="quality != null">
                            <td class="text-caption font-weight-medium">Qualität</td>
                            <td class="text-caption">{{ quality }}</td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
        </template>
    </v-card>
</template>

<style scoped>
    .position-map {
        width: 100%;
        height: 350px;
    }
</style>
