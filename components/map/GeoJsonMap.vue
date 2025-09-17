<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted, watch, ref } from 'vue';

    let map;
    const basemapToggle = ref(true);
    
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

    const emit = defineEmits(['update:selected']);

    // Define the map syle (OpenStreetMap raster tiles)
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

    // Function to toggle the basemap style
    function toggleBasemap() {
        if (!map) return;

        const newStyle = basemapToggle.value ? styleOSM : styleSatellite;

        // Use 'styledata' event instead of 'style.load'
        const handleStyleData = (e) => {
            // Only proceed if this is the final style load (not partial)
            if (e.dataType === 'style') {
                refreshLayer(); // Re-add the GeoJSON layer after the style changes
                updateGeoJsonFeatures(props.geojson); // Pass the actual geojson data
                
                // Remove the event listener to prevent memory leaks
                map.off('styledata', handleStyleData);
            }
        };
        
        map.on('styledata', handleStyleData);
        map.setStyle(newStyle); // Dynamically update the map style
    }

    function updateGeoJsonFeatures(_newGeojson = null) {
        if (!map || !map.isStyleLoaded()) return;

        // Update the color property for each feature based on selection
        _newGeojson.features.forEach(feature => {
            feature.properties.cluster_name = feature.properties.record.cluster_name;
            feature.properties.plot_name = feature.properties.record.plot_name;


            let color = '#00acff'; // Default color
            let strokeWidth = 0; // Default border width
            let opacity = 1.0; // Default opacity
            

            if (feature.properties.isSelected) {
                strokeWidth = 2; // Border width for selected features
            }

            if(!feature.properties.isFiltered){
                color = '#777'; // Grey out non-filtered features
                opacity = 0.3;
            }

            feature.properties.color = color; // Highlight color for filtered features green
            feature.properties.opacity = opacity;
            feature.properties.strokeWidth = strokeWidth; // Border width for filtered features
        });

        //refreshLayer();

        map.getSource('geojson-data').setData(_newGeojson);
        console.log('GeoJSON data updated on map', _newGeojson);
    }

    function refreshLayer() {
        if (map) {

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
                    'circle-opacity': ['get', 'opacity'],
                    'circle-stroke-color': '#ffff00',
                    'circle-stroke-width': ['get', 'strokeWidth'],
                }
            });

            // Add labels layer with error handling
            try {
                // Wait a bit to ensure glyphs are loaded
                setTimeout(() => {
                    if (map && map.isStyleLoaded() && map.getSource('geojson-data')) {
                        map.addLayer({
                            id: 'geojson-labels',
                            type: 'symbol',
                            source: 'geojson-data',
                            filter: [">=", ["zoom"], 14],
                            layout: {
                                'text-field': ['concat', ['get', 'cluster_name'], '|', ['get', 'plot_name']],
                                'text-allow-overlap': true,
                                'text-size': 15,
                                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                                'text-anchor': 'bottom',
                                'text-offset': [0, 2]
                            },
                            paint: {
                                'text-color': '#000',
                                'text-halo-width': 5,
                                'text-halo-color': '#fff'
                            }
                        });
                    }
                }, 100);
            } catch (error) {
                console.warn('Could not add labels layer:', error);
            }
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
        }
    }

    onMounted(() => {
        // OSM
        map = new maplibregl.Map({
            container: 'map',
            style: styleOSM,
            center: [10, 51], // germany
            zoom: 5
        });
        
        map.on('load', () => {
            refreshLayer();
            updateGeoJsonFeatures( props.geojson );

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
        /*let currentFeatureCoordinates = undefined;
        map.on('mousemove', 'geojson-layer', (e) => {
            const featureCoordinates = e.features[0].geometry.coordinates.toString();
            if (currentFeatureCoordinates !== featureCoordinates) {
                currentFeatureCoordinates = featureCoordinates;
                // Change the cursor style as a UI indicator.
                map.getCanvas().style.cursor = 'pointer';
                const coordinates = e.features[0].geometry.coordinates.slice();
                const description = e.features[0].properties.record.cluster_name;
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
        });*/
    });

    watch(() => [props.geojson], (newGeojson) => {

        if (!map || !map.isStyleLoaded()) return;

        updateGeoJsonFeatures( newGeojson[0] );
    }, { deep: true });
    watch(() => props.modelValue, (newVal) => {
        if (newVal) focusMapToData();
    });

    // Watch for changes in the basemap toggle
    watch(basemapToggle, () => {
        toggleBasemap();
    });
</script>

<template>
    <div class="geojson-map-container" :style="$attrs.style">
        <v-switch
            v-model="basemapToggle"
            class="basemap-switch"
            color="primary"
            hide-details
            inset
        ></v-switch>
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
</style>