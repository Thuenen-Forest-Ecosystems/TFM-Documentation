<script setup>
// 1️⃣ Component meta‑information (JSDoc) – helps IDEs & documentation generators
/**
 * @component Kumulative Leistung pro Inventurtrupp
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
  const maxRows   = 20;               // rows before pagination kicks in
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
    { field: "troop", headerName: trupps.value, filter: "agTextColumnFilter" },
    // dynamic period column – header & field name come from `mysteps`
    { field: mysteps.value, headerName: mysteps.value, filter: "agTextColumnFilter" },
    { field: "SUMME_all", headerName: "Summe", filter: "agNumberColumnFilter" },
    { field: "NHB_all", headerName: "Nichtholzboden", filter: "agNumberColumnFilter" },
    { field: "BHB_all", headerName: "Holzboden", filter: "agNumberColumnFilter" },
    { field: "BLOESSE_all", headerName: "Blöße", filter: "agNumberColumnFilter" },
  ];
  MyColDefs2.value = [
    { field: "troop", headerName: trupps.value, filter: "agTextColumnFilter" },
    { field: mysteps.value, headerName: mysteps.value, filter: "agTextColumnFilter" },
    { field: "SUMME_bg", headerName: "Summe", filter: "agNumberColumnFilter" },
    { field: "NHB_bg", headerName: "Nichtholzboden", filter: "agNumberColumnFilter" },
    { field: "BHB_bg", headerName: "Holzboden", filter: "agNumberColumnFilter" },
    { field: "BLOESSE_bg", headerName: "Blöße", filter: "agNumberColumnFilter" },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ Data loading – fetch records from Supabase in paginated batches
// ──────────────────────────────────────────────────────────────────────────────
async function _loadRecords() {
  if (!selectedOrganisation.value) {
    my_data.value = [];
    tabledata.value = [];
    return;
  }

  dataload.value = true;                     // show loading spinner
  const batchSize = 1000;                    // rows per request
  let offset = 0;                            // start index for the next batch
  const allRecords = [];                     // accumulator for all pages
  const id = selectedOrganisation.value;

  // Build an OR‑filter that matches any of the four organisation‑type columns
  const orFilters = [
    `responsible_administration.eq.${id}`,
    `responsible_state.eq.${id}`,
    `responsible_provider.eq.${id}`,
    `responsible_troop.eq.${id}`
  ];

  // Loop until Supabase returns no more rows or an error occurs
  while (true) {
    const { data, error } = await supabase
      .from('records')
      .select('id, completed_at_troop, responsible_troop, updated_at, updated_by, properties')
      .or(orFilters.join(','))
      .not('completed_at_troop', 'is', null)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Fetch Error:', error);
      break;
    }

    if (!data?.length) break;

    allRecords.push(...data);
    offset += batchSize;
    dataloaded.value = allRecords.length;
    console.log(`Loaded ${allRecords.length} records so far...`);
  }

  my_data.value = allRecords;
  console.log(`Total records loaded: ${allRecords.length}`);
  dataload.value = false;
}

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ loading troops – fetch records from Supabase
// ──────────────────────────────────────────────────────────────────────────────
async function loadTroopsList() {
  const { data, error } = await supabase
    .from('troop')
    .select('id, name');          // only the columns we need

  if (error) {
    console.error('Failed to load troops:', error);
    return;
  }

  // Return an array of { id, name } objects
  troopsList.value = data.map(item => ({
    id: item.id,
    name: item.name
  }));
  console.log("Troops List Loaded:", troopsList.value);
}

// ──────────────────────────────────────────────────────────────────────────────
// 7️⃣ Transform raw data → aggregation per troop & period (used by both grids)
// ──────────────────────────────────────────────────────────────────────────────
async function _transformData(steps = mysteps.value) {
  // -----------------------------------------------------------------
  // Helper: convert a full ISO‑date string to the requested granularity
  // -----------------------------------------------------------------
  const getPeriod = (isoDate) => {
    if (!isoDate) return 'Kein Datum';
    const d = new Date(isoDate);
    if (isNaN(d)) return 'Kein Datum';

    if (steps === 'Tag') {
      return d.toISOString().substring(0, 10);          // YYYY‑MM‑DD
    }
    if (steps === 'Woche') {
      const year = d.getUTCFullYear();
      const week = Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
      return `${year}-${String(week).padStart(2, '0')}`; // YYYY‑WW
    }
    if (steps === 'Monat') {
      return d.toISOString().substring(0, 7);           // YYYY‑MM
    }
    return d.toISOString().substring(0, 10);
  };

  // -----------------------------------------------------------------
  // Dynamic column name – will become the header in the table
  // -----------------------------------------------------------------
  const periodKey = steps;   // e.g. "Tag", "Woche" or "Monat"

  // -----------------------------------------------------------------
  // 1️⃣ Build a flat summary array with only the needed fields for aggregation, swapping the troop id to the name
  // -----------------------------------------------------------------

  // Create a quick lookup map:  { id → name }
  const troopIdToName = computed(() => {
    const map = {}
    troopsList.value?.forEach(t => {
      if (t?.id && t?.name) map[t.id] = t.name
    })
    return map
  })

  // -----------------------------------------------------------------
  // 2️⃣ Aggregate per troop + period (Tag / Woche / Monat)
  // -----------------------------------------------------------------
  const aggregation = my_data.value.reduce((acc, item) => {
    const period = getPeriod(item.updated_at);
    const troop = troopIdToName.value?.[item.responsible_troop] || 'unknown';
    const status = item.properties?.forest_status;
    const accessibility = item.properties?.accessibility;

    // key combines troop and period → unique bucket
    const key = `${troop}_${period}`;

    if (!acc[key]) {
      acc[key] = {
        troop,
        [periodKey]: period,   // dynamic column name/value
        SUMME_all: 0,
        NHB_all: 0,
        HB_all: 0,
        BLOESSE_all: 0,
        BHB_all: 0,

        SUMME_bg: 0,
        NHB_bg: 0,
        HB_bg: 0,
        BLOESSE_bg: 0,
        BHB_bg: 0
      };
    }

    // ---- counting logic ----
    if ([3, 4, 5].includes(status)) acc[key].SUMME_all++;
    if (status === 4) acc[key].NHB_all++;
    if (status === 3 || status === 5) acc[key].HB_all++;
    if (status === 3) acc[key].BLOESSE_all++;
    if (status === 5) acc[key].BHB_all++;

    if ([3, 4, 5].includes(status) && accessibility === 1) acc[key].SUMME_bg++;
    if (status === 4 && accessibility === 1) acc[key].NHB_bg++;
    if ((status === 3 || status === 5) && accessibility === 1) acc[key].HB_bg++;
    if (status === 3 && accessibility === 1) acc[key].BLOESSE_bg++;
    if (status === 5 && accessibility === 1) acc[key].BHB_bg++;

    return acc;
  }, {});

  // -----------------------------------------------------------------
  // 3️⃣ Convert aggregation object → sorted array for the grid
  // -----------------------------------------------------------------
  const resultTable = Object.values(aggregation).sort((a, b) => {
    // first sort by the dynamic period column, then by troop name
    return a[periodKey].localeCompare(b[periodKey]) || a.troop.localeCompare(b.troop);
  });

  console.table(resultTable);
  console.log("Aggregated Data:", resultTable);
  tabledata.value = resultTable;   // reactive state consumed by AG‑Grid & ECharts
}

// ──────────────────────────────────────────────────────────────────────────────
// 8️⃣ Fetch list of organisations the current user may view
// ──────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  buildColDefs();
  await loadTroopsList();
});

onUnmounted(() => {});

watch(isDark, (val) => {
  console.log('VitePress Dark Mode ist jetzt:', val)
}, { immediate: true })

watch(mysteps, async (val) => {
  buildColDefs();
  await _transformData(val);
});

watch(selectedOrganisation, async () => {
  console.log("Selected Org:", selectedOrganisation.value);
  if (selectedOrganisation.value) {
    await _loadRecords();
    await _transformData();
  } else {
    my_data.value = [];
    tabledata.value = [];
  }
});

function onGridReady1(params) { gridApi1.value = params.api; }
function onGridReady2(params) { gridApi2.value = params.api; }

function onOrgsLoaded(res) {
  organisationsList.value = res?.organisationsList || [];
}

function onBtnExport1() {
  const selectedItem = organisationsList.value.find(item => item.id === selectedOrganisation.value);
  const namePart = selectedItem?.name ? `${selectedItem.name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}_` : '';
  const datePart = new Date().toISOString().slice(0, 10);

  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_performance_by_troop_average_alle_${namePart}${datePart}.csv`
  });
}
function onBtnExport2() {
  const selectedItem = organisationsList.value.find(item => item.id === selectedOrganisation.value);
  const namePart = selectedItem?.name ? `${selectedItem.name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}_` : '';
  const datePart = new Date().toISOString().slice(0, 10);

  gridApi2.value?.exportDataAsCsv({
    fileName: `CI-Statistik_performance_by_troop_average_begehbar_${namePart}${datePart}.csv`
  });
}
</script>

<template>
  <OrganizationSelect
    v-model="selectedOrganisation"
    @loaded="onOrgsLoaded"
  />

  <v-card v-if="tabledata && tabledata.length > 0" class="mb-4">
    <v-card-title>Zeitschritte auswählen:</v-card-title>
    <v-select v-model="mysteps" :items="['Monat', 'Woche', 'Tag']" />
  </v-card>

  <v-card v-if="dataload === true" class="mb-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <v-card class="mb-4">
    <v-card-title>Alle Traktecken</v-card-title>

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

  <v-card>
    <v-card-title>Begehbare Traktecken</v-card-title>

    <ag-grid-vue v-if="selectedOrganisation && tabledata && tabledata.length > 0"
      :rowData="tabledata"
      :columnDefs="MyColDefs2"
      :style="{ height: gridHeight }"
      style="width: 100%"
      :paginationAutoPageSize="true"
      :pagination="true"
      :autoSizeStrategy="autoSizeStrategy"
      :key="isDark"
      :theme="currentTheme"
      @grid-ready="onGridReady2" />
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar. Bitte Auswahl ändern.
    </v-card-text>

    <v-card-actions>
      <v-btn color="primary" prepend-icon="mdi-download" @click="onBtnExport2"
        :disabled="!tabledata || tabledata.length === 0">
        CSV Export (Begehbare Traktecken)
      </v-btn>
    </v-card-actions>
  </v-card>
</template>