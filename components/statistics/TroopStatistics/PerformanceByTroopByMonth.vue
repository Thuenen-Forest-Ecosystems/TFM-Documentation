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
import OrganizationSelect from '../OrganizationSelect.vue';
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
const selectedOrganisation = ref(null); // UUID of selected org or troop
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
  //  { field: "responsible_state", headerName: "Land", filter: "agTextColumnFilter" },
    { field: "lil" , headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "troop_name", headerName: "Trupp", filter: "agTextColumnFilter" },
    { field: "kt", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "monat", headerName: "Monat", filter: "agTextColumnFilter" },
    { field: "anzahl", headerName: "Anzahl", filter: "agNumberColumnFilter" } 
  ];
}

async function fetchRecordChangesInBatches(batchSize = 1000) {
  if (!selectedOrganisation.value) {
    tabledata.value = [];
    return [];
  }

  let allRecords = []
  let from = 0
  let to = batchSize - 1
  let hasMore = true

  const id = selectedOrganisation.value;
  // Build an OR‑filter that matches any of the four organisation‑type columns
  const orFilters = [
    `responsible_administration.eq.${id}`,
    `responsible_state.eq.${id}`,
    `responsible_provider.eq.${id}`,
    `responsible_troop.eq.${id}`
  ];
  console.log("Selected Org for batch fetch:", selectedOrganisation.value);

  console.log("Starting batch fetch from Supabase with batch size:", batchSize) 
  
  try {
    // Ruft die primäre Tabelle in Batches ab
    while (hasMore) {
      let query = supabase
        .from('v_stats_performance_by_troop_by_month')
        .select('lil, troop_name, kt, monat, anzahl, responsible_state, responsible_administration, responsible_provider, responsible_troop')
        .or(orFilters.join(','))

      const { data, error } = await query.range(from, to);

      if (error) throw error

      if (!data || data.length === 0) {
        if (hasMore === true) {
          console.warn("No data returned from Supabase, ending batch fetch.")
        }
        hasMore = false
        break
      }

      console.log(`Fetched batch: ${data.length} records (from ${from} to ${to})`)
      
      allRecords.push(...data)

      from += batchSize
      to += batchSize

      if (data.length < batchSize) {
        hasMore = false
      }
    }

    allRecords.sort((a, b) => {
      const compareState = String(a.responsible_state || '').localeCompare(String(b.responsible_state || ''))
      if (compareState !== 0) return compareState

      const compareTroopName = String(a.troop_name || '').localeCompare(String(b.troop_name || ''))
      if (compareTroopName !== 0) return compareTroopName

      return String(a.completed_at_troop || '').localeCompare(String(b.completed_at_troop || ''))
    })
 
    tabledata.value = allRecords
    console.log("Total records fetched and sorted:", tabledata.value.length)
    return allRecords
 
  } catch (err) {
    console.error('Error fetching or processing data:', err.message)
    throw err
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 8️⃣ Lifecycle hooks & Watchers
// ──────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  buildColDefs();
});

onUnmounted(() => {});

watch(isDark, (val) => {
  console.log('VitePress Dark Mode ist jetzt:', val)
}, { immediate: true })

watch(selectedOrganisation, async () => {
  console.log("Selected Org:", selectedOrganisation.value);
  if (selectedOrganisation.value) {
    await fetchRecordChangesInBatches();
  } else {
    tabledata.value = [];
  }
});

function onGridReady1(params) { gridApi1.value = params.api; }

function onOrgsLoaded(res) {
  organisationsList.value = res?.organisationsList || [];
}

function onBtnExport1() {
  const selectedItem = organisationsList.value.find(item => item.id === selectedOrganisation.value);
  const namePart = selectedItem?.name ? `${selectedItem.name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}_` : '';
  const datePart = new Date().toISOString().slice(0, 10);

  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_performance_by_troop_by_month_${namePart}${datePart}.csv`
  });
}
</script>

<template>
  <!-- Reusable Organization and Troop Selector Component -->
  <OrganizationSelect
    v-model="selectedOrganisation"
    @loaded="onOrgsLoaded"
  />

  <!-- ==================== LOADING INDICATOR ==================== -->
  <v-card v-if="dataload === true" class="mb-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <!-- ==================== GRID 1 – ALL ==================== -->
  <v-card>
    <v-card-title>Ergebnis</v-card-title>

    <ag-grid-vue v-if="selectedOrganisation && tabledata && tabledata.length > 0"
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
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar. Bitte Auswahl ändern.
    </v-card-text>

    <v-card-actions>
      <v-btn color="primary" prepend-icon="mdi-download" @click="onBtnExport1"
        :disabled="!tabledata || tabledata.length === 0">
        CSV Export (Alle Traktecken)
      </v-btn>
    </v-card-actions>
  </v-card>
</template>