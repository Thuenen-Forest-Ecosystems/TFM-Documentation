<script setup>
// ──────────────────────────────────────────────────────────────────────────────
// 1️⃣ Component meta‑information (JSDoc)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @component MapOfShrinkedTrees
 * @description Interaktive Karten- und Tabellendarstellung von Traktecken mit geschrumpftem BHD.
 *
 * Datenquelle:
 * - PostgreSQL RPC-Funktion `stat_map_of_shrinked_trees(user_id text)`
 *   (definiert in 20261120160000_stat_map_of_shrinked_trees.sql).
 *
 * Anforderungen:
 * - Darstellung ausschließlich von Einzelpunkten (keine Cluster / keine Aggregate).
 * - Rote Farbskala: Je mehr geschrumpfte BHDs pro Traktecke/Plot, desto dunkler das Rot.
 * - Standard-Organisationsauswahl (<OrganizationSelect />) wie in den anderen Statistiken.
 * - Tabellarische Detailansicht (AG Grid) und CSV-Export.
 */

// ──────────────────────────────────────────────────────────────────────────────
// 2️⃣ Imports – Vue core, AG‑Grid, MapLibre GL, VitePress utilities, child components
// ──────────────────────────────────────────────────────────────────────────────
import { ref, onMounted, getCurrentInstance, computed, watch, nextTick, onUnmounted } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import { useData } from 'vitepress';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import OrganizationSelect from '../OrganizationSelect.vue';
import ExportCsvButton from '../ExportCsvButton.vue';

// AG Grid Community-Module registrieren
ModuleRegistry.registerModules([AllCommunityModule]);

// Supabase-Client aus der globalen Vue-Instanz auslesen
const { isDark } = useData();
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;

// ──────────────────────────────────────────────────────────────────────────────
// 3️⃣ Theme‑Handling & Kartenstile
// ──────────────────────────────────────────────────────────────────────────────
const currentTheme = computed(() => themeQuartz.withPart(isDark?.value ? colorSchemeDark : colorSchemeLight));

// Standard-Mittelpunkt (geografischer Mittelpunkt Deutschlands) und Zoomstufe
const DEFAULT_CENTER = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5.6;

/**
 * OpenStreetMap Raster-Kachelstil
 */
const styleOSM = {
  version: 8,
  sources: {
    'proxy-tiles-source': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; Thünen-Institut'
    }
  },
  layers: [
    { id: 'proxy-tiles-layer', type: 'raster', source: 'proxy-tiles-source' }
  ]
};

/**
 * ESRI World Imagery Satelliten-Kachelstil
 */
const styleSatellite = {
  version: 8,
  sources: {
    'proxy-tiles-source': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community, &copy; Thünen-Institut'
    }
  },
  layers: [
    { id: 'proxy-tiles-layer', type: 'raster', source: 'proxy-tiles-source' }
  ]
};

// ──────────────────────────────────────────────────────────────────────────────
// 4️⃣ Hilfsfunktionen: Farbkodierung & Koordinatentransformation
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Farbskala: Je mehr geschrumpfte BHDs pro Traktecke, desto dunkler das Rot.
 * 1 Baum:   #fca5a5 (Hellrot)
 * 2 Bäume:  #f87171 (Helles Rot)
 * 3 Bäume:  #ef4444 (Rot)
 * 4 Bäume:  #dc2626 (Kräftiges Rot)
 * 5 Bäume:  #991b1b (Dunkelrot)
 * 6+ Bäume: #450a0a (Sehr dunkles Rot)
 */
const legendItems = [
  { label: '1 geschrumpfter BHD', count: 1, color: '#fca5a5' },
  { label: '2 geschrumpfte BHDs', count: 2, color: '#f87171' },
  { label: '3 geschrumpfte BHDs', count: 3, color: '#ef4444' },
  { label: '4 geschrumpfte BHDs', count: 4, color: '#dc2626' },
  { label: '5 geschrumpfte BHDs', count: 5, color: '#991b1b' },
  { label: '≥ 6 geschrumpfte BHDs', count: 6, color: '#450a0a' }
];

function getShrinkedCountColor(count) {
  const n = Number(count) || 1;
  if (n <= 1) return '#fca5a5';
  if (n === 2) return '#f87171';
  if (n === 3) return '#ef4444';
  if (n === 4) return '#dc2626';
  if (n === 5) return '#991b1b';
  return '#450a0a';
}

/**
 * Prüft, ob gegebene WGS84-Koordinaten im plausiblen Bereich für Deutschland liegen.
 */
function isValidCoordinate(lon, lat) {
  const x = parseFloat(lon);
  const y = parseFloat(lat);
  return !isNaN(x) && !isNaN(y) &&
         x >= 5.0 && x <= 16.0 &&
         y >= 46.5 && y <= 56.0;
}

/**
 * Transformiert metrische Gauss-Krüger-Koordinaten (DHDN / Bessel 1841, Streifen 2-5)
 * über eine 7-Parameter-Helmert-Transformation präzise nach WGS84 (EPSG:4326).
 */
function gkToWgs84(rw, hw) {
  if (rw == null || hw == null || isNaN(rw) || isNaN(hw)) return [null, null];
  if (Math.abs(rw) < 0.001 && Math.abs(hw) < 0.001) return [null, null];
  if (rw >= 5.0 && rw <= 16.0 && hw >= 46.5 && hw <= 56.0) return [rw, hw];

  const a = 6377397.155;
  const f = 1 / 299.1528128;
  const e2 = 2 * f - f * f;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const zone = Math.floor(rw / 1000000);
  const l0 = zone * 3;
  const y = rw - zone * 1000000 - 500000;
  const x = hw;

  const m = x;
  const mu = m / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
  const phi1 = mu + (3*e1/2 - 27*e1*e1*e1/32)*Math.sin(2*mu)
                  + (21*e1*e1/16 - 55*e1*e1*e1*e1/32)*Math.sin(4*mu)
                  + (151*e1*e1*e1/96)*Math.sin(6*mu);

  const n1 = a / Math.sqrt(1 - e2 * Math.sin(phi1)*Math.sin(phi1));
  const t1 = Math.tan(phi1)*Math.tan(phi1);
  const c1 = (e2 / (1 - e2)) * Math.cos(phi1)*Math.cos(phi1);
  const r1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1)*Math.sin(phi1), 1.5);
  const d = y / n1;

  const latBessel = phi1 - (n1 * Math.tan(phi1) / r1) * (d*d/2 - (5 + 3*t1 + 10*c1 - 4*c1*c1 - 9*(e2/(1-e2)))*d*d*d*d/24 + (61 + 90*t1 + 298*c1 + 45*t1*t1 - 252*(e2/(1-e2)) - 3*c1*c1)*d*d*d*d*d*d/720);
  const lonBessel = (l0 * Math.PI / 180) + (d - (1 + 2*t1 + c1)*d*d*d/6 + (5 - 2*c1 + 28*t1 - 3*c1*c1 + 8*(e2/(1-e2)) + 24*t1*t1)*d*d*d*d*d/120) / Math.cos(phi1);

  const N = a / Math.sqrt(1 - e2 * Math.sin(latBessel)*Math.sin(latBessel));
  const cartX = N * Math.cos(latBessel) * Math.cos(lonBessel);
  const cartY = N * Math.cos(latBessel) * Math.sin(lonBessel);
  const cartZ = N * (1 - e2) * Math.sin(latBessel);

  const dx = 598.1, dy = 73.7, dz = 418.2;
  const rx = 0.202 * Math.PI / (180 * 3600);
  const ry = 0.045 * Math.PI / (180 * 3600);
  const rz = -2.455 * Math.PI / (180 * 3600);
  const s = 6.7e-6;

  const wX = (1 + s) * cartX - rz * cartY + ry * cartZ + dx;
  const wY = rz * cartX + (1 + s) * cartY - rx * cartZ + dy;
  const wZ = -ry * cartX + rx * cartY + (1 + s) * cartZ + dz;

  const aW = 6378137.0;
  const fW = 1 / 298.257223563;
  const e2W = 2 * fW - fW * fW;

  const p = Math.sqrt(wX*wX + wY*wY);
  let latW = Math.atan2(wZ, p * (1 - e2W));
  for (let i = 0; i < 5; i++) {
    const NW = aW / Math.sqrt(1 - e2W * Math.sin(latW)*Math.sin(latW));
    latW = Math.atan2(wZ + e2W * NW * Math.sin(latW), p);
  }
  const lonW = Math.atan2(wY, wX);

  return [lonW * 180 / Math.PI, latW * 180 / Math.PI];
}

// ──────────────────────────────────────────────────────────────────────────────
// 5️⃣ Reaktiver Zustand (State Variables)
// ──────────────────────────────────────────────────────────────────────────────
const tabledata = ref([]);                // Aufbereitete Datensätze der RPC
const dataload = ref(false);             // Ladeindikator aktiv?
const dataloaded = ref(0);               // Anzahl geladener Datensätze
const organisationsList = ref([]);       // Liste aller verfügbaren Organisationen
const selectedOrganisation = ref(null);  // Aktuell ausgewählte Organisations-/Trupp-UUID
const MyColDefs1 = ref([]);              // Spaltendefinitionen für AG Grid
const gridApi1 = ref(null);              // Referenz auf die AG Grid API

let map = null;                          // MapLibre Map-Instanz
let resizeObserver = null;               // ResizeObserver für automatische Kartengrößenanpassung
const basemapToggle = ref(true);         // true = OSM, false = Satellit
const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };

// Filteroption für Mindestanzahl geschrumpfter Bäume (1 = alle)
const minTreeFilter = ref(1);

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ Berechnete Eigenschaften (Computed Properties)
// ──────────────────────────────────────────────────────────────────────────────
const filteredTableData = computed(() => {
  return tabledata.value.filter(r => (r.anzahl_geschrumpfter_baeume || 0) >= minTreeFilter.value);
});

/**
 * Generiert GeoJSON FeatureCollection OHNE Aggregation (nur Einzelpunkte).
 */
const mapGeoJson = computed(() => {
  const activeRows = filteredTableData.value || [];
  return {
    type: 'FeatureCollection',
    features: activeRows
      .filter(r => r && isValidCoordinate(r.x, r.y))
      .map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(r.x), parseFloat(r.y)] },
        properties: { 
          cluster_name: r.cluster_name,
          plot_name: r.plot_name,
          troop_name: r.troop_name || '-',
          lil: r.lil || '-',
          count: Number(r.anzahl_geschrumpfter_baeume) || 1
        }
      }))
  };
});

const gridHeight = computed(() => {
  const rows = Math.min(filteredTableData.value?.length ?? 0, 10) || 1;
  return `${Math.max(42 * rows + 80, 150)}px`;
});

// Gesamtstatistik
const totalPlotsWithShrinked = computed(() => tabledata.value.length);
const totalShrinkedTrees = computed(() => {
  return tabledata.value.reduce((sum, r) => sum + (Number(r.anzahl_geschrumpfter_baeume) || 0), 0);
});

// ──────────────────────────────────────────────────────────────────────────────
// 7️⃣ Spaltendefinitionen & Datenabruf (RPC)
// ──────────────────────────────────────────────────────────────────────────────
function buildColDefs() {
  MyColDefs1.value = [
    { field: "lil", headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Traktecke", filter: "agNumberColumnFilter" },
    { field: "troop_name", headerName: "Aufnahmetrupp", filter: "agTextColumnFilter" },
    { field: "anzahl_geschrumpfter_baeume", headerName: "Geschrumpfte Bäume", filter: "agNumberColumnFilter", sort: "desc" },
    { field: "cartesian_x", headerName: "X-Koordinate", filter: "agNumberColumnFilter", hide: true },
    { field: "cartesian_y", headerName: "Y-Koordinate", filter: "agNumberColumnFilter", hide: true }
  ];
}

async function fetchShrinkedTreesMap() {
  if (!selectedOrganisation.value) { 
    tabledata.value = []; 
    dataloaded.value = 0;
    return []; 
  }
  
  dataload.value = true;
  dataloaded.value = 0;

  try {
    const { data, error } = await supabase.rpc('stat_map_of_shrinked_trees', {
      user_id: selectedOrganisation.value
    });

    if (error) throw error;

    const records = data || [];
    dataloaded.value = records.length;
    
    const formatted = records.map(r => {
      const cx = parseFloat(r.cartesian_x);
      const cy = parseFloat(r.cartesian_y);
      const [lon, lat] = gkToWgs84(cx, cy);

      const count = Number(r.anzahl_geschrumpfter_bäume ?? r.Anzahl_geschrumpfter_Bäume ?? r.anzahl_geschrumpfter_baeume) || 1;

      return {
        ...r,
        lil: r.landesinventurleitung || r.lil,
        landesinventurleitung: r.landesinventurleitung || r.lil,
        troop_name: r.troop_name,
        anzahl_geschrumpfter_baeume: count,
        cartesian_x: cx,
        cartesian_y: cy,
        x: lon,
        y: lat
      };
    });

    tabledata.value = formatted;
    return formatted;
  } catch (err) { 
    console.error('Error fetching stat_map_of_shrinked_trees:', err); 
    tabledata.value = [];
    return [];
  } finally {
    dataload.value = false;
    await nextTick();
    if (map) {
      map.resize();
      setTimeout(() => {
        if (map) {
          map.resize();
          fitMapBounds({ immediate: false });
        }
      }, 50);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 8️⃣ MapLibre GL Karten-Initialisierung (NUR Einzelpunkte, keine Aggregate)
// ──────────────────────────────────────────────────────────────────────────────
async function initMap() {
  await nextTick();
  if (map) return;
  map = new maplibregl.Map({ 
    container: 'shrinked-trees-map', 
    style: basemapToggle.value ? styleOSM : styleSatellite, 
    center: DEFAULT_CENTER, 
    zoom: DEFAULT_ZOOM,
    attributionControl: false
  });

  map.addControl(
    new maplibregl.AttributionControl({ compact: false }),
    'bottom-left'
  );

  map.on('load', () => { 
    refreshMapLayers(); 
    fitMapBounds({ immediate: true });
  });

  // Klick-Popup auf Einzelpunkt
  map.on('click', 'shrinked-points-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    const count = Number(props.count) || 1;
    const color = getShrinkedCountColor(count);
    const html = `<div class="p-1 text-xs space-y-1 font-sans">
      <div class="font-bold border-b pb-1 mb-1 text-sm text-gray-900">Trakt ${props.cluster_name}, Ecke ${props.plot_name}</div>
      <div class="flex items-center space-x-1">
        <strong>Geschrumpfte BHDs:</strong>
        <span class="px-1.5 py-0.5 rounded text-white font-bold" style="background-color: ${color}">${count}</span>
      </div>
      <div><strong>LIL:</strong> ${props.lil}</div>
      <div><strong>Trupp:</strong> ${props.troop_name}</div>
    </div>`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  map.on('mouseenter', 'shrinked-points-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'shrinked-points-layer', () => { map.getCanvas().style.cursor = ''; });
}

function refreshMapLayers() {
  if (!map || !map.isStyleLoaded()) return;

  if (map.getLayer('shrinked-points-layer')) map.removeLayer('shrinked-points-layer');
  if (map.getLayer('proxy-tiles-layer')) map.removeLayer('proxy-tiles-layer');
  if (map.getSource('api-data')) map.removeSource('api-data');
  if (map.getSource('proxy-tiles-source')) map.removeSource('proxy-tiles-source');

  const currentStyle = basemapToggle.value ? styleOSM : styleSatellite;
  const tileSourceConfig = currentStyle.sources['proxy-tiles-source'];

  map.addSource('proxy-tiles-source', { 
    type: 'raster', 
    tiles: tileSourceConfig.tiles, 
    tileSize: 256, 
    maxzoom: 19,
    attribution: tileSourceConfig.attribution
  });
  map.addLayer({ id: 'proxy-tiles-layer', type: 'raster', source: 'proxy-tiles-source' });

  // GeoJSON-Quelle OHNE Clustering (nur Einzelpunkte)
  map.addSource('api-data', { 
    type: 'geojson', 
    data: mapGeoJson.value, 
    cluster: false 
  });

  // Punktschicht mit Rot-Farbrampe: je höher der Count, desto dunkler das Rot
  map.addLayer({
    id: 'shrinked-points-layer',
    type: 'circle',
    source: 'api-data',
    paint: {
      'circle-radius': [
        'step',
        ['get', 'count'],
        6,        // count <= 1
        2, 7,     // count == 2
        3, 8,     // count == 3
        4, 9,     // count == 4
        5, 10     // count >= 5
      ],
      'circle-color': [
        'step',
        ['get', 'count'],
        '#fca5a5', // 1 Baum: Hellrot
        2, '#f87171', // 2 Bäume: Helles Rot
        3, '#ef4444', // 3 Bäume: Rot
        4, '#dc2626', // 4 Bäume: Kräftiges Rot
        5, '#991b1b', // 5 Bäume: Dunkelrot
        6, '#450a0a'  // >= 6 Bäume: Sehr dunkles Rot
      ],
      'circle-stroke-color': '#000000',
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': 0.9,
      'circle-opacity': 0.85
    }
  });
}

function fitMapBounds(options = {}) {
  if (!map) return;

  const validRows = (filteredTableData.value || []).filter(
    r => r && isValidCoordinate(r.x, r.y)
  );

  if (validRows.length === 0) {
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: options.immediate ? 0 : 600 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  validRows.forEach(r => bounds.extend([parseFloat(r.x), parseFloat(r.y)]));

  const containerWidth = map.getContainer()?.offsetWidth || 1000;
  const rightPadding = containerWidth > 800 ? 260 : 40;

  map.fitBounds(bounds, {
    padding: { top: 50, bottom: 50, left: 50, right: rightPadding },
    maxZoom: 13,
    duration: options.immediate ? 0 : 600
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// 9️⃣ Lifecycle Hooks & Watchers
// ──────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  buildColDefs();
  await initMap();

  const container = document.getElementById('shrinked-trees-map');
  if (container && window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.resize();
      }
    });
    resizeObserver.observe(container);
  }
});

onUnmounted(() => { 
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (map) map.remove(); 
});

watch(selectedOrganisation, () => { 
  fetchShrinkedTreesMap(); 
});

function onFilterChanged() {
  if (!map || !map.getSource('api-data') || !gridApi1.value) return;
  const filteredRows = [];
  gridApi1.value.forEachNodeAfterFilter((node) => { if (node.data) filteredRows.push(node.data); });
  const filteredGeoJson = { 
    type: 'FeatureCollection', 
    features: filteredRows
      .filter(r => r && isValidCoordinate(r.x, r.y))
      .map(r => ({ 
        type: 'Feature', 
        geometry: { type: 'Point', coordinates: [parseFloat(r.x), parseFloat(r.y)] }, 
        properties: { 
          cluster_name: r.cluster_name, 
          plot_name: r.plot_name, 
          troop_name: r.troop_name || '-', 
          lil: r.lil || '-', 
          count: Number(r.anzahl_geschrumpfter_baeume) || 1 
        } 
      })) 
  };
  
  map.getSource('api-data').setData(filteredGeoJson);
}

watch(mapGeoJson, (newGeoJson) => { 
  if (map && map.isStyleLoaded()) { 
    if (map.getSource('api-data')) {
      map.getSource('api-data').setData(newGeoJson); 
    } else {
      refreshMapLayers();
    }
  } 
}, { deep: true, immediate: false });

watch(minTreeFilter, () => {
  if (map && map.isStyleLoaded() && map.getSource('api-data')) {
    map.getSource('api-data').setData(mapGeoJson.value);
  }
});

watch(basemapToggle, () => { 
  if (!map) return; 
  map.setStyle(basemapToggle.value ? styleOSM : styleSatellite); 
  map.once('idle', () => { 
    if (!map || !map.isStyleLoaded()) return;
    refreshMapLayers(); 
  }); 
});

function onGridReady1(params) { gridApi1.value = params.api; }

function onOrgsLoaded(res) {
  organisationsList.value = res?.organisationsList || [];
}
</script>

<template>
  <!-- Organisationsauswahl -->
  <OrganizationSelect
    v-model="selectedOrganisation"
    @loaded="onOrgsLoaded"
  />

  <!-- Ladeanzeige bei aktivem Datenabruf -->
  <v-card v-if="dataload === true" class="mt-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Traktecken geladen...)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <!-- Kartenansicht -->
  <v-card v-show="selectedOrganisation" class="mt-4 map-card">
    <v-card-title class="d-flex justify-between align-center flex-wrap ga-2">
      <div class="d-flex align-center ga-2">
        <span>Karte geschrumpfter BHDs (Einzelpunkte)</span>
        <v-chip v-if="tabledata.length" size="small" color="red" variant="tonal">
          {{ totalPlotsWithShrinked }} Ecken ({{ totalShrinkedTrees }} Bäume)
        </v-chip>
      </div>
      <v-switch v-model="basemapToggle" label="Satellit / Karte" class="ml-auto" hide-details inset color="primary" />
    </v-card-title>

    <div class="map-wrapper">
      <div id="shrinked-trees-map"></div>
      
      <!-- Legende mit Farbskala (je mehr Bäume, desto dunkleres Rot) -->
      <div v-if="tabledata.length" class="map-legend shadow-lg border">
        <div class="legend-title">Geschrumpfte BHDs je Ecke</div>
        <div class="legend-items space-y-2">
          <div 
            v-for="item in legendItems" 
            :key="item.count" 
            class="legend-item flex items-center select-none"
          >
            <span class="legend-color-dot mr-2" :style="{ backgroundColor: item.color }"></span>
            <span>{{ item.label }}</span>
          </div>
        </div>

        <div class="mt-3 pt-2 border-t text-xs text-grey">
          <label class="d-flex align-center justify-between">
            <span>Filter ab Anzahl:</span>
            <select v-model.number="minTreeFilter" class="border rounded px-1 py-0.5 bg-transparent ml-2">
              <option :value="1">Alle (≥ 1)</option>
              <option :value="2">≥ 2 Bäume</option>
              <option :value="3">≥ 3 Bäume</option>
              <option :value="4">≥ 4 Bäume</option>
              <option :value="5">≥ 5 Bäume</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </v-card>

  <!-- Detailtabelle (AG Grid) und CSV-Export -->
  <v-card class="mt-4">
    <v-card-title>Ergebnis</v-card-title>
    <ag-grid-vue 
      v-show="!dataload && selectedOrganisation && filteredTableData.length" 
      :rowData="filteredTableData" 
      :columnDefs="MyColDefs1" 
      :style="{ height: gridHeight }" 
      style="width: 100%" 
      :paginationPageSize="10" 
      :paginationPageSizeSelector="[10, 25, 50]" 
      :pagination="true" 
      :autoSizeStrategy="autoSizeStrategy" 
      :key="isDark" 
      :theme="currentTheme" 
      @grid-ready="onGridReady1" 
      @filter-changed="onFilterChanged" 
    />
    <v-card-text v-show="!dataload && (!selectedOrganisation || !filteredTableData.length)" class="text-center text-grey italic">
      Keine Daten verfügbar. Bitte Auswahl ändern.
    </v-card-text> 
    <v-card-actions>
      <ExportCsvButton
        :grid-api="gridApi1"
        filename-prefix="CI-Statistik_map_of_shrinked_trees"
        :selected-organisation="selectedOrganisation"
        :organisations-list="organisationsList"
        :disabled="!filteredTableData.length"
        class="ma-2"
      />
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.map-card { width: 100%; }

.map-wrapper { 
  position: relative; 
  width: 100%; 
  height: clamp(550px, 62vh, 850px); 
}
#shrinked-trees-map { width: 100%; height: 100%; }

.map-legend { 
  position: absolute; 
  bottom: 24px; 
  right: 12px; 
  z-index: 10; 
  background-color: #ffffff !important; 
  color: #1f2937 !important; 
  padding: 12px; 
  border-radius: 8px; 
  font-family: sans-serif; 
  min-width: 220px; 
  border: 1px solid #e5e7eb !important; 
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; 
}
.legend-title { 
  font-weight: 600; 
  font-size: 0.85rem; 
  margin-bottom: 8px; 
  border-bottom: 1px solid #e5e7eb; 
  padding-bottom: 4px; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
  color: #374151; 
}
.legend-item { 
  display: flex; 
  align-items: center; 
  font-size: 0.75rem; 
  font-weight: 500; 
  color: #4b5563; 
}
.legend-color-dot { 
  display: inline-block; 
  width: 12px; 
  height: 12px; 
  border-radius: 50%; 
  border: 1px solid #000000;
  flex-shrink: 0; 
}

:deep(.maplibregl-popup-content) { 
  color: #333333; 
  font-family: sans-serif; 
  padding: 10px 15px; 
  border-radius: 4px; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.2); 
}
</style>
