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
        "glyphs": "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
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
                if (map.getLayer('geojson-labels')) {
                    map.removeLayer('geojson-labels');
                }
                map.removeSource('geojson-data');
            }

            // geojson is featurecollection of points
            map.addSource('geojson-data', {
                type: 'geojson',
                data: props.geojson,
                //cluster: true,
                //clusterMaxZoom: 14, // Max zoom to cluster points on
                //clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
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
            // labels layer
            map.addLayer({
                id: 'geojson-labels',
                type: 'symbol', // Use 'symbol' for labels
                source: 'geojson-data',
                filter: [">=", ["zoom"], 14], // zeige layer erst ab zoomstufe
                layout: {
                    'text-field': ['concat', ['get', 'cluster_name'],'|',['get', 'plot_name']],
                    'text-allow-overlap': true,
                    'text-size': 20,
                    'text-font': ['Open Sans Regular'], // nötg wegen der Glyphen
                    'text-anchor': 'bottom', // Der Text wird unten vom Punkt platziert
                    "text-offset": [0, 2] // Verschiebt den Text um 2 Pixel nach unten
                },
                paint: {
                    'text-color': '#000',
                    'text-halo-width': 5,
                    'text-halo-color': '#fff'
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

        // Create a popup, but don't add it to the map yet.
        const popup = new maplibregl.Popup({
            
            closeButton: false,
            closeOnClick: false
        });

        map.on('load', () => {

            refreshLayer();

            // Add click event listener
            map.on('click', handleMapClick);
        });
        map.on('mouseover', 'geojson-layer', (e) => {
            map.getCanvasContainer().style.cursor = 'pointer';
        });
        map.on('mouseout', 'geojson-layer', (e) => {
            map.getCanvasContainer().style.cursor = 'default';
        });
        
        // Make sure to detect marker change for overlapping markers
        // and use mousemove instead of mouseenter event
        let currentFeatureCoordinates = undefined;
        map.on('mousemove', 'geojson-layer', (e) => {
            const featureCoordinates = e.features[0].geometry.coordinates.toString();
            if (currentFeatureCoordinates !== featureCoordinates) {
                currentFeatureCoordinates = featureCoordinates;
                // Change the cursor style as a UI indicator.
                map.getCanvas().style.cursor = 'pointer';
                const coordinates = e.features[0].geometry.coordinates.slice();
                const description = e.features[0].properties.cluster_name;
                // Ensure that if the map is zoomed out such that multiple
                // copies of the feature are visible, the popup appears
                // over the copy being pointed to.
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }
                // Populate the popup and set its coordinates
                // based on the feature found.
                popup.setLngLat(coordinates).setHTML(description).addTo(map);
            }
        });
        map.on('mouseleave', 'geojson-layer', () => {
            currentFeatureCoordinates = undefined;
            popup.remove();
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