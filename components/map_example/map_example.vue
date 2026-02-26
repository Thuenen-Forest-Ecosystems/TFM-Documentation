<script setup>
/**
 * MapExample.vue
 * Interaktive Karte zur Visualisierung von BWI-Daten (Bäume & Totholz)
 * Nutzt MapLibre GL für die Karte und Supabase für die Sachdaten.
 */
import { ref, onMounted, onUnmounted, watch, computed, getCurrentInstance } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { isDark } from '../../.vitepress/theme/composables/useGlobalTheme'

// --- State ---
const activeGridProperties = ref(null)    // Metadaten der angeklickten Gitterzelle (WMS)
const inventoryArchiveData = ref(null)    // Sachdaten aus der Datenbank (Supabase)
const isFetching = ref(false)             // Globaler Ladezustand
const treeStatusLookup = ref({})          // Mapping von Status-Codes auf Klartext
const filterInterval = ref(null)          // Filter: Inventur-Intervall
const filterStatus = ref(null)            // Filter: Baum-Status

let map = null
let supabase = null

const WMS_URL = 'https://fnews-access.bwi.info/geoserver/fnews_test/wms'

// --- Konstanten & Definitionen ---
const tableHeaders = [
  { title: 'Typ', key: 'type' },
  { title: 'Intervall', key: 'interval' },
  { title: 'Plot', key: 'plot' },
  { title: 'Nr/ID', key: 'display_id' },
  { title: 'Art', key: 'species' },
  { title: 'Ø BHD/Durchm (mm)', key: 'diameter' },
  { title: 'Status', key: 'status_text' }
]

// --- Computed Properties (Logik) ---

/**
 * Berechnet aggregierte Statistiken für Bäume und Totholz basierend auf den aktiven Filtern.
 */
const statistics = computed(() => {
  const data = inventoryArchiveData.value
  if (!data || !data.length) return null
  
  const stats = {
    tree: { count: 0, dbhSum: 0, heightSum: 0, dbhValid: 0, heightValid: 0 },
    deadwood: { count: 0, diameterSum: 0, diameterValid: 0 }
  }

  data.forEach(cluster => {
    cluster.plot?.forEach(plot => {
      // Intervall-Filter prüfen
      if (filterInterval.value && plot.interval_name !== filterInterval.value) return

      // Bäume verarbeiten
      plot.tree?.forEach(tree => {
        if (filterStatus.value != null && tree.tree_status != filterStatus.value) return
        stats.tree.count++
        if (tree.dbh) { stats.tree.dbhSum += parseFloat(tree.dbh); stats.tree.dbhValid++ }
        if (tree.tree_height) { stats.tree.heightSum += parseFloat(tree.tree_height); stats.tree.heightValid++ }
      })

      // Totholz verarbeiten
      plot.deadwood?.forEach(dw => {
        stats.deadwood.count++
        const d1 = parseFloat(dw.diameter_at_smaller_end || 0)
        const d2 = parseFloat(dw.diameter_at_thicker_end || 0)
        if (d1 > 0 || d2 > 0) {
          stats.deadwood.diameterSum += d1 > 0 && d2 > 0 ? (d1 + d2) / 2 : (d1 || d2)
          stats.deadwood.diameterValid++
        }
      })
    })
  })

  if (stats.tree.count === 0 && stats.deadwood.count === 0 && !data.length) return null

  return {
    treeCount: stats.tree.count,
    avgDbh: stats.tree.dbhValid ? (stats.tree.dbhSum / stats.tree.dbhValid / 10).toFixed(1) : '0',
    avgHeight: stats.tree.heightValid ? (stats.tree.heightSum / stats.tree.heightValid / 10).toFixed(1) : '0',
    deadwoodCount: stats.deadwood.count,
    avgDeadwoodDia: stats.deadwood.diameterValid ? (stats.deadwood.diameterSum / stats.deadwood.diameterValid / 10).toFixed(1) : '0'
  }
})

/**
 * Generiert die Optionen für die Filter-Dropdowns aus den geladenen Daten.
 */
const filterOptions = computed(() => {
  const intervals = new Set()
  const statuses = new Set()
  inventoryArchiveData.value?.forEach(c => {
    c.plot?.forEach(p => {
      if (p.interval_name) intervals.add(p.interval_name)
      p.tree?.forEach(t => { if (t.tree_status != null) statuses.add(t.tree_status) })
    })
  })
  return {
    intervals: Array.from(intervals).sort(),
    statuses: Array.from(statuses).sort((a, b) => a - b).map(code => ({
      title: treeStatusLookup.value[code] || `Code ${code}`,
      value: code
    }))
  }
})

/**
 * Kombiniert Bäume und Totholz in eine flache Liste für die Datentabelle.
 */
const tableData = computed(() => {
  const list = []
  inventoryArchiveData.value?.forEach(c => {
    c.plot?.forEach(p => {
      if (filterInterval.value && p.interval_name !== filterInterval.value) return
      
      // Bäume
      p.tree?.forEach(t => {
        if (filterStatus.value != null && t.tree_status != filterStatus.value) return
        list.push({ 
          type: 'Baum',
          interval: p.interval_name, 
          plot: p.plot_name || p.id, 
          display_id: t.tree_no,
          species: t.tree_species,
          diameter: t.dbh,
          status_text: treeStatusLookup.value[t.tree_status] || `Code ${t.tree_status}` 
        })
      })

      // Totholz (nur anzeigen, wenn kein spezifischer Baum-Status gefiltert wird)
      if (filterStatus.value == null) {
        p.deadwood?.forEach(dw => {
          list.push({
            type: 'Totholz',
            interval: p.interval_name,
            plot: p.plot_name || p.id,
            display_id: dw.id_deadwood || '-',
            species: dw.deadwood_species || '-',
            diameter: dw.diameter_at_smaller_end ? (parseFloat(dw.diameter_at_smaller_end) + parseFloat(dw.diameter_at_thicker_end || dw.diameter_at_smaller_end)) / 2 : '-',
            status_text: 'Totholz'
          })
        })
      }
    })
  })
  return list
})

/**
 * Ermittelt den forstlichen Zustand (Landnutzung), falls keine Bäume vorhanden sind.
 * Prüft dabei auch, ob in anderen Zeiträumen Bäume vorhanden waren.
 */
const forestState = computed(() => {
  const data = inventoryArchiveData.value
  if (!data || !data.length) return null
  
  // Den aktuell ausgewählten Plot finden
  const currentPlot = data[0].plot?.find(p => p.interval_name === filterInterval.value) || data[0].plot?.[0]
  if (!currentPlot) return null

  // Prüfen, ob in IRGENDEINEM Zeitraum Bäume vorhanden waren
  const hasTreesEver = data.some(cluster => 
    cluster.plot?.some(plot => plot.tree && plot.tree.length > 0)
  )

  const landUse = currentPlot.land_use_name || 'Wald'
  let explanation = ''

  if (hasTreesEver) {
    explanation = `Für das gewählte Intervall (${filterInterval.value}) wurden keine messbaren Bäume (BHD ≥ 7cm) erfasst. In anderen Inventur-Zeiträumen sind jedoch Bestandsdaten für diese Zelle vorhanden.`
  } else {
    if (landUse.toLowerCase().includes('wald') || landUse.toLowerCase().includes('holz')) {
      explanation = 'In dieser Zelle ist Wald verzeichnet, jedoch wurden über alle verfügbaren Inventurzeiträume hinweg keine Bäume mit einem BHD über 7 cm gemessen. Dies deutet auf dauerhafte Verjüngungsflächen oder Waldblößen hin.'
    } else {
      explanation = 'Diese Gitterzelle ist laut Inventur keinem klassischen Holzboden zugeordnet (z.B. Waldwege oder Nichtholzboden).'
    }
  }

  return { label: landUse, explanation }
})

// --- Funktionen ---

/**
 * Ruft Informationen vom WMS-Layer für einen Klickpunkt ab (GetFeatureInfo).
 */
async function fetchWmsFeatureInfo(point) {
  const canvas = map.getCanvas()
  const bounds = map.getBounds()
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',')
  
  const params = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetFeatureInfo', 
    layers: 'fnews_test:LAEA1km_bwi', query_layers: 'fnews_test:LAEA1km_bwi',
    bbox: bbox, width: canvas.width, height: canvas.height, srs: 'EPSG:4326', info_format: 'application/json',
    x: Math.round(point.x * (canvas.width / canvas.clientWidth)), 
    y: Math.round(point.y * (canvas.height / canvas.clientHeight)),
    feature_count: 1
  })

  const resp = await fetch(`${WMS_URL}?${params.toString()}`)
  return await resp.json()
}

/**
 * Ruft die Sachdaten (Inventur-Archiv) für eine Gitterzelle über Supabase ab.
 */
async function fetchInventoryData(gridId) {
  const { data, error } = await supabase
    .schema('inventory_archive')
    .from('cluster')
    .select('*,plot!plot_cluster_id_fkey(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))')
    .eq('inspire_grid_cell', gridId)
  
  if (error) throw error
  return data
}

/**
 * Setzt alle Daten und Filter zurück.
 */
function resetSelection() {
  activeGridProperties.value = null
  inventoryArchiveData.value = null
  filterInterval.value = null
  filterStatus.value = null
}

const getBasemapUrl = () => isDark.value ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const updateBasemap = () => {
  if (!map) return
  const source = map.getSource('osm-source')
  if (source) source.setTiles([getBasemapUrl()])
}

watch(isDark, updateBasemap)

// --- Lifecycle ---

onMounted(async () => {
  const instance = getCurrentInstance()
  supabase = instance.appContext.config.globalProperties.$supabase

  // 1. Baum-Status Lookup laden
  try {
    const { data, error } = await supabase.schema('lookup').from('lookup_tree_status').select('code, name_de')
    if (error) throw error
    data.forEach(item => { treeStatusLookup.value[item.code] = item.name_de })
  } catch (err) { console.error('Lookup konnte nicht geladen werden:', err) }

  // 2. MapLibre initialisieren
  map = new maplibregl.Map({
    container: 'map-container',
    style: {
      version: 8,
      sources: {
        'osm-source': { type: 'raster', tiles: [getBasemapUrl()], tileSize: 256, attribution: '© OpenStreetMap' },
        'thuenen-gitter-source': {
          type: 'raster',
          tiles: [`${WMS_URL}?service=WMS&version=1.1.1&request=GetMap&layers=fnews_test:LAEA1km_bwi&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true&tiled=true`],
          tileSize: 256
        }
      },
      layers: [
        { id: 'osm-layer', type: 'raster', source: 'osm-source' },
        { id: 'thuenen-gitter-layer', type: 'raster', source: 'thuenen-gitter-source', paint: { 'raster-opacity': 0.6 } }
      ]
    },
    center: [10.4515, 51.1657],
    zoom: 5
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-left')

  // Map-Klick Event
  map.on('click', async (e) => {
    isFetching.value = true
    resetSelection()

    try {
      const wmsData = await fetchWmsFeatureInfo(e.point)
      
      if (wmsData.features?.length > 0) {
        const props = wmsData.features[0].properties
        activeGridProperties.value = props
        
        const gridId = props.ID_1km || props.id_1km || props.id || props.gitter_id_1km
        const data = await fetchInventoryData(gridId)
        
        inventoryArchiveData.value = data
        
        // Initialen Intervall-Filter auf das aktuellste Jahr setzen
        if (data.length > 0) {
          const years = Array.from(new Set(data.flatMap(c => c.plot?.map(p => p.interval_name) || []))).sort()
          if (years.length > 0) filterInterval.value = years[years.length - 1]
        }
      }
    } catch (err) { 
      console.error('Fehler beim Abrufen der Daten:', err) 
    } finally {
      isFetching.value = false
    }
  })
})

onUnmounted(() => { if (map) map.remove() })
</script>

<template>
  <div class="tfm-page-wrapper">
    <div class="tfm-map-container" :class="{ 'is-dark': isDark }">
      <div id="map-container"></div>
      
      <div class="info-sidebar">
        <h3>Gitter-Daten</h3>
        
        <div v-if="isFetching" class="loading">Rufe Daten ab...</div>
        
        <div v-else-if="activeGridProperties" class="data-box">
          <!-- Gitter-Header -->
          <div class="grid-id">
            <span class="label">LAEA-Gitterzelle:</span>
            <code class="value-id">{{ activeGridProperties.ID_1km || activeGridProperties.id_1km || activeGridProperties.id }}</code>
          </div>

          <!-- Filter -->
          <div class="filter-section" v-if="inventoryArchiveData?.length">
            <v-select v-model="filterInterval" :items="filterOptions.intervals" label="Intervall" density="compact" variant="outlined" hide-details class="mb-2" clearable></v-select>
            <v-select v-model="filterStatus" :items="filterOptions.statuses" label="Status" item-title="title" item-value="value" density="compact" variant="outlined" hide-details class="mb-2" clearable></v-select>
          </div>

          <!-- Statistiken & Zustand -->
          <div v-if="inventoryArchiveData?.length > 0" class="stats-box">
            
            <!-- Bäume -->
            <div class="stat-section" v-if="statistics?.treeCount > 0">
              <h4>Bestockung (Bäume)</h4>
              <p>Anzahl: <strong>{{ statistics.treeCount }}</strong></p>
              <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Ø BHD:</span><span class="stat-val">{{ statistics.avgDbh }} cm</span></div>
                <div class="stat-item"><span class="stat-label">Ø Höhe:</span><span class="stat-val">{{ statistics.avgHeight }} m</span></div>
              </div>
            </div>

            <!-- Forstlicher Zustand (Nur wenn keine Bäume da sind oder zusätzlich) -->
            <div class="stat-section forest-explanation" v-if="forestState && (statistics?.treeCount === 0 || !statistics)">
              <h4>Forstlicher Zustand</h4>
              <p>Status: <strong>{{ forestState.label }}</strong></p>
              <p class="explanation-text">{{ forestState.explanation }}</p>
            </div>
            
            <!-- Totholz -->
            <div class="stat-section" v-if="statistics?.deadwoodCount > 0">
              <h4>Totholz</h4>
              <p>Anzahl: <strong>{{ statistics.deadwoodCount }}</strong></p>
              <div class="stat-item"><span class="stat-label">Ø Durchm:</span><span class="stat-val">{{ statistics.avgDeadwoodDia }} cm</span></div>
            </div>
          </div>
          
          <div v-else-if="inventoryArchiveData?.length === 0" class="empty-state">Keine BWI-Daten in dieser Zelle verfügbar.</div>

          <button @click="resetSelection" class="btn-clear">Auswahl aufheben</button>
        </div>
        
        <div v-else class="empty-state">Klicke ins Gitter für Details</div>
      </div>
    </div>

    <!-- Datentabelle -->
    <div v-if="inventoryArchiveData?.length > 0" class="tree-table-container" :class="{ 'is-dark': isDark }">
      <h4>Details (Gefiltert: Bäume & Totholz)</h4>
      
      <v-data-table 
        :headers="tableHeaders" 
        :items="tableData" 
        density="compact" 
        class="tree-table" 
        :items-per-page="10"
      >
        <template v-slot:item.type="{ item }">
          <v-chip size="x-small" :color="item.type === 'Baum' ? 'green' : 'brown'" variant="flat">{{ item.type }}</v-chip>
        </template>
        
        <template v-slot:item.diameter="{ item }">
          {{ item.diameter && item.diameter !== '-' ? (item.diameter / 10).toFixed(1) : '-' }}
        </template>
      </v-data-table>

      <!-- Debug Rohdaten -->
      <div class="raw-data-debug mt-4">
        <details>
          <summary>Rohdaten (JSON)</summary>
          <pre>{{ JSON.stringify(inventoryArchiveData[0], null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<style>
/* Globaler Override für VitePress Container-Breite auf dieser Seite */
.VPDoc .container { max-width: 100% !important; margin: 0 !important; padding: 0 32px !important; }
.VPDoc .content { max-width: 100% !important; padding: 0 !important; }
.VPDoc .content-container { max-width: 100% !important; }
</style>

<style scoped>
.tfm-page-wrapper { margin-top: 2rem; width: 100%; }
.tfm-map-container { display: flex; height: 600px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; transition: border-color 0.3s; }
.tfm-map-container.is-dark { border-color: #444; }

#map-container { flex: 3; height: 100%; }

.info-sidebar { flex: 1; background: #fdfdfd; padding: 0.75rem 1rem 1rem 1rem; border-left: 1px solid #eee; overflow-y: auto; transition: background 0.3s, border-color 0.3s; }
.is-dark .info-sidebar { background: #1e1e1e; border-left-color: #333; color: #eee; }

.info-sidebar h3 { margin-top: 0; margin-bottom: 0.75rem; font-size: 1.2rem; }

.grid-id { background: #f0f4f0; padding: 8px; border-radius: 4px; margin-bottom: 15px; }
.is-dark .grid-id { background: #2a3a2a; }

.value-id { display: block; font-weight: bold; color: #2d5a27; }
.is-dark .value-id { color: #8bb63a; }

.stat-section { margin-bottom: 15px; padding-top: 10px; border-top: 1px solid #eee; }
.is-dark .stat-section { border-top-color: #333; }
.stat-section h4 { margin: 0 0 5px 0; font-size: 0.9rem; color: #555; text-transform: uppercase; }
.is-dark .stat-section h4 { color: #aaa; }

.stats-box { margin-top: 15px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px; }
.is-dark .stats-box { border-color: #444; }

.stats-grid { display: flex; gap: 15px; margin-top: 10px; }
.stat-item { display: flex; flex-direction: column; }
.stat-label { font-size: 0.7rem; color: #777; }
.stat-val { font-weight: bold; }

.tree-table-container { margin-top: 2rem; padding: 1.5rem; background: #fff; border: 1px solid #eee; border-radius: 8px; }
.tree-table-container.is-dark { background: #1e1e1e; border-color: #333; color: #eee; }

.tree-table { background: transparent !important; }

.raw-data-debug pre { font-size: 0.7rem; background: #f9f9f9; padding: 10px; border-radius: 4px; max-height: 300px; overflow: auto; }
.is-dark .raw-data-debug pre { background: #111; color: #ccc; }

.loading { color: #2d5a27; font-weight: bold; }
.is-dark .loading { color: #8bb63a; }

.empty-state { color: #aaa; font-style: italic; font-size: 0.9rem; margin-top: 10px; }

.btn-clear { margin-top: 15px; width: 100%; cursor: pointer; background: #eee; border: none; padding: 8px; border-radius: 4px; font-weight: 500; }
.is-dark .btn-clear { background: #333; color: #eee; }

:deep(.maplibregl-ctrl-top-left) { top: 0.75rem; left: 10px; }
:deep(.maplibregl-ctrl-group) { background-color: #fff; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,0.1); }
.is-dark :deep(.maplibregl-ctrl-group) { background-color: #333; }
.is-dark :deep(.maplibregl-ctrl-group button) { filter: invert(1) brightness(1.5); }
</style>