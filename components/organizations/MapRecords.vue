<script setup>
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onMounted } from 'vue';

    const props = defineProps({
        geoJson: {
            type: Object,
            default: () => ({
                type: "FeatureCollection",
                features: []
            })
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
        const map = new maplibregl.Map({
            container: 'map', // container id
            style: style, // style URL
            center: [10.45, 51.16667], // starting position [lng, lat]
            zoom: 5.5 // starting zoom
        });
        // Resize the map after a short delay to ensure it fits the container
        setTimeout(() => map.resize(), 100);
        map.on('load', () => {
            console.log('props.geoJson', props.geoJson);
            // Add the GeoJSON source only after the style is fully loaded
            map.addSource('map', {
                type: 'geojson',
                data: {
                    "type": "FeatureCollection",
                    "features": [{
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                10.45, 51.16667
                            ]
                        }
                    }, ...props.geoJson.features]
                }
            });
            
            // Ensure the map resizes to fit the container
            
            
        });
    });
</script>

<template>
    <div id="map" style="width: 100%; height: 900px;"></div>
</template>

<style>
    #map {
        width: 100%;
        height: 900px;
    }
</style>