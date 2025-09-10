<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted, watch } from 'vue';

    let map;

    const props = defineProps({
        geojson: {
            type: Object,
            required: true
        },
        selected: {
            type: Array,
            default: () => []
        },
        modelValue: {
            type: Boolean,
            default: true
        }
    });

    const emit = defineEmits(['update:selected']);

    // Define the map syle (OpenStreetMap raster tiles)
    const style = {
        "version": 8,
            "sources": {
            "osm": {
                    "type": "raster",
                    "tiles": ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    "tileSize": 256,
            "attribution": "&copy; OpenStreetMap Contributors",
            "maxzoom": 19
            }
        },
        "layers": [
            {
            "id": "osm",
            "type": "raster",
            "source": "osm" // This must match the source key above
            }
        ]
    };

    function refreshLayer() {
        if (map && map.isStyleLoaded()) {
                    console.log('Map refreshed with new data or selection');

            // Update the color property for each feature based on selection
            props.geojson.features.forEach(feature => {
                if (props.selected.find(f => f.plot_id === feature.properties.plot_id)) {
                    feature.properties.color = '#0000ff'; // Highlight color for selected features yellow
                } else {
                    feature.properties.color = '#777777'; // Default color for non-selected features
                }
            });

            // Remove the existing source and layer if they already exist
            if (map.getSource('geojson-data')) {
                if (map.getLayer('geojson-layer')) {
                    map.removeLayer('geojson-layer');
                }
                map.removeSource('geojson-data');
            }

            // geojson is featurecollection of points
            map.addSource('geojson-data', {
                type: 'geojson',
                data: props.geojson
            });
            map.addLayer({
                id: 'geojson-layer',
                type: 'circle', // Use 'circle' for points
                source: 'geojson-data',
                paint: {
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        5, 1,    // At zoom level 0, radius is 1
                        20, 10   // At zoom level 20, radius is 1
                    ],
                    'circle-color': ['get', 'color'], // Color of the circle
                    'circle-opacity': 1 // Opacity of the circle
                }
            });
        }
    }

    function focusMapToData() {
        if (map && map.isStyleLoaded() && props.geojson.features.length > 0) {
            const coordinates = props.geojson.features.map(feature => feature.geometry.coordinates);
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
            map.fitBounds(bounds, { padding: 20 });
        }
    }

    function handleMapClick(e) {
        const features = map.queryRenderedFeatures(e.point, { layers: ['geojson-layer'] });
        if (features.length > 0) {
            const clickedFeature = features[0];
            const plotId = clickedFeature.properties.plot_id;

            emit('update:selected', clickedFeature.properties);
            /* Check if the feature is already selected
            const isSelected = props.selected.find(f => f.plot_id === plotId);
            if (!isSelected) {
                // Add the feature to the selected array
                emit('update:selected', clickedFeature.properties);
            }*/
        }
    }

    onMounted(() => {
        // OSM
        map = new maplibregl.Map({
            container: 'map',
            style: style,
            center: [10, 51], // germany
            zoom: 5
        });
        map.on('load', () => {

            refreshLayer();

            // Add click event listener
            map.on('click', handleMapClick);
        });
    });

    watch(() => [props.selected, props.geojson], (newSelected, newGeojson) => {
        if (!map || !map.isStyleLoaded()) return;

        refreshLayer();

    }, { immediate: false });
    watch(() => props.modelValue, (newVal) => {
        if (newVal) {
            focusMapToData();
            refreshLayer();
        }
    }, { immediate: true });
</script>

<template>
    <div id="map" style="width: 100%; height: 100%;"></div>
</template>