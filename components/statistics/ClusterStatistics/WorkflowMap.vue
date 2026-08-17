<!-- https://share.google/aimode/IEDC34UY5wY76q97l -->

<script setup>
import { ref, onMounted, getCurrentInstance, computed, watch, nextTick, onUnmounted } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import { useData } from 'vitepress';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

ModuleRegistry.registerModules([AllCommunityModule]);
const { isDark } = useData();
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;

const tabledata = ref([]);
const organisationsList = ref([]);
const selectedOrganisations = ref([]);
const MyColDefs1 = ref([]);
const gridApi1 = ref(null);
let map = null;
const basemapToggle = ref(true);
const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };
const currentTheme = computed(() => themeQuartz.withPart(isDark?.value ? colorSchemeDark : colorSchemeLight));

const DEFAULT_CENTER = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5.2;

// Sichert ab, dass von Anfang an alle Statuscodes aktiv sind
const visibleStatuses = ref([2, 3, 5, 7, 9]);

const styleOSM = {
  version: 8,
  sources: {
    'proxy-tiles-source': {
      type: 'raster',
      // for local development we use a local proxy to avoid CORS issues
      // tiles: ['http://localhost:8080/osm/{z}/{x}/{y}.png'],
      // for production we can use the official OSM tile server
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

const styleSatellite = {
  version: 8,
  sources: {
    'proxy-tiles-source': {
      type: 'raster',
      // for local development we use a local proxy to avoid CORS issues
      // tiles: ['http://localhost:8080/satellite/{z}/{y}/{x}.png'],
      // for production we can use the official satellite tile server
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

const filteredTableData = computed(() => {
  if (!visibleStatuses.value) return [];
  return tabledata.value.filter(r => visibleStatuses.value.includes(Number(r.wf)));
});

const mapGeoJson = computed(() => {
  const activeRows = filteredTableData.value || [];
  return {
    type: 'FeatureCollection',
    features: activeRows
      .filter(r => r && r.x !== null && r.x !== undefined && r.y !== null && r.y !== undefined)
      .map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(r.x), parseFloat(r.y)] },
        properties: { 
          cluster_name: r.cluster_name, plot_name: r.plot_name, wf: Number(r.wf), wf_text: r.wf_text,
          lil: r.lil || '-', responsible_administration: r.responsible_administration, troop_at: r.troop_at || '-', troop_kt: r.troop_kt || '-'
        }
      }))
  };
});

const gridHeight = computed(() => {
  const rows = Math.min(filteredTableData.value?.length ?? 0, 10) || 1;
  return `${Math.max(42 * rows + 80, 150)}px`;
});

function buildColDefs() {
  MyColDefs1.value = [
    { field: "lil", headerName: "Landesinventurleitung (LIL)", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Ecke", filter: "agNumberColumnFilter" },
    { field: "forest_status27", headerName: "Waldstatus 27", filter: "agNumberColumnFilter" },
    { field: "troop_at", headerName: "Aufnahmetrupp", filter: "agTextColumnFilter" },
    { field: "troop_kt", headerName: "Kontrolltrupp", filter: "agTextColumnFilter" },
    { field: "wf_text", headerName: "Waldentscheid Status", filter: "agTextColumnFilter" },
    { field: "wf", headerName: "Status Code", filter: "agNumberColumnFilter", hide: true },
    { field: "x", headerName: "X-Koordinate", filter: "agNumberColumnFilter", hide: true },
    { field: "y", headerName: "Y-Koordinate", filter: "agNumberColumnFilter", hide: true }
  ];
}

async function fetchRecordChangesInBatches(batchSize = 20000) {
  let allRecords = [];
  let from = 0;
  let to = batchSize - 1;
  let hasMore = true;
  if (!selectedOrganisations.value || selectedOrganisations.value.length === 0) { 
    tabledata.value = []; 
    nextTick(() => { onTableReady(); });
    return []; 
  }
  
  const ids = selectedOrganisations.value.join(','); // CSV list of org UUIDs
  // Build an OR‑filter that matches any of the four organisation‑type columns
  const orFilters = [
    `responsible_administration.in.(${ids})`,
    `responsible_state.in.(${ids})`,
    `responsible_provider.in.(${ids})`,
    `responsible_troop.in.(${ids})`
  ];
  console.log("Selected Orgs for batch fetch:", selectedOrganisations.value);
  console.log("Starting batch fetch from Supabase with batch size:", batchSize);

  try {
    while (hasMore) {
      // 1. Initialize query object (without await!)
      let query = supabase
        .from('v_stats_workflow_plot_map2')
        .select('cluster_name, plot_name, forest_status27, responsible_administration, troop_at, troop_kt, lil, responsible_state, responsible_provider, responsible_troop, wf, wf_text, x, y')
        .or(orFilters.join(','));

      // 2. Execute query with range
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      if (!data || data.length === 0) {
        if (hasMore === true) {
          console.warn("No data returned from Supabase, ending batch fetch.");
        }
        hasMore = false;
        break;
      }
      console.log(`Fetched batch: ${data.length} records (from ${from} to ${to})`);
      
      allRecords.push(...data);
      // Advance by the rows actually returned; the server may cap a batch
      // below batchSize (PGRST_DB_MAX_ROWS), so a short batch does not mean
      // the data is exhausted.
      from += data.length;
      to = from + batchSize - 1;
    }
    
    // Sort logic tailored to WorkflowMap table criteria
    allRecords.sort((a, b) => 
      String(a.responsible_administration || '').localeCompare(String(b.responsible_administration || '')) || 
      (a.cluster_name - b.cluster_name)
    );
    
    tabledata.value = allRecords;
    console.log("Total records fetched and sorted:", tabledata.value.length);
    
    nextTick(() => { onTableReady(); });
    return allRecords;
  } catch (err) { 
    console.error('Error fetching plot data:', err.message); 
    throw err; 
  }
}



async function _getOrganizations(userId) {
  const { data, error } = await supabase.from('users_permissions').select("*, organizations(*)").eq('user_id', userId);
  if (error) return console.error("Org Fetch Error:", error);
  organisationsList.value = data.filter(p => !p.organizations.deleted).map(item => ({ id: item.organizations.id, name: item.organizations.name }));
  if (organisationsList.value.length === 1) { selectedOrganisations.value = [organisationsList.value[0].id]; }
}

const activeClusterMarkers = ref([]);

async function initMap() {
  await nextTick();
  if (map) return;
  map = new maplibregl.Map({ 
    container: 'api-response-map', 
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
  });

  map.on('click', 'api-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties; // Korrekter Array-Zugriff aus der Vorlage
    const html = `<div class="p-1 text-xs space-y-1 font-sans">
      <div class="font-bold border-b pb-1 mb-1 text-sm text-gray-900">Plot: ${props.cluster_name}/${props.plot_name}</div>
      <div><strong>Status:</strong> ${props.wf_text}</div>
      <div><strong>LIL:</strong> ${props.lil}</div>
      <div><strong>Trupp AT:</strong> ${props.troop_at}</div>
      <div><strong>Trupp KT:</strong> ${props.troop_kt}</div>
    </div>`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  map.on('mouseenter', 'api-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'api-layer', () => { map.getCanvas().style.cursor = ''; });
}

function refreshMapLayers() {
  if (!map || !map.isStyleLoaded()) return;
  activeClusterMarkers.value.forEach(m => m.remove());
  activeClusterMarkers.value = [];

  if (map.getLayer('api-layer')) map.removeLayer('api-layer');
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

  map.addSource('api-data', { 
    type: 'geojson', data: mapGeoJson.value, cluster: true, clusterMaxZoom: 9, clusterRadius: 50,
    clusterProperties: {
      'count_9': ['+', ['case', ['==', ['get', 'wf'], 9], 1, 0]], 
      'count_7': ['+', ['case', ['==', ['get', 'wf'], 7], 1, 0]],
      'count_5': ['+', ['case', ['==', ['get', 'wf'], 5], 1, 0]], 
      'count_3': ['+', ['case', ['==', ['get', 'wf'], 3], 1, 0]],
      'count_2': ['+', ['case', ['==', ['get', 'wf'], 2], 1, 0]]
    }
  });

  map.addLayer({
    id: 'api-layer', type: 'circle', source: 'api-data', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 7,
      'circle-color': ['match', ['get', 'wf'], 9, '#16a34a', 7, '#2563eb', 3, '#ca8a04', 5, '#059669', 2, '#4b5563', '#dc2626'],
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1
    }
  });

  updateClusterPieCharts();
  map.off('render', updateClusterPieCharts);
  map.on('render', updateClusterPieCharts);
  
}

function updateClusterPieCharts() {
  if (!map || !map.getSource('api-data') || !map.isStyleLoaded()) return;
  if (!map.isSourceLoaded('api-data')) return;

  activeClusterMarkers.value.forEach(m => m.remove());
  activeClusterMarkers.value = [];

  const features = map.querySourceFeatures('api-data', { filter: ['has', 'point_count'] });
  const processedClusters = new Set();

  features.forEach(f => {
    const clusterId = f.properties.cluster_id;
    if (processedClusters.has(clusterId)) return;
    processedClusters.add(clusterId);

    const coords = f.geometry.coordinates;
    const activeFilterList = (visibleStatuses.value || []).map(id => Number(id));

    const slices = [
      { id: 9, count: Math.round(f.properties.count_9 || 0), color: '#dc2626' }, // FIX: BIL jetzt Rot
      { id: 7, count: Math.round(f.properties.count_7 || 0), color: '#2563eb' }, // LIL Blau
      { id: 5, count: Math.round(f.properties.count_5 || 0), color: '#059669' }, // KT Smaragd
      { id: 3, count: Math.round(f.properties.count_3 || 0), color: '#ca8a04' }, // AT Gelb
      { id: 2, count: Math.round(f.properties.count_2 || 0), color: '#4b5563' }  // Keine Grau
    ].filter(s => s.count > 0 && activeFilterList.includes(s.id));

    const currentClusterTotal = slices.reduce((sum, s) => sum + s.count, 0);
    if (currentClusterTotal === 0) return; 

    // Wir bauen das gesamte Diagramm inklusive Zahl in EINEM EINZIGEN SVG auf
    let svgHtml = `<svg width="44" height="44" viewBox="-22 -22 44 44" style="display: block; overflow: visible;">`;
    
    if (slices.length === 1) {
      // Vollkreis, falls nur eine Statusklasse im Trakt liegt
      svgHtml += `<circle cx="0" cy="0" r="20" fill="${slices[0].color}" stroke="#ffffff" stroke-width="2"/>`;
    } else {
      // Kreisbögen (um -90 Grad gedreht über das Transformations-Matrix-Prinzip)
      let cumulativeAngle = -90;
      
      slices.forEach(slice => {
        const angle = (slice.count / currentClusterTotal) * 360;
        
        const x1 = 20 * Math.cos((cumulativeAngle * Math.PI) / 180);
        const y1 = 20 * Math.sin((cumulativeAngle * Math.PI) / 180);
        
        cumulativeAngle += angle;
        
        const x2 = 20 * Math.cos((cumulativeAngle * Math.PI) / 180);
        const y2 = 20 * Math.sin((cumulativeAngle * Math.PI) / 180);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        svgHtml += `<path d="M 0 0 L ${x1} ${y1} A 20 20 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${slice.color}" stroke="#ffffff" stroke-width="1"/>`;
      });
    }

    // ULTIMATIVER FIX: Die Zahl wird nativ als SVG-Text-Element eingefügt.
    // dominant-baseline und text-anchor zwingen die Zahl unumstößlich in den mathematischen Mittelpunkt (0,0).
    // filter fügt einen perfekten, tiefschwarzen Schatteneffekt für maximale Lesbarkeit hinzu.
    svgHtml += `
      <filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.9"/></filter>
      <text x="0" y="0" 
            fill="#ffffff" 
            font-size="14px" 
            font-family="sans-serif" 
            font-weight="bold" 
            text-anchor="middle" 
            dominant-baseline="central"
            filter="url(#shadow)">
        ${currentClusterTotal}
      </text>
    </svg>`;

    // Das HTML-Element dient jetzt nur noch als schlanker Träger für die fertige Grafik
    const el = document.createElement('div');
    el.className = 'maplibre-pie-marker cursor-pointer';
    el.style.width = '44px';
    el.style.height = '44px';
    el.innerHTML = svgHtml;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      map.getSource('api-data').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({ center: coords, zoom: zoom + 0.8 });
      });
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(coords)
      .addTo(map);

    activeClusterMarkers.value.push(marker);
  });
}

function fitMapBounds() {
  if (!map) return;

  const validRows = (filteredTableData.value || []).filter(
    r => r && r.x !== null && r.x !== undefined && r.y !== null && r.y !== undefined && !isNaN(parseFloat(r.x)) && !isNaN(parseFloat(r.y))
  );

  if (validRows.length === 0) {
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 800 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  validRows.forEach(r => bounds.extend([parseFloat(r.x), parseFloat(r.y)]));
  map.fitBounds(bounds, { padding: 50, maxZoom: 13, duration: 800 });
}


onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) { 
    buildColDefs(); 
    await _getOrganizations(data.session.user.id); 
    // Removed duplicate fetchRecordChangesInBatches() call here.
    // The watcher on selectedOrganisations handles fetching automatically!
  }
  initMap();
});

onUnmounted(() => { activeClusterMarkers.value.forEach(m => m.remove()); if (map) map.remove(); });
watch(selectedOrganisations, () => { fetchRecordChangesInBatches(); });

function onFilterChanged() {
  if (!map || !map.getSource('api-data') || !gridApi1.value) return;
  const filteredRows = [];
  gridApi1.value.forEachNodeAfterFilter((node) => { if (node.data) filteredRows.push(node.data); });
  const filteredGeoJson = { type: 'FeatureCollection', features: filteredRows.filter(r => r.x && r.y).map(r => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [parseFloat(r.x), parseFloat(r.y)] }, properties: { cluster_name: r.cluster_name, plot_name: r.plot_name, wf: Number(r.wf), wf_text: r.wf_text, lil: r.lil || '-', responsible_administration: r.responsible_administration, troop_at: r.troop_at || '-', troop_kt: r.troop_kt || '-' } })) };
  
  map.getSource('api-data').setData(filteredGeoJson);
  updateClusterPieCharts();
  // FIX: fitMapBounds() hier entfernt, damit die Karte bei Tabellenfiltern nicht springt!
}

function onTableReady() { 
  if (map && map.isStyleLoaded()) { 
    if (map.getSource('api-data')) { 
      map.getSource('api-data').setData(mapGeoJson.value); 
      updateClusterPieCharts();
      fitMapBounds();
    } else { 
      refreshMapLayers(); 
      fitMapBounds();
    } 
  } 
}

watch(mapGeoJson, (newGeoJson) => { 
  if (map && map.isStyleLoaded()) { 
    if (map.getSource('api-data')) {
      map.getSource('api-data').setData(newGeoJson); 
      updateClusterPieCharts();
      fitMapBounds(); // Zoom/pan on data change or legend filter change
    } else {
      refreshMapLayers();
      fitMapBounds();
    }
  } 
}, { deep: true, immediate: false });

// ZUSÄTZLICHER SCHUTZ: Reagiert sofort, wenn eine Checkbox in der Legende angeklickt wird
watch(visibleStatuses, () => {
  if (map && map.isStyleLoaded() && map.getSource('api-data')) {
    // Erzwingt das sofortige Update der Kuchendiagramme auf dem Bildschirm
    updateClusterPieCharts();
  }
}, { deep: true });

watch(basemapToggle, () => { 
  if (!map) return; 
  map.setStyle(basemapToggle.value ? styleOSM : styleSatellite); 
  map.once('idle', () => { 
    if (!map || !map.isStyleLoaded()) return;
    refreshMapLayers(); 
    updateClusterPieCharts();
    map.off('render', updateClusterPieCharts);
    map.on('render', updateClusterPieCharts);
    // HIER WURDE FITMAPBOUNDS BEWUSST WEGGELASSEN -> Zoom bleibt eingefroren!
  }); 
});


function onGridReady1(params) { gridApi1.value = params.api; }
function onBtnExport1() { gridApi1.value?.exportDataAsCsv({ fileName: `Plots_Status_${new Date().toISOString().slice(0, 10)}.csv` }); }
</script>

<template>
  <v-card>
    <v-card-title>Organisationen auswählen:</v-card-title>
    <v-select v-model="selectedOrganisations" :items="organisationsList" item-title="name" item-value="id" multiple chips closable-chips :label="organisationsList.length > 1 ? 'Bitte auswählen...' : 'Organisation auswählen'" />
  </v-card>
  <v-card class="mt-4 map-card">
    <v-card-title class="d-flex justify-between align-center">Karte<v-switch v-model="basemapToggle" label="Satellit / Karte" class="ml-auto" hide-details inset color="primary" /></v-card-title>
    <div class="map-wrapper">
      <div id="api-response-map"></div>
      <div v-if="tabledata.length" class="map-legend shadow-lg border">
        <div class="legend-title">Workflow Status</div>
        <div class="legend-items space-y-2">
          <label class="legend-item cursor-pointer flex items-center select-none"><input type="checkbox" v-model="visibleStatuses" :value="9" class="mr-2 rounded accent-green" /> Akzeptiert von BIL (9)</label>
          <label class="legend-item cursor-pointer flex items-center select-none"><input type="checkbox" v-model="visibleStatuses" :value="7" class="mr-2 rounded accent-blue" /> Akzeptiert von LIL (7)</label>
          <label class="legend-item cursor-pointer flex items-center select-none"><input type="checkbox" v-model="visibleStatuses" :value="5" class="mr-2 rounded accent-emerald" /> Kontrolliert durch KT (5)</label>
          <label class="legend-item cursor-pointer flex items-center select-none"><input type="checkbox" v-model="visibleStatuses" :value="3" class="mr-2 rounded accent-yellow" /> Abgegeben von AT (3)</label>
          <label class="legend-item cursor-pointer flex items-center select-none"><input type="checkbox" v-model="visibleStatuses" :value="2" class="mr-2 rounded accent-gray" /> Nicht begonnen (2)</label>
        </div>
      </div>
    </div>
  </v-card>
  <v-card class="mt-4">
    <v-card-title>Ergebnis</v-card-title>
    <ag-grid-vue 
      v-show="selectedOrganisations.length && filteredTableData.length" 
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
      @first-data-rendered="onTableReady" 
      @model-updated="onTableReady" 
    />
    <v-card-text v-show="!selectedOrganisations.length || !filteredTableData.length" class="text-center text-grey italic">Keine Daten verfügbar. Bitte Auswahl ändern.</v-card-text> 
    <v-btn color="primary" prepend-icon="mdi-download" @click="onBtnExport1" :disabled="!filteredTableData.length" class="ma-2">CSV Export</v-btn>
  </v-card>
</template>

<style scoped>
.map-card { width: 100%; }
.map-wrapper { position: relative; width: 100%; height: 600px; }
#api-response-map { width: 100%; height: 100%; }
.map-legend { position: absolute; bottom: 24px; right: 12px; z-index: 10; background-color: #ffffff !important; color: #1f2937 !important; padding: 12px; border-radius: 8px; font-family: sans-serif; min-width: 220px; border: 1px solid #e5e7eb !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; }
.legend-title { font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; }
.legend-item { display: flex; align-items: center; font-size: 0.75rem; font-weight: 500; color: #4b5563; }

.accent-green { accent-color: #dc2626; } 
.accent-blue { accent-color: #2563eb; } 
.accent-emerald { accent-color: #059669; } 
.accent-yellow { accent-color: #ca8a04; } 
.accent-gray { accent-color: #4b5563; }

:deep(.maplibregl-popup-content) { color: #333333; font-family: sans-serif; padding: 10px 15px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
</style>


