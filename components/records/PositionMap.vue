<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue';

    const props = defineProps({
        record: {
            type: Object,
            required: true
        },
        records: {
            type: Array,
            required: false,
            default: () => []
        }
    });

    const mapContainer = ref(null);
    let map = null;
    const OTHER_RECORDS_SOURCE_ID = 'other-records-source';
    const OTHER_RECORDS_LAYER_ID = 'other-records-layer';
    const HISTORICAL_POSITIONS_SOURCE_ID = 'historical-positions-source';
    const HISTORICAL_POSITIONS_LAYER_ID = 'historical-positions-layer';

    const HISTORICAL_INTERVAL_COLORS = {
        bwi2012: '#8E24AA',
        bwi2022: '#FB8C00',
        bwi2002: '#43A047',
        bwi1987: '#6D4C41'
    };

    const FALLBACK_HISTORICAL_COLORS = ['#00897B', '#1E88E5', '#E53935', '#3949AB', '#6D4C41'];
    const selectedHistoricalIntervals = ref([]);
    const historicalSelectionInitialized = ref(false);

    const position = computed(() => props.record?.properties?.position);

    function normalizeCoordinates(value) {
        if (!value) return null;
        if (value.coordinates && value.coordinates.length === 2) return value.coordinates;
        if (value.longitude != null && value.latitude != null) return [value.longitude, value.latitude];
        return null;
    }

    function toFiniteNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    function coordinatesFromLatitudeLongitude(latitude, longitude) {
        const lat = toFiniteNumber(latitude);
        const lng = toFiniteNumber(longitude);
        if (lat == null || lng == null) return null;
        return [lng, lat];
    }

    function readPreviousPositionData(record) {
        const rawValue = record?.previous_position_data
            ?? record?.previousPositionData
            ?? record?.properties?.previous_position_data
            ?? null;

        if (!rawValue) return {};

        if (typeof rawValue === 'string') {
            try {
                const parsed = JSON.parse(rawValue);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (error) {
                console.warn('Could not parse previous_position_data as JSON', error);
                return {};
            }
        }

        return typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
    }

    function getHistoricalIntervalColor(intervalKey, index) {
        return HISTORICAL_INTERVAL_COLORS[intervalKey]
            || FALLBACK_HISTORICAL_COLORS[index % FALLBACK_HISTORICAL_COLORS.length];
    }

    function formatIntervalLabel(intervalKey) {
        return String(intervalKey || '').toUpperCase();
    }

    function getRecordPositionMedian(record) {
        return normalizeCoordinates(record?.properties?.position?.position_median);
    }

    function getRecordPositionMean(record) {
        return normalizeCoordinates(record?.properties?.position?.position_mean);
    }

    function getRecordPlotCoordinates(record) {
        return normalizeCoordinates(record?.properties?.plot_coordinates?.center_location);
    }

    function getRecordMapCenter(record) {
        return getRecordPositionMedian(record) || getRecordPositionMean(record) || getRecordPlotCoordinates(record);
    }

    const positionMedian = computed(() => {
        return getRecordPositionMedian(props.record);
    });

    const positionMean = computed(() => {
        return getRecordPositionMean(props.record);
    });

    const plotCoordinates = computed(() => {
        return getRecordPlotCoordinates(props.record);
    });

    const previousPositionData = computed(() => {
        return readPreviousPositionData(props.record);
    });

    const historicalPositionSeries = computed(() => {
        return Object.entries(previousPositionData.value)
            .filter(([_, intervalData]) => intervalData && typeof intervalData === 'object')
            .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
            .map(([intervalKey, intervalData], index) => {
                const color = getHistoricalIntervalColor(intervalKey, index);
                const median = coordinatesFromLatitudeLongitude(
                    intervalData.latitude_median,
                    intervalData.longitude_median
                );
                const mean = coordinatesFromLatitudeLongitude(
                    intervalData.latitude_mean,
                    intervalData.longitude_mean
                );

                const points = [
                    median
                        ? {
                            id: `${intervalKey}-median`,
                            intervalKey,
                            intervalLabel: formatIntervalLabel(intervalKey),
                            pointType: 'median',
                            pointLabel: 'Median',
                            center: median,
                            color
                        }
                        : null,
                    mean
                        ? {
                            id: `${intervalKey}-mean`,
                            intervalKey,
                            intervalLabel: formatIntervalLabel(intervalKey),
                            pointType: 'mean',
                            pointLabel: 'Mittel',
                            center: mean,
                            color
                        }
                        : null
                ].filter(Boolean);

                return {
                    key: intervalKey,
                    label: formatIntervalLabel(intervalKey),
                    color,
                    points
                };
            })
            .filter(series => series.points.length > 0);
    });

    const allHistoricalPoints = computed(() => {
        return historicalPositionSeries.value.flatMap(series => series.points);
    });

    const selectedHistoricalPoints = computed(() => {
        const selectedSet = new Set(selectedHistoricalIntervals.value);
        return historicalPositionSeries.value
            .filter(series => selectedSet.has(series.key))
            .flatMap(series => series.points);
    });

    const otherRecordPoints = computed(() => {
        const activeId = props.record?.id;
        const records = Array.isArray(props.records) ? props.records : [];
        return records
            .filter(record => record && record.id !== activeId)
            .map(record => ({
                id: record.id,
                label: record.plot_name || record.plot_id || String(record.id),
                center: getRecordMapCenter(record)
            }))
            .filter(point => !!point.center);
    });

    const allAvailableMapPoints = computed(() => {
        return [
            positionMedian.value,
            positionMean.value,
            plotCoordinates.value,
            ...allHistoricalPoints.value.map(point => point.center),
            ...otherRecordPoints.value.map(point => point.center)
        ].filter(Boolean);
    });

    const allMapPoints = computed(() => {
        return [
            positionMedian.value,
            positionMean.value,
            plotCoordinates.value,
            ...selectedHistoricalPoints.value.map(point => point.center),
            ...otherRecordPoints.value.map(point => point.center)
        ].filter(Boolean);
    });

    const mapCenter = computed(() =>
        positionMedian.value
        || positionMean.value
        || plotCoordinates.value
        || selectedHistoricalPoints.value[0]?.center
        || allHistoricalPoints.value[0]?.center
        || otherRecordPoints.value[0]?.center
        || null
    );

    const hasPosition = computed(() => allAvailableMapPoints.value.length > 0);

    const mapRenderSignature = computed(() => JSON.stringify({
        activeRecordId: props.record?.id,
        activePoints: [positionMedian.value, positionMean.value, plotCoordinates.value],
        historicalPoints: historicalPositionSeries.value.map(series => ({
            key: series.key,
            points: series.points.map(point => point.center)
        })),
        otherPoints: otherRecordPoints.value.map(point => ({ id: point.id, center: point.center }))
    }));

    watch(() => props.record?.id, () => {
        historicalSelectionInitialized.value = false;
    });

    watch(historicalPositionSeries, (series) => {
        const availableKeys = series.map(item => item.key);

        if (availableKeys.length === 0) {
            selectedHistoricalIntervals.value = [];
            historicalSelectionInitialized.value = false;
            return;
        }

        if (!historicalSelectionInitialized.value) {
            selectedHistoricalIntervals.value = [...availableKeys];
            historicalSelectionInitialized.value = true;
            return;
        }

        selectedHistoricalIntervals.value = selectedHistoricalIntervals.value
            .filter(key => availableKeys.includes(key));
    }, { immediate: true });

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

    function formatQuality(value) {
        if (value == null) return 'Nicht geeignet';
        if (value === 1) return 'Standard GPS fix';
        if (value === 2) return 'DGPS';
        if (value === 4) return 'RTK Fixed';
        if (value === 5) return 'RTK Float';
        return 'Nicht geeignet';
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

        updateHistoricalPositionsLayer();

        addOtherRecordPointsLayer();

        // Fit bounds if multiple points exist
        const points = allMapPoints.value;
        if (points.length > 1) {
            const bounds = new maplibregl.LngLatBounds();
            points.forEach(p => bounds.extend(p));
            map.fitBounds(bounds, { padding: 80, maxZoom: 18 });
        }
    }

    function updateHistoricalPositionsLayer() {
        if (!map) return;

        const featureCollection = {
            type: 'FeatureCollection',
            features: selectedHistoricalPoints.value.map(point => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: point.center
                },
                properties: {
                    id: point.id,
                    intervalKey: point.intervalKey,
                    intervalLabel: point.intervalLabel,
                    pointType: point.pointType,
                    pointLabel: point.pointLabel,
                    color: point.color
                }
            }))
        };

        if (map.getSource(HISTORICAL_POSITIONS_SOURCE_ID)) {
            map.getSource(HISTORICAL_POSITIONS_SOURCE_ID).setData(featureCollection);
            return;
        }

        if (featureCollection.features.length === 0) {
            return;
        }

        map.addSource(HISTORICAL_POSITIONS_SOURCE_ID, {
            type: 'geojson',
            data: featureCollection
        });

        map.addLayer({
            id: HISTORICAL_POSITIONS_LAYER_ID,
            type: 'circle',
            source: HISTORICAL_POSITIONS_SOURCE_ID,
            paint: {
                'circle-radius': ['case', ['==', ['get', 'pointType'], 'median'], 7, 5],
                'circle-color': ['get', 'color'],
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 2,
                'circle-opacity': 0.9
            }
        });

        map.on('mouseenter', HISTORICAL_POSITIONS_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', HISTORICAL_POSITIONS_LAYER_ID, () => {
            map.getCanvas().style.cursor = '';
        });

        map.on('click', HISTORICAL_POSITIONS_LAYER_ID, (event) => {
            const feature = event.features?.[0];
            const coordinates = feature?.geometry?.coordinates;
            if (!Array.isArray(coordinates) || coordinates.length !== 2) return;

            const intervalLabel = feature?.properties?.intervalLabel || 'Historisch';
            const pointLabel = feature?.properties?.pointLabel || 'Position';

            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`<strong>${intervalLabel}</strong><br>${pointLabel}`)
                .addTo(map);
        });
    }

    function addOtherRecordPointsLayer() {
        if (!map || otherRecordPoints.value.length === 0) return;

        const featureCollection = {
            type: 'FeatureCollection',
            features: otherRecordPoints.value.map(point => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: point.center
                },
                properties: {
                    id: String(point.id),
                    label: point.label
                }
            }))
        };

        if (map.getSource(OTHER_RECORDS_SOURCE_ID)) {
            map.getSource(OTHER_RECORDS_SOURCE_ID).setData(featureCollection);
        } else {
            map.addSource(OTHER_RECORDS_SOURCE_ID, {
                type: 'geojson',
                data: featureCollection
            });
        }

        if (!map.getLayer(OTHER_RECORDS_LAYER_ID)) {
            map.addLayer({
                id: OTHER_RECORDS_LAYER_ID,
                type: 'circle',
                source: OTHER_RECORDS_SOURCE_ID,
                paint: {
                    'circle-radius': 5,
                    'circle-color': '#546E7A',
                    'circle-stroke-color': '#ECEFF1',
                    'circle-stroke-width': 2
                }
            });

            map.on('mouseenter', OTHER_RECORDS_LAYER_ID, () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', OTHER_RECORDS_LAYER_ID, () => {
                map.getCanvas().style.cursor = '';
            });

            map.on('click', OTHER_RECORDS_LAYER_ID, (event) => {
                const feature = event.features?.[0];
                const coordinates = feature?.geometry?.coordinates;
                if (!Array.isArray(coordinates) || coordinates.length !== 2) return;
                const label = feature?.properties?.label || 'Weitere Ecke';
                new maplibregl.Popup()
                    .setLngLat(coordinates)
                    .setText(`${label}: Gemessene Position`)
                    .addTo(map);
            });
        }
    }

    onMounted(async () => {
        if (hasPosition.value) {
            await nextTick();
            initMap();
        }
    });

    watch(mapRenderSignature, async () => {
        if (map) {
            map.remove();
            map = null;
        }
        if (hasPosition.value) {
            await nextTick();
            setTimeout(() => initMap(), 50);
        }
    });

    watch(selectedHistoricalPoints, () => {
        if (!map || !map.isStyleLoaded()) return;
        updateHistoricalPositionsLayer();
    }, { deep: true });

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
                            <div class="d-flex align-center ga-2" v-if="otherRecordPoints.length">
                                <v-icon color="blue-grey-darken-1" size="small">mdi-circle</v-icon>
                                <span class="text-caption">Weitere Ecken ({{ otherRecordPoints.length }})</span>
                            </div>
                            <div
                                class="d-flex align-center ga-2"
                                v-for="series in historicalPositionSeries.filter(item => selectedHistoricalIntervals.includes(item.key))"
                                :key="series.key"
                            >
                                <span class="historical-interval-dot" :style="{ backgroundColor: series.color }"></span>
                                <span class="text-caption">{{ series.label }}</span>
                            </div>
                        </div>

                        <div v-if="historicalPositionSeries.length" class="mt-3">
                            <v-chip-group v-model="selectedHistoricalIntervals" multiple>
                                <v-chip
                                    v-for="series in historicalPositionSeries"
                                    :key="series.key"
                                    :value="series.key"
                                    filter
                                    size="small"
                                    variant="outlined"
                                >
                                    <span class="historical-interval-dot me-2" :style="{ backgroundColor: series.color }"></span>
                                    {{ series.label }}
                                </v-chip>
                            </v-chip-group>
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
                                    <td class="text-caption">{{ quality }} ({{ formatQuality(quality) }})</td>
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

    .historical-interval-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
        border: 1px solid rgba(0, 0, 0, 0.25);
        flex: 0 0 auto;
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
