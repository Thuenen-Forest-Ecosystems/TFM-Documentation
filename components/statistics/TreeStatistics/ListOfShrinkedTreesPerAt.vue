<script setup>
// 1️⃣ Component meta‑information (JSDoc)
/**
 * @component Liste mit Bäumen mit geschrumpftem BHD pro Aufnahmetrupp
 * @description A VitePress component for visualizing Supabase records using AG Grid
 */

// 2️⃣ Imports – Vue core, AG‑Grid, VitePress utilities, etc.
// ──────────────────────────────────────────────────────────────────────────────
import { ref, onMounted, getCurrentInstance, computed, watch, inject, onUnmounted } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import { useData } from 'vitepress';
import OrganizationSelect from '../OrganizationSelect.vue';
import ExportCsvButton from '../ExportCsvButton.vue';
const { isDark } = useData();               // VitePress dark‑mode flag

// Register all AG‑Grid community modules (filtering, sorting, …)
ModuleRegistry.registerModules([AllCommunityModule]);

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
const dataloaded = ref(0);            // holds the number of records fetched so far
const instance = getCurrentInstance();               // Vue component instance
const supabase = instance.appContext.config.globalProperties.$supabase; // Supabase client
const tabledata = ref([]);             // processed data for Grid
const organisationsList = ref([]);    // list of orgs the user may select
const selectedOrganisation = ref(null); // UUID of selected org or troop
const MyColDefs1 = ref([]);            // column definitions for Grid

// Grid API references – needed for CSV export, resizing, etc.
const gridApi1 = ref(null);

// Strategy for automatically sizing the grid: fit the grid width to the container
const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };
const MIN_GRID_HEIGHT = 200;   // px
const gridHeight = computed(() => {
  const rowHeight = 25;               // default ag‑grid row height
  const maxRows   = 50;               // rows before pagination kicks in
  const rows = Math.min(tabledata.value?.length ?? 0, maxRows) || 1;
  const height = rowHeight * rows;
  return `${Math.max(height, MIN_GRID_HEIGHT)}px`;   // enforce min height
});

// ──────────────────────────────────────────────────────────────────────────────
// 5️⃣ Helper: build column definitions
// ──────────────────────────────────────────────────────────────────────────────
function buildColDefs() {
  MyColDefs1.value = [
    { field: "lil", headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Traktecke", filter: "agNumberColumnFilter" },
    { field: "troop_name", headerName: "Aufnahmetrupp", filter: "agTextColumnFilter" },
    { field: "kt", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "abgabedatum_at", headerName: "Abgabedatum AT", filter: "agDateColumnFilter" },
    { field: "baumnummer27", headerName: "Baumnummer 2027", filter: "agNumberColumnFilter" },
    { field: "bhd27", headerName: "BHD 2027 [mm]", filter: "agNumberColumnFilter" },
    { field: "baumnummer22", headerName: "Baumnummer 2022", filter: "agNumberColumnFilter" },
    { field: "bhd22", headerName: "BHD 2022 [mm]", filter: "agNumberColumnFilter" },
    { field: "differenz", headerName: "Differenz [mm]", filter: "agNumberColumnFilter" }
  ];
}

async function fetchRecordChangesInBatches() {
  if (!selectedOrganisation.value) {
    tabledata.value = [];
    dataloaded.value = 0;
    return [];
  }

  dataload.value = true;
  try {
    const { data, error } = await supabase.rpc('stat_list_of_shrinked_trees_per_at', {
      user_id: selectedOrganisation.value
    });

    if (error) throw error;

    let records = data || [];

    const formatted = records.map(r => ({
      ...r,
      lil: r.landesinventurleitung || r.lil,
      landesinventurleitung: r.landesinventurleitung || r.lil,
      troop_name: r.troop_name,
      kt: r.kt ?? r.kontrolltrupp,
      kontrolltrupp: r.kt ?? r.kontrolltrupp,
      abgabedatum_at: r.abgabedatum_at || r.completed_at_survey_troop,
      baumnummer27: r.baumnummer27 ?? r.tree_id27,
      bhd27: r.bhd27 ?? r.bdh27 ?? r.dbh27,
      baumnummer22: r.baumnummer22 ?? r.tree_id22,
      bhd22: r.bhd22 ?? r.dbh22,
      differenz: r.differenz
    }));

    dataloaded.value = formatted.length;
    tabledata.value = formatted;
    return formatted;
  } catch (err) {
    console.error('Error fetching RPC stat_list_of_shrinked_trees_per_at:', err);
    tabledata.value = [];
    return [];
  } finally {
    dataload.value = false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ Lifecycle hooks & Watchers
// ──────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  buildColDefs();
});

onUnmounted(() => {});

watch(isDark, (val) => {
  console.log('VitePress Dark Mode ist jetzt:', val)
}, { immediate: true });

watch(selectedOrganisation, async () => {
  console.log("Selected Org:", selectedOrganisation.value);
  if (selectedOrganisation.value) {
    await fetchRecordChangesInBatches();
  } else {
    tabledata.value = [];
    dataloaded.value = 0;
  }
});

function onGridReady1(params) { gridApi1.value = params.api; }

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

    <v-card-actions>
      <ExportCsvButton
        :grid-api="gridApi1"
        filename-prefix="CI-Statistik_list_of_shrinked_trees_per_at"
        :selected-organisation="selectedOrganisation"
        :organisations-list="organisationsList"
        :disabled="!tabledata || tabledata.length === 0"
        label="CSV Export"
      />
    </v-card-actions>
  </v-card>
</template>
