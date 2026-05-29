<script setup>
// 1️⃣ Component meta‑information (JSDoc) – helps IDEs & documentation generators
/**
 * @component Wann, welcher Trupp welche Ecke abgegeben hat
 * @description A VitePress component for visualizing Supabase records using AG Grid
 * Supports dynamic time‑interval aggregation (Day, Week, Month) and organization‑based filtering.
 */

// imports of needed libraries and utilities are placed here, outside the component definition, to keep the setup function clean and focused on logic.
// 2️⃣ Imports – Vue core, AG‑Grid, ECharts, VitePress utilities, etc.
// ──────────────────────────────────────────────────────────────────────────────
import { ref, onMounted, getCurrentInstance, computed, watch, inject, onUnmounted, nextTick } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import { useData } from 'vitepress';
const { isDark } = useData();               // VitePress dark‑mode flag

// Register all AG‑Grid community modules (filtering, sorting, …)
ModuleRegistry.registerModules([AllCommunityModule]);

// Theme handling – we will switch between these two based on VitePress dark‑mode
// 3️⃣ Theme handling – switch between dark / light AG‑Grid themes
// ──────────────────────────────────────────────────────────────────────────────
const darkTheme = themeQuartz.withPart(colorSchemeDark);
const lightTheme = themeQuartz.withPart(colorSchemeLight);
const globalIsDark = inject('globalIsDark'); // Provided by the VitePress layout

// Computed theme that reacts to VitePress `isDark` (or the injected global flag)
const currentTheme = computed(() => {
  return isDark?.value
    ? themeQuartz.withPart(colorSchemeDark)
    : themeQuartz.withPart(colorSchemeLight);
});

// ──────────────────────────────────────────────────────────────────────────────
// 4️⃣ Reactive state variables
// ──────────────────────────────────────────────────────────────────────────────
const dataload = ref(false);          // true while a Supabase request is in progress
const dataloaded = ref([]);           // holds the number of records fetched so far
const instance = getCurrentInstance();               // Vue component instance
const supabase = instance.appContext.config.globalProperties.$supabase; // Supabase client
const my_data = ref([]);               // raw records from Supabase
const tabledata = ref([]);             // processed/aggregated data for Grid & Chart
const mysteps = ref('Monat');          // selected time‑step: 'Tag' | 'Woche' | 'Monat'
const trupps = ref('Inventurtrupp');   // column header for the troop column
const organisationsList = ref([]);    // list of orgs the user may select
const selectedOrganisations = ref([]); // UUIDs of orgs currently selected
const MyColDefs1 = ref([]); // column definitions for Grid 1 (all tracks)
const MyColDefs2 = ref([]); // column definitions for Grid 2 (begehbare tracks)

// Grid API references – needed for CSV export, resizing, etc.
const gridApi1 = ref(null);
const gridApi2 = ref(null);

// Strategy for automatically sizing the grid: fit the grid width to the container
// and ensure each column is at least 5 px wide.
const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };
const MIN_GRID_HEIGHT = 200;   // px – adjust to your design
const gridHeight = computed(() => {
  const rowHeight = 25;               // default ag‑grid row height
  const maxRows   = 50;               // rows before pagination kicks in
  const rows = Math.min(tabledata.value?.length ?? 0, maxRows) || 1;
  const height = rowHeight * rows;
  return `${Math.max(height, MIN_GRID_HEIGHT)}px`;   // enforce min height
});

// Troop ID → name mapping, loaded from Supabase for better readability in the grid
const troopsList = ref([]); // raw troop records from Supabase

// ──────────────────────────────────────────────────────────────────────────────
// 5️⃣ Helper: build column definitions (dynamic period column)
// ──────────────────────────────────────────────────────────────────────────────
function buildColDefs() {
  MyColDefs1.value = [
//    { field: "responsible_state", headerName: "Land", filter: "agTextColumnFilter" },
    { field: "lil" , headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
//    { field: "cluster_id", headerName: "Trakt-ID", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Plot", filter: "agNumberColumnFilter" },
//    { field: "responsible_troop", headerName: "Trupp-ID", filter: "agTextColumnFilter" },
    { field: "name", headerName: "Trupp", filter: "agTextColumnFilter" },
    { field: "completed_at_troop", headerName: "Abgabedatum", filter: "agDateColumnFilter" },
    { field: "is_control_troop", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "wald2027", headerName: "Wald2027-Status", filter: "agTextColumnFilter" }
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ Data loading – fetch records from Supabase in paginated batches
// ──────────────────────────────────────────────────────────────────────────────
async function fetchRecordChangesInBatches(batchSize = 1000) {
  let allRecords = []
  let from = 0
  let to = batchSize - 1
  let hasMore = true
  const ids = selectedOrganisations.value.join(','); // CSV list of org UUIDs
  // Build an OR‑filter that matches any of the four organisation‑type columns
  const orFilters = [
    `responsible_administration.in.(${ids})`,
    `responsible_state.in.(${ids})`,
    `responsible_provider.in.(${ids})`,
    `responsible_troop.in.(${ids})`
  ];


  console.log("Starting batch fetch from Supabase with batch size:", batchSize) 
  try {
    // 1. Fetch lookup tables once and convert them to Maps for fast O(1) matching
    const [troopsResponse, orgsResponse] = await Promise.all([
      supabase.from('troop').select('id, name, is_control_troop'),
      supabase.from('organizations').select('id, name')
    ])

    if (troopsResponse.error) throw troopsResponse.error
    if (orgsResponse.error) throw orgsResponse.error

    const troopMap = new Map(troopsResponse.data.map(t => [t.id, t]))
    console.log("Loaded troops for lookup:", troopMap.size, "records")
    const orgMap = new Map(orgsResponse.data.map(o => [o.id, o.name]))
    console.log("Loaded organizations for lookup:", orgMap.size, "records") 

    // 2. Fetch primary table 'record_changes' in batches
    while (hasMore) {
      const { data, error } = await supabase
        .from('record_changes')
        .select('responsible_state, cluster_id, cluster_name, plot_name, responsible_troop, completed_at_troop, properties')
        .or(orFilters.join(','))
        .not('completed_at_troop', 'is', null)
        .lt('cluster_name', 1000000000)
        .range(from, to)

      if (error) throw error

      if (!data || data.length === 0) {
        if (hasMore === true) {
          console.warn("No data returned from Supabase for orgs, ending batch fetch.")
        }
        hasMore = false
        break
      }
      console.log(`Fetched batch: ${data.length} records (from ${from} to ${to})`)
      console.log("Sample record from batch:", data[0])        
      // 3. Manually join data in frontend and handle JSON parsing
      const transformed = data.map(r => {
        const matchingTroop = troopMap.get(r.responsible_troop) || {}
        
        return {
          responsible_state: r.responsible_state,
          lil: orgMap.get(r.responsible_state) || null,
          cluster_id: r.cluster_id,
          cluster_name: r.cluster_name,
          plot_name: r.plot_name,
          responsible_troop: r.responsible_troop,
          name: matchingTroop.name || null,
          completed_at_troop: r.completed_at_troop,
          is_control_troop: matchingTroop.is_control_troop || null,
          wald2027: r.properties?.forest_status || null
        }
      })

      allRecords.push(...transformed)
      console.log(`Transformed batch: ${transformed.length} records`)
      console.log("Sample transformed record:", transformed[0])
      from += batchSize
      to += batchSize

      if (data.length < batchSize) {
        hasMore = false
      }
    }

    // 4. Client-side sorting to fulfill the ORDER BY requirement
    allRecords.sort((a, b) => {
      const compareLil = String(a.lil || '').localeCompare(String(b.lil || ''))
      if (compareLil !== 0) return compareLil

      const compareName = String(a.name || '').localeCompare(String(b.name || ''))
      if (compareName !== 0) return compareName

      return String(a.completed_at_troop || '').localeCompare(String(b.completed_at_troop || ''))
    })
    
    tabledata.value = allRecords // assign to reactive variable for grid display
    console.log(tabledata.value)
    return allRecords
    

  } catch (err) {
    console.error('Error fetching or processing data:', err.message)
    throw err
  }
}


// ──────────────────────────────────────────────────────────────────────────────
// 8️⃣ Fetch list of organisations the current user may view
// ──────────────────────────────────────────────────────────────────────────────
async function _getOrganizations(userId) {
  const { data, error } = await supabase
    .from('users_permissions')
    .select("*, organizations(*)")
    .eq('user_id', userId);

  if (error) {
    console.error("Org Fetch Error:", error);
    return;
  }

  // Keep only non‑deleted organisations and map to a simple {id, name} object
  organisationsList.value = data
    .filter(p => !p.organizations.deleted)
    .map(item => ({
      id: item.organizations.id,
      name: item.organizations.name
    }));
  if (organisationsList.value.length === 1) {
    console.warn("only 1 organization found for user:", userId);
    selectedOrganisations.value = [organisationsList.value[0].id]; // auto‑select if only one org
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 9️⃣ Lifecycle hooks
// ──────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Get the current Supabase session → user ID
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await _getOrganizations(data.session.user.id); // populate org list
    buildColDefs();                               // initialise column definitions
    console.log("instance", instance);
    //await loadTroopsList();                    // load troop names for better grid display
  }
});

onUnmounted(() => {
  // (nothing to clean up at the moment)
});

// ──────────────────────────────────────────────────────────────────────────────
// 10️⃣ Watchers – react to UI changes & keep everything in sync
// ──────────────────────────────────────────────────────────────────────────────
// Watch VitePress dark‑mode flag
watch(isDark, (val) => {
  console.log('VitePress Dark Mode ist jetzt:', val)
}, { immediate: true })

// When the selected time step changes → rebuild columns & re‑aggregate data
watch(mysteps, async (val) => {
  buildColDefs();          // update column list
  await _transformData(val);
});

// When the organisation selection changes → reload raw records & re‑aggregate
watch(selectedOrganisations, async () => {
  console.log("Selected Orgs:", selectedOrganisations.value);
  //await _loadRecords();
  await fetchRecordChangesInBatches(); // reload data from Supabase with new org filter 
  //await _transformData();
});

// Placeholder watcher – you could trigger chart redraws here
watch([tabledata, mysteps, selectedOrganisations], async () => {
  // e.g. update ECharts instance
});

// Grid‑ready callbacks – store the API objects for later use (CSV export, etc.)
function onGridReady1(params) { gridApi1.value = params.api; }
function onGridReady2(params) { gridApi2.value = params.api; }

// ──────────────────────────────────────────────────────────────────────────────
// 11️⃣ CSV export helpers (one per grid)
// ──────────────────────────────────────────────────────────────────────────────
function onBtnExport1() {
  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_Gruppe1_Stat3_${new Date().toISOString().slice(0, 10)}.csv`
  });
}
</script>

<template>
  <!-- ==================== ORGANISATION SELECTION ==================== -->
  <v-card>
    <v-card-title>Organisationen auswählen:</v-card-title>
    <!-- Multi‑select with chips – lets the user pick one or more orgs -->
    <v-select v-model="selectedOrganisations" :items="organisationsList" item-title="name" item-value="id" multiple
      chips closable-chips />
  </v-card>

  <!-- DEBUG: show selected org IDs (can be removed later) -->
<!--   <v-card v-if="selectedOrganisations.length > 0">
    <v-card-title>Ausgewählte Organisationen (nur zum Debuggen, kann später weg):</v-card-title>
    <v-list>
      <v-list-item v-for="orgId in selectedOrganisations" :key="orgId" :title="orgId" :value="orgId" />
    </v-list>
  </v-card> -->

  <!-- ==================== LOADING INDICATOR ==================== -->
  <v-card v-if="dataload === true">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <!-- ==================== GRID 1 – ALL ==================== -->
  <!-- <v-card v-if="tabledata && tabledata.length > 0">-->
  <v-card>
    <v-card-title>Ergebnis</v-card-title>

    <!-- Render the grid only when at least one organisation is selected -->
    <ag-grid-vue v-if="selectedOrganisations.length > 0 && tabledata && tabledata.length > 0"
      :rowData="tabledata"
      :columnDefs="MyColDefs1"
      :style="{ height: gridHeight }"
      style="width: 100%"
      :paginationAutoPageSize="true"
      :pagination="true"
      :autoSizeStrategy="autoSizeStrategy"
      :key="isDark"
      :theme="currentTheme"
      @grid-ready="onGridReady1" />
    <!-- Fallback message when no org is selected -->
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar. Bitte Auswahl ändern.
    </v-card-text>

    <!-- CSV export button for Grid 1 -->
    <v-btn color="primary" prepend-icon="mdi-download" @click="onBtnExport1"
      :disabled="!tabledata || tabledata.length === 0">
      CSV Export (Alle Traktecken)
    </v-btn>
  </v-card>
</template>