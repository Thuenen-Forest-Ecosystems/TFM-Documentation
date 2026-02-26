<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { isDark } from '../../.vitepress/theme/composables/useGlobalTheme'

// State
const selectedData = ref(null)
const clusterDetails = ref(null)
const isLoading = ref(false)
let map = null

// Filter State
const filterInterval = ref(null)
const filterStatus = ref(null)
const treeStatusLookup = ref({})

// Hilfsfunktion für Statistiken
const calculateStats = (clusters, interval, status) => {
  if (!clusters || !clusters.length) return null
  
  let treeCount = 0
  let dbhSum = 0
  let heightSum = 0
  let treesWithDbh = 0
  let treesWithHeight = 0
  
  let deadwoodCount = 0
  let deadwoodDiameterSum = 0
  let deadwoodWithDia = 0

  clusters.forEach(cluster => {
    cluster.plot?.forEach(plot => {
      if (interval && plot.interval_name !== interval) return

      plot.tree?.forEach(tree => {
        if (status !== null && status !== undefined && tree.tree_status != status) return
        treeCount++
        if (tree.dbh) {
          dbhSum += parseFloat(tree.dbh)
          treesWithDbh++
        }
        if (tree.tree_height) {
          heightSum += parseFloat(tree.tree_height)
          treesWithHeight++
        }
      })

      plot.deadwood?.forEach(dw => {
        deadwoodCount++
        if (dw.diameter_at_smaller_end || dw.diameter_at_thicker_end) {
          const d1 = parseFloat(dw.diameter_at_smaller_end || 0)
          const d2 = parseFloat(dw.diameter_at_thicker_end || 0)
          deadwoodDiameterSum += d1 > 0 && d2 > 0 ? (d1 + d2) / 2 : (d1 || d2)
          deadwoodWithDia++
        }
      })
    })
  })

  if (treeCount === 0 && deadwoodCount === 0) return null

  return {
    treeCount,
    avgDbh: treesWithDbh ? (dbhSum / treesWithDbh / 10).toFixed(1) : 'n.a.',
    avgHeight: treesWithHeight ? (heightSum / treesWithHeight / 10).toFixed(1) : 'n.a.',
    deadwoodCount,
    avgDeadwoodDia: deadwoodWithDia ? (deadwoodDiameterSum / deadwoodWithDia / 10).toFixed(1) : 'n.a.'
  }
}

// Filter-Optionen
const filterOptions = computed(() => {
  const intervals = new Set()
  const statuses = new Set()
  clusterDetails.value?.forEach(c => {
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

// Gefilterte Bäume
const filteredTrees = computed(() => {
  const list = []
  clusterDetails.value?.forEach(c => {
    c.plot?.forEach(p => {
      if (filterInterval.value && p.interval_name !== filterInterval.value) return
      p.tree?.forEach(t => {
        if (filterStatus.value != null && t.tree_status != filterStatus.value) return
        list.push({ ...t, interval: p.interval_name, plot: p.plot_name || p.id, status_text: treeStatusLookup.value[t.tree_status] || `Code ${t.tree_status}` })
      })
    })
  })
  return list
})

const tableHeaders = [
  { title: 'Intervall', key: 'interval' },
  { title: 'Plot', key: 'plot' },
  { title: 'Baum-Nr', key: 'tree_no' },
  { title: 'Art', key: 'tree_species' },
  { title: 'BHD (mm)', key: 'dbh' },
  { title: 'Höhe (dm)', key: 'tree_height' },
  { title: 'Status', key: 'status_text' }
]

const getBasemapUrl = () => isDark.value ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const updateBasemap = () => {
  if (!map) return
  const source = map.getSource('osm-source')
  if (source) source.setTiles([getBasemapUrl()])
}

watch(isDark, updateBasemap)

onMounted(async () => {
  // 0. Lookup laden
  try {
    const headers = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU", "Accept-Profile": "lookup" }
    const resp = await fetch("https://ci.thuenen.de/rest/v1/lookup_tree_status", { headers })
    const data = await resp.json()
    data.forEach(item => { treeStatusLookup.value[item.code] = item.name_de })
  } catch (err) { console.error('Lookup-Fehler:', err) }

  // 1. Map initialisieren
  const wmsUrl = 'https://fnews-access.bwi.info/geoserver/fnews_test/wms'
  map = new maplibregl.Map({
    container: 'map-container',
    style: {
      version: 8,
      sources: {
        'osm-source': { type: 'raster', tiles: [getBasemapUrl()], tileSize: 256, attribution: '© OpenStreetMap' },
        'thuenen-gitter-source': {
          type: 'raster',
          tiles: [`${wmsUrl}?service=WMS&version=1.1.1&request=GetMap&layers=fnews_test:LAEA1km_bwi&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true&tiled=true`],
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

  map.on('click', async (e) => {
    isLoading.value = true
    selectedData.value = null
    clusterDetails.value = null

    const canvas = map.getCanvas()
    const bounds = map.getBounds()
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',')
    const params = new URLSearchParams({
      service: 'WMS', version: '1.1.1', request: 'GetFeatureInfo', layers: 'fnews_test:LAEA1km_bwi', query_layers: 'fnews_test:LAEA1km_bwi',
      bbox: bbox, width: canvas.width, height: canvas.height, srs: 'EPSG:4326', info_format: 'application/json',
      x: Math.round(e.point.x * (canvas.width / canvas.clientWidth)), y: Math.round(e.point.y * (canvas.height / canvas.clientHeight)),
      feature_count: 1
    })

    try {
      const wmsResp = await fetch(`${wmsUrl}?${params.toString()}`)
      const wmsData = await wmsResp.json()
      if (wmsData.features?.length > 0) {
        const props = wmsData.features[0].properties
        selectedData.value = props
        const itemId = props.ID_1km || props.id_1km || props.id
        
        const apiHeaders = { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU", "Accept-Profile": "inventory_archive" }
        const apiResp = await fetch(`https://ci.thuenen.de/rest/v1/cluster?select=*,plot!plot_cluster_id_fkey(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))&inspire_grid_cell=eq.${itemId}`, { headers: apiHeaders })
        const data = await apiResp.json()
        clusterDetails.value = data
        if (data.length > 0) {
          const intervals = Array.from(new Set(data.flatMap(c => c.plot?.map(p => p.interval_name) || []))).sort()
          if (intervals.length > 0) filterInterval.value = intervals[intervals.length - 1]
        }
      }
    } catch (err) { console.error('Fehler:', err) }
    isLoading.value = false
  })
})

onUnmounted(() => { if (map) map.remove() })
const stats = computed(() => calculateStats(clusterDetails.value, filterInterval.value, filterStatus.value))
</script>

<template>
  <div class="tfm-page-wrapper">
    <div class="tfm-map-container" :class="{ 'is-dark': isDark }">
      <div id="map-container"></div>
      <div class="info-sidebar">
        <h3>Gitter-Daten</h3>
        <div v-if="isLoading" class="loading">Rufe Daten ab...</div>
        <div v-else-if="selectedData" class="data-box">
          <div class="grid-id">
            <span class="label">LAEA-Gitterzelle:</span>
            <code class="value-id">{{ selectedData.ID_1km || selectedData.id_1km || selectedData.id }}</code>
          </div>

          <div class="filter-section" v-if="clusterDetails && clusterDetails.length > 0">
            <v-select v-model="filterInterval" :items="filterOptions.intervals" label="Intervall" density="compact" variant="outlined" hide-details class="mb-2" clearable></v-select>
            <v-select v-model="filterStatus" :items="filterOptions.statuses" label="Status" item-title="title" item-value="value" density="compact" variant="outlined" hide-details class="mb-2" clearable></v-select>
          </div>

          <div v-if="stats" class="stats-box">
            <div class="stat-section">
              <h4>Bäume</h4>
              <p>Anzahl: <strong>{{ stats.treeCount }}</strong></p>
              <div v-if="stats.treeCount > 0" class="stats-grid">
                <div class="stat-item"><span class="stat-label">Ø BHD:</span><span class="stat-val">{{ stats.avgDbh }} cm</span></div>
                <div class="stat-item"><span class="stat-label">Ø Höhe:</span><span class="stat-val">{{ stats.avgHeight }} m</span></div>
              </div>
            </div>
            <div class="stat-section" v-if="stats.deadwoodCount > 0">
              <h4>Totholz</h4>
              <p>Anzahl: <strong>{{ stats.deadwoodCount }}</strong></p>
              <div class="stat-item"><span class="stat-label">Ø Durchm:</span><span class="stat-val">{{ stats.avgDeadwoodDia }} cm</span></div>
            </div>
          </div>
          <div v-else-if="clusterDetails && clusterDetails.length === 0" class="empty-state">Keine BWI-Daten in dieser Zelle verfügbar.</div>
          <div v-else-if="clusterDetails && !stats" class="empty-state">Keine Daten für diese Filter verfügbar.</div>

          <button @click="selectedData = null; clusterDetails = null; filterInterval = null; filterStatus = null" class="btn-clear">Auswahl aufheben</button>
        </div>
        <div v-else class="empty-state">Klicke ins Gitter für Details</div>
      </div>
    </div>

    <div v-if="clusterDetails && clusterDetails.length > 0" class="tree-table-container" :class="{ 'is-dark': isDark }">
      <h4>Baum-Details (Gefiltert)</h4>
      <v-data-table :headers="tableHeaders" :items="filteredTrees" density="compact" class="tree-table" :items-per-page="10">
        <template v-slot:item.dbh="{ item }">{{ item.dbh ? (item.dbh / 10).toFixed(1) : '-' }}</template>
        <template v-slot:item.tree_height="{ item }">{{ item.tree_height ? (item.tree_height / 10).toFixed(1) : '-' }}</template>
      </v-data-table>
      <div class="raw-data-debug mt-4">
        <details><summary>Rohdaten (JSON)</summary><pre>{{ JSON.stringify(clusterDetails[0], null, 2) }}</pre></details>
      </div>
    </div>
  </div>
</template>

<style>
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
.btn-clear { margin-top: 15px; width: 100%; cursor: pointer; background: #eee; border: none; padding: 5px; border-radius: 4px; }
.is-dark .btn-clear { background: #333; color: #eee; }
:deep(.maplibregl-ctrl-top-left) { top: 0.75rem; left: 10px; }
:deep(.maplibregl-ctrl-bottom-right) { bottom: 10px; right: 10px; }
:deep(.maplibregl-ctrl-attrib) { background-color: rgba(255, 255, 255, 0.8) !important; border-radius: 4px; display: flex !important; align-items: center !important; padding: 0 5px !important; height: 24px !important; margin: 0 !important; }
:deep(.maplibregl-ctrl-attrib-button) { position: relative !important; top: 0 !important; right: 0 !important; height: 24px !important; width: 24px !important; background-position: center !important; margin-left: 5px; order: 2; }
.is-dark :deep(.maplibregl-ctrl-attrib) { background-color: rgba(30, 30, 30, 0.9) !important; color: #eee; }
.is-dark :deep(.maplibregl-ctrl-attrib a) { color: #8bb63a; }
.is-dark :deep(.maplibregl-ctrl-group) { background-color: #333; }
.is-dark :deep(.maplibregl-ctrl-group button) { filter: invert(1) brightness(1.5); }
</style>