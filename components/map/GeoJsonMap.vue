<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted } from 'vue';

    const props = defineProps({
        geojson: {
            type: Object,
            required: true
        }
    });

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

    onMounted(() => {
        // OSM
        const map = new maplibregl.Map({
            container: 'map',
            style: style,
            center: [10, 51], // germany
            zoom: 5
        });
        map.on('load', () => {
            console.log('Map loaded with GeoJSON:', props.geojson);
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
                    'circle-color': '#ff00ff', // Color of the circle
                    'circle-opacity': 1 // Opacity of the circle
                }
            });

            // Fit map to the bounds of the GeoJSON data
            /*console.log(props.geojson);
            const coordinates = props.geojson.features.flatMap(feature => feature.geometry.coordinates);
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

            map.fitBounds(bounds, { padding: 20 });*/
        });
    });
</script>

<template>
    <div id="map" style="width: 500px; height: 500px;"></div>
</template>