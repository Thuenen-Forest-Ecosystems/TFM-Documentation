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
import ExportCsvButton from '../ExportCsvButton.vue';
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
    { field: "landesinventurleitung" , headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Ecke", filter: "agNumberColumnFilter" },
    { field: "troop_name", headerName: "Trupp", filter: "agTextColumnFilter" },
    { field: "kontrolltrupp", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "abgabedatum", headerName: "Abgabedatum", filter: "agDateColumnFilter" },
    { field: "wald2027_text", headerName: "Waldentscheid_2027", filter: "agTextColumnFilter" }, 
    { field: "begehbar2027", headerName: "Begehbar2027", filter: "agNumberColumnFilter" },
    { field: "begehbar2027_text", headerName: "Begehbarkeit_2027_text", filter: "agTextColumnFilter" }
  ];
}

async function fetchRecordChangesInBatches() {
  if (!selectedOrganisation.value) {
    tabledata.value = [];
    return [];
  }

  dataload.value = true;
  try {
    const { data, error } = await supabase.rpc('stat_not_accessible_asp', {
      user_id: selectedOrganisation.value
    });

    if (error) throw error;

    let records = data || [];

    const formatted = records.map(r => ({
      ...r,
      lil: r.landesinventurleitung || r.lil,
      kt: r.kontrolltrupp ?? r.kt,
      completed_at_troop: r.abgabedatum || r.completed_at_troop,
      landesinventurleitung: r.landesinventurleitung || r.lil,
      kontrolltrupp: r.kontrolltrupp ?? r.kt,
      abgabedatum: r.abgabedatum || r.completed_at_troop,
      wald2027: r.wald2027 || r.Wald2027,
      wald2027_text: r.wald2027_text || r.Wald2027_text,
      begehbar2027: r.begehbar2027 || r.begehbarkeit2027 || r.Begehbarkeit2027,
      begehbar2027_text: r.begehbar2027_text || r.begehbarkeit2027_text || r.Begehbarkeit2027_text
    }));

    tabledata.value = formatted;
    return formatted;
  } catch (err) {
    console.error('Error fetching RPC stat_not_accessible_asp:', err);
    tabledata.value = [];
    return [];
  } finally {
    dataload.value = false;
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
function onGridReady2(params) { gridApi2.value = params.api; }

function onOrgsLoaded(res) {
  organisationsList.value = res?.organisationsList || [];
}
</script>

<template>
  <OrganizationSelect
    v-model="selectedOrganisation"
    @loaded="onOrgsLoaded"
  />

  <v-card v-if="dataload === true" class="mb-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

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

    <ExportCsvButton
      :grid-api="gridApi1"
      filename-prefix="CI-Statistik_plots_not_accessible_due_to_asp"
      :selected-organisation="selectedOrganisation"
      :organisations-list="organisationsList"
      :disabled="!tabledata || tabledata.length === 0"
      label="CSV Export (Alle Traktecken)"
    />
  </v-card>
</template>
