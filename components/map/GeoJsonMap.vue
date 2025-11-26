<script setup>
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MaplibreGlDraw from 'maplibre-gl-draw';
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css';
import { watch, ref, nextTick } from 'vue';
import { workflows } from '../Utils';
import * as turf from '@turf/turf';

let map;
const basemapToggle = ref(true);
const drawMode = ref(false);
let draw;
let popup = null;

const props = defineProps({
    geojson: {
        type: Object,
        required: true
    },
    modelValue: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(['update:selected', 'polygonSelection']);

// Define the map styles
const styleOSM = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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
        {
            id: 'osm',
            type: 'raster',
            source: 'osm'
        }
    ]
};

const styleSatellite = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
        satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            maxzoom: 19
        }
    },
    layers: [
        {
            id: 'satellite',
            type: 'raster',
            source: 'satellite'
        }
    ]
};

// Function to initialize the map
async function initializeMap() {
    await nextTick(); // Wait for DOM to update
    
    if (map) return; // Prevent duplicate initialization

    map = new maplibregl.Map({
        container: 'map',
        style: styleOSM,
        center: [10, 51], // Germany
        zoom: 5
    });

    map.on('load', () => {
        
        // Initialize MaplibreGlDraw
        draw = new MaplibreGlDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: false
            },
            defaultMode: 'simple_select',
            styles: [
                // Polygon fill
                {
                    'id': 'gl-draw-polygon-fill',
                    'type': 'fill',
                    'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    'paint': {
                        'fill-color': '#ffff00',
                        'fill-outline-color': '#ffff00',
                        'fill-opacity': 0.3
                    }
                },
                // Polygon outline stroke
                {
                    'id': 'gl-draw-polygon-stroke-active',
                    'type': 'line',
                    'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    'paint': {
                        'line-color': '#ffff00',
                        'line-width': 2
                    }
                },
                // Vertex points
                {
                    'id': 'gl-draw-polygon-and-line-vertex-active',
                    'type': 'circle',
                    'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
                    'paint': {
                        'circle-radius': 5,
                        'circle-color': '#ffff00'
                    }
                }
            ]
        });
        map.addControl(draw, 'top-left');

        // Listen for draw events
        map.on('draw.create', handlePolygonComplete);
        map.on('draw.update', handlePolygonComplete);
        map.on('draw.delete', clearPolygonSelection);
        
        // Wait for style to be fully loaded
        if (map.isStyleLoaded()) {
            refreshLayer();
            updateGeoJsonFeatures(props.geojson);
        } else {
            // Use styledata event if style is not loaded yet
            map.once('styledata', () => {
                console.log('Style loaded');
                refreshLayer();
                updateGeoJsonFeatures(props.geojson);
            });
        }

        // Add click event listener
        map.on('click', handleMapClick);

        // Add mouseover for tooltip
        map.on('mousemove', 'geojson-layer', (e) => {
            if (popup) popup.remove();

            if (map.getZoom() < 14) {
                popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
                    .setLngLat(e.lngLat)
                    .setHTML(`<strong style="color:#000">${e.features[0].properties.cluster_name} - ${e.features[0].properties.plot_name}</strong>`)
                    .addTo(map);
            }
        });

        // Add mouseout to remove tooltip and reset cursor
        map.on('mouseout', 'geojson-layer', () => {
            if (popup) {
                popup.remove();
                popup = null;
            }
            map.getCanvasContainer().style.cursor = 'default';
        });

        map.on('mouseover', 'geojson-layer', () => {
            map.getCanvasContainer().style.cursor = 'pointer';
        });
    });
}

// Function to destroy the map
function destroyMap() {
    if (map) {
        map.remove();
        map = null;
    }
}

// Watch for dialog visibility changes
watch(() => props.modelValue, async (isOpen) => {
    console.log('Dialog visibility changed:', isOpen);
    if (isOpen) {
        await initializeMap();
    } else {
        destroyMap();
    }
}, { immediate: true });

// Watch for geojson changes when dialog is open
watch(() => props.geojson, (newGeojson) => {
    if (props.modelValue && map && map.isStyleLoaded()) {
        console.log('GeoJSON data changed, updating features', newGeojson);
        updateGeoJsonFeatures(newGeojson);
    }
}, { deep: true });

// Watch for basemap toggle
watch(basemapToggle, () => {
    if (!map) return;

    const newStyle = basemapToggle.value ? styleOSM : styleSatellite;

    const handleStyleData = (e) => {
        if (e.dataType === 'style') {
            map.off('styledata', handleStyleData);
            refreshLayer();
            updateGeoJsonFeatures(props.geojson);
        }
    };
    
    map.on('styledata', handleStyleData);
    map.setStyle(newStyle);
});

function refreshLayer() {
    if (map) {
        if (map.getSource('geojson-data')) {
            if (map.getLayer('geojson-layer')) {
                map.removeLayer('geojson-layer');
            }
            if (map.getLayer('geojson-cluster-label')) {
                map.removeLayer('geojson-cluster-label');
            }
            if (map.getLayer('geojson-plot-label')) {
                map.removeLayer('geojson-plot-label');
            }
            map.removeSource('geojson-data');
        }

        map.addSource('geojson-data', {
            type: 'geojson',
            data: props.geojson
        });

        map.addLayer({
            id: 'geojson-layer',
            type: 'circle',
            source: 'geojson-data',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    0, 1,
                    5, 3,
                    13, 5
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': 1,// ['get', 'opacity'],
                'circle-stroke-color': '#4297f3',
                'circle-stroke-width': ['get', 'strokeWidth'],
            }
        });
        
        // Add cluster labels for zoom 10-13 (only cluster_name)
        map.addLayer({
            id: 'geojson-cluster-label',
            type: 'symbol',
            source: 'geojson-data',
            filter: ["all", [">=", ["zoom"], 10], ["<", ["zoom"], 14]],
            layout: {
                'text-field': ['get', 'cluster_name'],
                'text-allow-overlap': false,
                'symbol-placement': 'point',
                'text-size': 14,
                'text-anchor': 'center',
                'symbol-sort-key': ['get', 'cluster_name']
            },
            paint: {
                'text-color': '#000',
                'text-halo-width': 3,
                'text-halo-color': 'rgba(255, 255, 255, 0.8)' // bit transparent for better readability
            }
        });
        
        // Add detailed labels for zoom 14+ (cluster_name - plot_name)
        map.addLayer({
            id: 'geojson-plot-label',
            type: 'symbol',
            source: 'geojson-data',
            filter: [">=", ["zoom"], 14],
            layout: {
                'text-field': ['concat', ['get', 'cluster_name'], ' - ', ['get', 'plot_name']],
                'text-allow-overlap': true,
                'text-size': 15,
                'text-anchor': 'center',
                "text-offset": [0, 2]
            },
            paint: {
                'text-color': '#000',
                'text-halo-width': 5,
                'text-halo-color': '#fff'
            }
        });

    }
}

function updateGeoJsonFeatures(_newGeojson = null) {
    // Remove the isStyleLoaded check here since we're already ensuring it's called after style loads
    
    if (!map) return;

    _newGeojson.features.forEach(feature => {
        if(feature.properties.state_by_user){
            feature.properties.color = feature.properties.state_by_user;
        }else{
            feature.properties.color = feature.properties.isFiltered ? '#00acff' : '#777';
        }
        
        feature.properties.opacity = feature.properties.isFiltered ? 1.0 : 0.3;
        feature.properties.strokeWidth = feature.properties.isSelected ? 4 : 0;
    });

    // Check if source exists before trying to update
    if (map.getSource('geojson-data')) {
        map.getSource('geojson-data').setData(_newGeojson);
        console.log('GeoJSON data source updated', _newGeojson);
    }
}

function handleMapClick(e) {
    if (drawMode.value) return; // Don't handle clicks in draw mode
    
    const features = map.queryRenderedFeatures(e.point, { layers: ['geojson-layer'] });
    if (features.length > 0) {
        const clickedFeature = features[0];
        emit('update:selected', clickedFeature.properties);
    }
}

function handlePolygonComplete(e) {
    if (!e.features || e.features.length === 0) return;
    
    const polygon = e.features[0];
    const selectedFeatures = [];
    
    // Pre-compute polygon once for all comparisons
    const poly = turf.polygon(polygon.geometry.coordinates);
    const bbox = turf.bbox(poly);
    
    // Filter features by bounding box first (much faster)
    const candidateFeatures = props.geojson.features.filter(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
    });
    
    // Only check point-in-polygon for candidates within bounding box
    candidateFeatures.forEach(feature => {
        const point = turf.point(feature.geometry.coordinates);
        
        if (turf.booleanPointInPolygon(point, poly)) {
            selectedFeatures.push(feature.properties);
        }
    });
    
    if (selectedFeatures.length > 0) {
        emit('polygonSelection', selectedFeatures);
        // Remove the polygon after selection
        
    }
    draw.deleteAll();
    drawMode.value = false;
    draw.changeMode('simple_select');
}

function clearPolygonSelection() {
    emit('polygonSelection', []);
}

function toggleDrawMode() {
    drawMode.value = !drawMode.value;
    
    if (drawMode.value) {
        draw.changeMode('draw_polygon');
    } else {
        draw.changeMode('simple_select');
        draw.deleteAll();
    }
}
</script>

<template>
    <div v-if="modelValue" class="geojson-map-container" :style="$attrs.style">
        <v-switch
            v-model="basemapToggle"
            class="basemap-switch"
            color="primary"
            hide-details
            inset
        ></v-switch>
        <v-btn
            :icon="drawMode ? 'mdi-shape-polygon-plus' : 'mdi-shape-polygon-plus'"
            :color="drawMode ? 'primary' : 'default'"
            @click="toggleDrawMode"
            class="position-absolute"
            style="z-index: 12; top: 40px; left: 10px;" 
            density="compact">
        </v-btn>
        <div id="map" style="width: 100%; height: 100%;"></div>
    </div>
</template>

<style scoped>
.geojson-map-container {
    position: relative;
    width: 100%;
    height: 100%;
}

.basemap-switch {
    position: absolute;
    top: 0px;
    right: 10px;
    z-index: 1;
}

.draw-toggle-btn {
    position: absolute;
    top: 40px;
    left: 10px;
    z-index: 1;
}

.geojson-map-container :deep(.maplibregl-ctrl-top-left) {
    top: 40px;
}

/* Hide the default draw controls but keep functionality */
.geojson-map-container :deep(.maplibregl-ctrl-top-left .maplibregl-ctrl-group) {
    display: none;
}
</style>