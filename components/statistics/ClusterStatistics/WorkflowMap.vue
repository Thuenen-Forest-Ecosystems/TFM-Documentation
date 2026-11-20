<script setup>
// ──────────────────────────────────────────────────────────────────────────────
// 1️⃣ Component meta‑information (JSDoc)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @component WorkflowMap
 * @description Interaktive Karten- und Tabellenansicht des Workflow-Status von Traktecken.
 *
 * Datenquelle:
 * - PostgreSQL RPC-Funktion `stat_workflow_per_plot(user_id text)`
 *   (definiert in 20261118190000_stat_workflow_per_plot.sql).
 *
 * Funktionsweise:
 * - Auswahl einer Organisation oder eines Aufnahmetrupps über <OrganizationSelect />.
 * - Datenabruf direkt über `supabase.rpc('stat_workflow_per_plot', { user_id })`.
 * - Automatische Datumstransformation: Gauss-Krüger (DHDN / Bessel 1841) zu WGS84 (EPSG:4326).
 * - Robuste Validierung: Ungültige Koordinaten (z.B. [0,0]) werden herausgefiltert.
 * - Visualisierung über MapLibre GL mit dynamischen SVG-Kuchendiagrammen (Cluster Pie Charts)
 *   je Trakt sowie Einzeldarstellung bei hohem Zoom.
 * - Legenden-sensitives Kartenausschnitt-Fitting (fitBounds) optimiert für Breitbildschirme.
 * - Tabellarische Detaildarstellung über AG Grid mit Filterung, Sortierung und CSV-Export.
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
 * Liefert die HEX-Farbe für einen gegebenen numerischen Workflow-Code.
 * Farbkonzept orientiert sich an den Inventur-Rollen:
 * - BIL / Plausibilisierung / Archivierung: Dunkelrot / Dunkelgrün
 * - LIL (Landesinventurleitung): Blau
 * - KT (Kontrolltrupp): Smaragdgrün / Türkis
 * - AT (Aufnahmetrupp): Bernstein / Gelb
 * - Vorarbeiten: Grau
 *
 * @param {number|string} code - Numerischer Workflow-Code
 * @returns {string} Farbwert im Hex-Format
 */
function getStatusColor(code) {
  switch (Number(code)) {
    case 70: return '#15803d'; // Dunkelgrün (Archivierung)
    case 60: return '#dc2626'; // Rot (Plausibilisierung BIL)
    case 50: return '#2563eb'; // Blau (Prüfung LIL)
    case 44: return '#047857'; // Smaragd dunkel (Feldkontrolle nach KT)
    case 43: return '#059669'; // Smaragd (Feldkontrolle nach AT)
    case 42: return '#0d9488'; // Türkis (Korrektur im Feld KT)
    case 41: return '#10b981'; // Grün (Kontrolle im Feld KT)
    case 32: return '#d97706'; // Bernstein (Korrektur im Feld AT)
    case 31: return '#ca8a04'; // Gelb (Aufnahme im Feld AT)
    case 20: return '#6b7280'; // Grau (Vorarbeiten LIL)
    case 10: return '#4b5563'; // Dunkelgrau (Vorarbeiten BIL)
    case 9:  return '#dc2626'; // Legacy-Status
    case 7:  return '#2563eb';
    case 5:  return '#059669';
    case 3:  return '#ca8a04';
    case 2:  return '#4b5563';
    default: return '#64748b';
  }
}

/**
 * Prüft, ob gegebene WGS84-Koordinaten im plausiblen Bereich für Deutschland liegen.
 * Schließt insbesondere Null-Insel-Koordinaten (0,0) und ungültige Werte aus.
 *
 * @param {number|string} lon - Längengrad (WGS84)
 * @param {number|string} lat - Breitengrad (WGS84)
 * @returns {boolean}
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
 * Liegen die Koordinaten bereits als Längen- und Breitengrad vor, werden sie unverändert zurückgegeben.
 *
 * @param {number} rw - Rechtswert / cartesian_x
 * @param {number} hw - Hochwert / cartesian_y
 * @returns {[number|null, number|null]} [Longitude, Latitude] in WGS84
 */
function gkToWgs84(rw, hw) {
  if (rw == null || hw == null || isNaN(rw) || isNaN(hw)) return [null, null];
  // Dummy- oder Null-Koordinaten ausschließen
  if (Math.abs(rw) < 0.001 && Math.abs(hw) < 0.001) return [null, null];
  
  // Falls bereits WGS84 im Bereich von Deutschland
  if (rw >= 5.0 && rw <= 16.0 && hw >= 46.5 && hw <= 56.0) return [rw, hw];

  // Parameter des Bessel-1841-Ellipsoids
  const a = 6377397.155;
  const f = 1 / 299.1528128;
  const e2 = 2 * f - f * f;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  // Meridianstreifen ermitteln (Kennziffer 2-5 -> 6°, 9°, 12°, 15°)
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

  // Geografische Breite und Länge auf dem Bessel-Ellipsoid
  const latBessel = phi1 - (n1 * Math.tan(phi1) / r1) * (d*d/2 - (5 + 3*t1 + 10*c1 - 4*c1*c1 - 9*(e2/(1-e2)))*d*d*d*d/24 + (61 + 90*t1 + 298*c1 + 45*t1*t1 - 252*(e2/(1-e2)) - 3*c1*c1)*d*d*d*d*d*d/720);
  const lonBessel = (l0 * Math.PI / 180) + (d - (1 + 2*t1 + c1)*d*d*d/6 + (5 - 2*c1 + 28*t1 - 3*c1*c1 + 8*(e2/(1-e2)) + 24*t1*t1)*d*d*d*d*d/120) / Math.cos(phi1);

  // Kartesische Koordinaten (Bessel)
  const N = a / Math.sqrt(1 - e2 * Math.sin(latBessel)*Math.sin(latBessel));
  const cartX = N * Math.cos(latBessel) * Math.cos(lonBessel);
  const cartY = N * Math.cos(latBessel) * Math.sin(lonBessel);
  const cartZ = N * (1 - e2) * Math.sin(latBessel);

  // Helmert 7-Parameter Datumstransformation DHDN (Potsdam) -> WGS84
  const dx = 598.1, dy = 73.7, dz = 418.2;
  const rx = 0.202 * Math.PI / (180 * 3600);
  const ry = 0.045 * Math.PI / (180 * 3600);
  const rz = -2.455 * Math.PI / (180 * 3600);
  const s = 6.7e-6;

  const wX = (1 + s) * cartX - rz * cartY + ry * cartZ + dx;
  const wY = rz * cartX + (1 + s) * cartY - rx * cartZ + dy;
  const wZ = -ry * cartX + rx * cartY + (1 + s) * cartZ + dz;

  // WGS84 Ellipsoid-Parameter
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
const activeClusterMarkers = ref([]);    // Aktive DOM-Marker für die Cluster-Pie-Charts
const visibleStatuses = ref([]);         // Statuscodes, die in Karte und Tabelle sichtbar sein sollen

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ Berechnete Eigenschaften (Computed Properties)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Ermittelt dynamisch alle in den geladenen Daten vorkommenden Workflow-Statuscodes
 * inklusive ihrer Beschriftung und Anzahl für die Legenden-Checkboxen.
 */
const availableStatuses = computed(() => {
  const mapObj = new Map();
  tabledata.value.forEach(r => {
    const code = Number(r.workflow_code ?? r.wf);
    const text = r.workflow_code_text || r.wf_text || `Status ${code}`;
    if (!mapObj.has(code)) {
      mapObj.set(code, { code, text, count: 0 });
    }
    mapObj.get(code).count++;
  });
  return Array.from(mapObj.values()).sort((a, b) => b.code - a.code);
});

/**
 * Filtert die Tabelle basierend auf den in der Legende aktivierten Statuscodes.
 */
const filteredTableData = computed(() => {
  if (!visibleStatuses.value || visibleStatuses.value.length === 0) return [];
  return tabledata.value.filter(r => visibleStatuses.value.includes(Number(r.wf)));
});

/**
 * Generiert das GeoJSON FeatureCollection-Objekt für MapLibre GL
 * aus den gefilterten Tabellendaten. Ungültige Koordinaten werden verworfen.
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
          wf: Number(r.wf),
          wf_text: r.wf_text,
          lil: r.lil || '-',
          troop_name: r.troop_name || '-',
          kt: r.kt,
          abgabedatum: r.abgabedatum
        }
      }))
  };
});

/**
 * Berechnet die Tabellenhöhe dynamisch anhand der Anzahl sichtbarer Zeilen.
 */
const gridHeight = computed(() => {
  const rows = Math.min(filteredTableData.value?.length ?? 0, 10) || 1;
  return `${Math.max(42 * rows + 80, 150)}px`;
});

// ──────────────────────────────────────────────────────────────────────────────
// 7️⃣ Spaltendefinitionen & Datenabruf (RPC)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Definiert die Spalten der AG Grid Ergebnistabelle.
 */
function buildColDefs() {
  MyColDefs1.value = [
    { field: "lil", headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Traktecke", filter: "agNumberColumnFilter" },
    { field: "troop_name", headerName: "Trupp", filter: "agTextColumnFilter" },
    { field: "kt", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "abgabedatum", headerName: "Abgabedatum", filter: "agDateColumnFilter" },
    { field: "workflow_code_text", headerName: "Workflow-Status", filter: "agTextColumnFilter" },
    { field: "workflow_code", headerName: "Status-Code", filter: "agNumberColumnFilter" },
    { field: "cartesian_x", headerName: "X-Koordinate", filter: "agNumberColumnFilter", hide: true },
    { field: "cartesian_y", headerName: "Y-Koordinate", filter: "agNumberColumnFilter", hide: true }
  ];
}

/**
 * Führt die RPC-Funktion `stat_workflow_per_plot` für die ausgewählte Organisation aus
 * und bereitet die empfangenen Datensätze für Karte und Tabelle auf.
 */
async function fetchWorkflowPlots() {
  if (!selectedOrganisation.value) { 
    tabledata.value = []; 
    dataloaded.value = 0;
    return []; 
  }
  
  dataload.value = true;
  dataloaded.value = 0;

  try {
    const { data, error } = await supabase.rpc('stat_workflow_per_plot', {
      user_id: selectedOrganisation.value
    });

    if (error) throw error;

    const records = data || [];
    dataloaded.value = records.length;
    
    // Datensätze formatieren und Koordinaten von GK nach WGS84 transformieren
    const formatted = records.map(r => {
      const cx = parseFloat(r.cartesian_x);
      const cy = parseFloat(r.cartesian_y);
      const [lon, lat] = gkToWgs84(cx, cy);

      return {
        ...r,
        lil: r.landesinventurleitung || r.lil,
        landesinventurleitung: r.landesinventurleitung || r.lil,
        troop_name: r.troop_name,
        kt: r.kontrolltrupp ?? r.kt,
        kontrolltrupp: r.kontrolltrupp ?? r.kt,
        abgabedatum: r.abgabedatum || r.completed_at_survey_troop,
        workflow_code: Number(r.workflow_code),
        workflow_code_text: r.workflow_code_text,
        wf: Number(r.workflow_code),
        wf_text: r.workflow_code_text,
        cartesian_x: cx,
        cartesian_y: cy,
        x: lon,
        y: lat
      };
    });

    tabledata.value = formatted;
    // Standardmäßig alle im Datensatz vorkommenden Statuscodes aktivieren
    visibleStatuses.value = Array.from(new Set(formatted.map(r => r.wf))).sort((a, b) => b - a);

    return formatted;
  } catch (err) { 
    console.error('Error fetching stat_workflow_per_plot:', err); 
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
// 8️⃣ MapLibre GL Karten-Initialisierung & Cluster-Visualisierung
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Initialisiert die MapLibre-Karte, Kachelquellen und Klick-/Hover-Interaktionen.
 */
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
    fitMapBounds({ immediate: true });
  });

  // Klick-Popup auf ungeclusterte Einzelpunkte
  map.on('click', 'api-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    const datum = props.abgabedatum ? new Date(props.abgabedatum).toLocaleDateString('de-DE') : '-';
    const html = `<div class="p-1 text-xs space-y-1 font-sans">
      <div class="font-bold border-b pb-1 mb-1 text-sm text-gray-900">Trakt/Ecke: ${props.cluster_name}/${props.plot_name}</div>
      <div><strong>Status:</strong> ${props.wf_text} (${props.wf})</div>
      <div><strong>LIL:</strong> ${props.lil}</div>
      <div><strong>Trupp:</strong> ${props.troop_name}</div>
      <div><strong>Kontrolltrupp:</strong> ${props.kt ? 'Ja' : 'Nein'}</div>
      <div><strong>Abgabedatum:</strong> ${datum}</div>
    </div>`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  map.on('mouseenter', 'api-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'api-layer', () => { map.getCanvas().style.cursor = ''; });
}

/**
 * Baut die GeoJSON-Quelle und die Karten-Layer auf.
 * Beinhaltet Clustering-Eigenschaften für alle bekannten Workflow-Codes.
 */
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

  // GeoJSON-Quelle mit Cluster-Zählern je Statuscode
  map.addSource('api-data', { 
    type: 'geojson', data: mapGeoJson.value, cluster: true, clusterMaxZoom: 9, clusterRadius: 50,
    clusterProperties: {
      'count_70': ['+', ['case', ['==', ['get', 'wf'], 70], 1, 0]],
      'count_60': ['+', ['case', ['==', ['get', 'wf'], 60], 1, 0]],
      'count_50': ['+', ['case', ['==', ['get', 'wf'], 50], 1, 0]],
      'count_44': ['+', ['case', ['==', ['get', 'wf'], 44], 1, 0]],
      'count_43': ['+', ['case', ['==', ['get', 'wf'], 43], 1, 0]],
      'count_42': ['+', ['case', ['==', ['get', 'wf'], 42], 1, 0]],
      'count_41': ['+', ['case', ['==', ['get', 'wf'], 41], 1, 0]],
      'count_32': ['+', ['case', ['==', ['get', 'wf'], 32], 1, 0]],
      'count_31': ['+', ['case', ['==', ['get', 'wf'], 31], 1, 0]],
      'count_20': ['+', ['case', ['==', ['get', 'wf'], 20], 1, 0]],
      'count_10': ['+', ['case', ['==', ['get', 'wf'], 10], 1, 0]],
      'count_9':  ['+', ['case', ['==', ['get', 'wf'], 9], 1, 0]],
      'count_7':  ['+', ['case', ['==', ['get', 'wf'], 7], 1, 0]],
      'count_5':  ['+', ['case', ['==', ['get', 'wf'], 5], 1, 0]],
      'count_3':  ['+', ['case', ['==', ['get', 'wf'], 3], 1, 0]],
      'count_2':  ['+', ['case', ['==', ['get', 'wf'], 2], 1, 0]]
    }
  });

  // Punktebene für ungeclusterte Einzelpunkte (z.B. bei hohem Zoom)
  map.addLayer({
    id: 'api-layer', type: 'circle', source: 'api-data', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 7,
      'circle-color': [
        'match', ['get', 'wf'],
        70, '#15803d',
        60, '#dc2626',
        50, '#2563eb',
        44, '#047857',
        43, '#059669',
        42, '#0d9488',
        41, '#10b981',
        32, '#d97706',
        31, '#ca8a04',
        20, '#6b7280',
        10, '#4b5563',
        9,  '#dc2626',
        7,  '#2563eb',
        5,  '#059669',
        3,  '#ca8a04',
        2,  '#4b5563',
        '#64748b'
      ],
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1
    }
  });

  updateClusterPieCharts();
  map.off('render', updateClusterPieCharts);
  map.on('render', updateClusterPieCharts);
}

/**
 * Erzeugt für geclusterte Trakt-Punkte dynamische SVG-Kuchendiagramme (Pie Charts)
 * mit Tortenstücken je Statusklasse und zentrierter Gesamtanzahl.
 */
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

    const allPossibleCodes = [70, 60, 50, 44, 43, 42, 41, 32, 31, 20, 10, 9, 7, 5, 3, 2];
    const slices = allPossibleCodes
      .map(code => ({
        id: code,
        count: Math.round(f.properties[`count_${code}`] || 0),
        color: getStatusColor(code)
      }))
      .filter(s => s.count > 0 && activeFilterList.includes(s.id));

    const currentClusterTotal = slices.reduce((sum, s) => sum + s.count, 0);
    if (currentClusterTotal === 0) return; 

    // SVG-Kuchendiagramm inklusive zentrierter Ziffer rendern
    let svgHtml = `<svg width="44" height="44" viewBox="-22 -22 44 44" style="display: block; overflow: visible;">`;
    
    if (slices.length === 1) {
      svgHtml += `<circle cx="0" cy="0" r="20" fill="${slices[0].color}" stroke="#ffffff" stroke-width="2"/>`;
    } else {
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

    const el = document.createElement('div');
    el.className = 'maplibre-pie-marker cursor-pointer';
    el.style.width = '44px';
    el.style.height = '44px';
    el.innerHTML = svgHtml;

    // Klick auf Cluster zoomt direkt in den entsprechenden Trakt
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

/**
 * Passt den Kartenausschnitt automatisch an die Ausdehnung der sichtbaren Punkte an.
 * Berücksichtigt auf Breitbildschirmen die schwebende Legende auf der rechten Seite.
 *
 * @param {Object} [options]
 * @param {boolean} [options.immediate=false] - Animation überspringen?
 */
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

  // Dynamisches Padding: Berücksichtigt die Legende auf der rechten Seite (min. 220px)
  const containerWidth = map.getContainer()?.offsetWidth || 1000;
  const rightPadding = containerWidth > 800 ? 260 : 40;

  map.fitBounds(bounds, {
    padding: { top: 50, bottom: 50, left: 50, right: rightPadding },
    maxZoom: 12,
    duration: options.immediate ? 0 : 600
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// 9️⃣ Lifecycle Hooks, Watcher & Tabellen-Events
// ──────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  buildColDefs();
  await initMap();

  // ResizeObserver überwacht den Kartencontainer und passt das Map-Canvas automatisch an
  const container = document.getElementById('api-response-map');
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
  activeClusterMarkers.value.forEach(m => m.remove()); 
  if (map) map.remove(); 
});

// Bei Änderung der Organisationsauswahl Daten neu laden
watch(selectedOrganisation, () => { 
  fetchWorkflowPlots(); 
});

/**
 * Synchronisiert Filterungen der AG Grid Tabelle mit der Kartendarstellung.
 */
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
          wf: Number(r.wf), 
          wf_text: r.wf_text, 
          lil: r.lil || '-', 
          troop_name: r.troop_name || '-', 
          kt: r.kt, 
          abgabedatum: r.abgabedatum 
        } 
      })) 
  };
  
  map.getSource('api-data').setData(filteredGeoJson);
  updateClusterPieCharts();
}

// Beobachtet Änderungen an den GeoJSON-Daten und aktualisiert die Karte
watch(mapGeoJson, (newGeoJson) => { 
  if (map && map.isStyleLoaded()) { 
    if (map.getSource('api-data')) {
      map.getSource('api-data').setData(newGeoJson); 
      updateClusterPieCharts();
    } else {
      refreshMapLayers();
    }
  } 
}, { deep: true, immediate: false });

// Aktualisiert Cluster-Diagramme bei Umschaltung der Status-Filter
watch(visibleStatuses, () => {
  if (map && map.isStyleLoaded() && map.getSource('api-data')) {
    updateClusterPieCharts();
  }
}, { deep: true });

// Schaltet zwischen Basiskarte (OSM) und Satellitenbildern um
watch(basemapToggle, () => { 
  if (!map) return; 
  map.setStyle(basemapToggle.value ? styleOSM : styleSatellite); 
  map.once('idle', () => { 
    if (!map || !map.isStyleLoaded()) return;
    refreshMapLayers(); 
    updateClusterPieCharts();
    map.off('render', updateClusterPieCharts);
    map.on('render', updateClusterPieCharts);
  }); 
});

function onGridReady1(params) { gridApi1.value = params.api; }

function onOrgsLoaded(res) {
  organisationsList.value = res?.organisationsList || [];
}
</script>

<template>
  <!-- Organisationsauswahl (einheitliche Komponente aller Statistikseiten) -->
  <OrganizationSelect
    v-model="selectedOrganisation"
    @loaded="onOrgsLoaded"
  />

  <!-- Ladeanzeige bei aktivem Datenabruf -->
  <v-card v-if="dataload === true" class="mt-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze geladen...)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <!-- Kartenansicht mit Kartenschalter und Statuslegende -->
  <v-card v-show="selectedOrganisation" class="mt-4 map-card">
    <v-card-title class="d-flex justify-between align-center">
      Karte
      <v-switch v-model="basemapToggle" label="Satellit / Karte" class="ml-auto" hide-details inset color="primary" />
    </v-card-title>
    <div class="map-wrapper">
      <div id="api-response-map"></div>
      
      <!-- Interaktive Statuslegende mit Checkboxen -->
      <div v-if="tabledata.length && availableStatuses.length" class="map-legend shadow-lg border">
        <div class="legend-title">Workflow Status</div>
        <div class="legend-items space-y-2">
          <label 
            v-for="status in availableStatuses" 
            :key="status.code" 
            class="legend-item cursor-pointer flex items-center select-none"
          >
            <input 
              type="checkbox" 
              v-model="visibleStatuses" 
              :value="status.code" 
              class="mr-2 rounded" 
              :style="{ accentColor: getStatusColor(status.code) }" 
            />
            <span class="legend-color-dot mr-1" :style="{ backgroundColor: getStatusColor(status.code) }"></span>
            {{ status.text }} ({{ status.code }})
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
        filename-prefix="Plots_Workflow_Status"
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

/* Responsive Höhe: Auf breiten Bildschirmen passt sich die Karte vertikal dynamisch an */
.map-wrapper { 
  position: relative; 
  width: 100%; 
  height: clamp(550px, 62vh, 850px); 
}
#api-response-map { width: 100%; height: 100%; }

/* Styling der schwebenden Legende auf der Karte */
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
  max-height: 400px; 
  overflow-y: auto; 
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
  width: 10px; 
  height: 10px; 
  border-radius: 50%; 
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
