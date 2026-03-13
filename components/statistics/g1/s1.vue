<script setup>
/**
 * @component Kumulative Leistung pro Inventurtrupp
 * @description A VitePress component for visualizing Supabase records using AG Grid and ECharts.
 * Supports dynamic time-interval aggregation (Day, Week, Month) and organization-based filtering.
 */

// --- IMPORTS ---
import { ref, onMounted, getCurrentInstance, computed, watch, inject, onUnmounted, nextTick } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import * as echarts from 'echarts';
import { useData } from 'vitepress';
const { isDark } = useData();

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

// --- STATE MANAGEMENT & CONFIG ---
/** @section Theme Configuration */
const darkTheme = themeQuartz.withPart(colorSchemeDark);
const lightTheme = themeQuartz.withPart(colorSchemeLight);
const globalIsDark = inject('globalIsDark'); // Injected from VitePress layout
//const currentTheme = globalIsDark?.value ? darkTheme : lightTheme;
// Nutze computed, damit sich der Wert bei Änderung von globalIsDark aktualisiert
const currentTheme = computed(() => {
  return isDark?.value
    ? themeQuartz.withPart(colorSchemeDark)
    : themeQuartz.withPart(colorSchemeLight);
});
const dataload = ref(false); // Flag to indicate if data is currently being loaded
const dataloaded = ref([]); // Flag to indicate if data has been loaded at least once

/** @section Reactive State */
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;

const my_data = ref([]);                // Raw records from Supabase
const tabledata = ref([]);               // Aggregated data for Grid & Chart
const mysteps = ref('Monat');              // Time step: 'Tag' | 'Woche' | 'Monat'
const trupps = ref('Inventurtrupp');    // Label for the 'trupp' column in AG Grid
const organisationsList = ref([]);       // Available orgs for the user
const selectedOrganisations = ref([]);   // User selection (UUIDs)

const MyColDefs1 = ref([]);   // will be filled by `buildColDefs()`
const MyColDefs2 = ref([]);   // will be filled by `buildColDefs()`

/** @section Chart & Grid References */
const gridApi1 = ref(null);               // AG Grid API instance
const gridApi2 = ref(null);               // AG Grid API instance

const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };

// --- LOGIC & FUNCTIONS ---


function buildColDefs() {
  MyColDefs1.value = [
    { field: "troop", headerName: trupps.value, filter: "agTextColumnFilter" },
    // the dynamic period column
    { field: mysteps.value, headerName: mysteps.value, filter: "agTextColumnFilter" },

    { field: "SUMME_all", headerName: "Summe", filter: "agNumberColumnFilter" },
    { field: "NHB_all", headerName: "NHB", filter: "agNumberColumnFilter" },
    { field: "BHB_all", headerName: "HB", filter: "agNumberColumnFilter" },
    { field: "BLOESSE_all", headerName: "Blöße", filter: "agNumberColumnFilter" },
  ];
  MyColDefs2.value = [
    { field: "troop", headerName: trupps.value, filter: "agTextColumnFilter" },
    // the dynamic period column
    { field: mysteps.value, headerName: mysteps.value, filter: "agTextColumnFilter" },

    { field: "SUMME_bg", headerName: "Summe", filter: "agNumberColumnFilter" },
    { field: "NHB_bg", headerName: "NHB", filter: "agNumberColumnFilter" },
    { field: "BHB_bg", headerName: "HB", filter: "agNumberColumnFilter" },
    { field: "BLOESSE_bg", headerName: "Blöße", filter: "agNumberColumnFilter" },
  ];
}

/**
 * @function _loadRecords
 * @async
 * @description Fetches records from Supabase 'records' table based on selected organization IDs.
 */
async function _loadRecords() {
  dataload.value = true; // Set the loading flag to true
  const batchSize = 1000;          // size of each chunk
  let offset = 0;                  // start index for the next chunk
  const allRecords = [];           // accumulate results here
  const ids = selectedOrganisations.value.join(',');
  const orFilters = [
    `responsible_administration.in.(${ids})`,
    `responsible_state.in.(${ids})`,
    `responsible_provider.in.(${ids})`,
    `responsible_troop.in.(${ids})`
  ];

  while (true) {
    const { data, error } = await supabase
      .from('records')
      .select('id, completed_at_troop, responsible_troop, updated_at, updated_by, properties')
      .or(orFilters.join(','))
      //auskommentiert zum testen, ob die Filterung funktioniert, wenn auch unvollständige Datensätze (ohne completed_at_troop) berücksichtigt werden
      //.not('completed_at_troop', 'is', null)   // only records with a timestamp
      .range(offset, offset + batchSize - 1); // ← pagination

    if (error) {
      console.error('Fetch Error:', error);
      break;      // stop looping on error
    }

    if (!data?.length) {
      break;      // no more rows – exit loop
    }

    allRecords.push(...data);   // store this chunk
    offset += batchSize;         // move to next chunk
    dataloaded.value = allRecords.length; // update loading status
    console.log(`Loaded ${allRecords.length} records so far...`); // debug log
  }

  // `allRecords` now contains the complete result set
  // ... (use allRecords as needed)
  my_data.value = allRecords; // store in reactive state for further processing
  console.log(`Total records loaded: ${allRecords.length}`);
  console.log(allRecords); // for debugging: check the full dataset in console
  dataload.value = false; // Set the loading flag to false after data is loaded
}

/**
 * @function _transformData
 * @description Transforms raw Supabase records into a format suitable for AG Grid and ECharts.
 * This function can be expanded to include any necessary data manipulation or aggregation logic.
 */
// … existing imports / setup …

// … existing imports / setup …

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
  // 1️⃣ Build a flat summary (unchanged)
  // -----------------------------------------------------------------
  const summary = my_data.value.map(item => ({
    id: item.id,
    completed: item.completed_at_troop,
    troop: item.responsible_troop,
    forest_status: item.properties?.forest_status || 'N/A',
    accessubility: item.properties?.accessibility || 'N/A'
  }));

  // -----------------------------------------------------------------
  // 2️⃣ Aggregate per troop + period (Tag / Woche / Monat)
  // -----------------------------------------------------------------
  const aggregation = my_data.value.reduce((acc, item) => {
    const period = getPeriod(item.updated_at);
    const troop = item.responsible_troop || 'unknown';
    const status = item.properties?.forest_status;
    const accessibility = item.properties?.accessibility;

    // key now includes the chosen period
    const key = `${troop}_${period}`;

    if (!acc[key]) {
      acc[key] = {
        troop,
        [periodKey]: period,   // <-- dynamic column name
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

    // ---- counting logic (unchanged) ----
    if ([3, 4, 5].includes(status)) { acc[key].SUMME_all++; }
    if (status === 4) { acc[key].NHB_all++; }
    if (status === 3 || status === 5) { acc[key].HB_all++; }
    if (status === 3) { acc[key].BLOESSE_all++; }
    if (status === 5) { acc[key].BHB_all++; }

    if ([3, 4, 5].includes(status) && accessibility === 1) { acc[key].SUMME_bg++; }
    if (status === 4 && accessibility === 1) { acc[key].NHB_bg++; }
    if ((status === 3 || status === 5) && accessibility === 1) { acc[key].HB_bg++; }
    if (status === 3 && accessibility === 1) { acc[key].BLOESSE_bg++; }
    if (status === 5 && accessibility === 1) { acc[key].BHB_bg++; }

    return acc;
  }, {});

  // -----------------------------------------------------------------
  // 3️⃣ Convert aggregation to array & sort
  // -----------------------------------------------------------------
  const resultTable = Object.values(aggregation).sort((a, b) => {
    // sort first by the dynamic period column, then by troop
    return a[periodKey].localeCompare(b[periodKey]) || a.troop.localeCompare(b.troop);
  });

  console.table(resultTable);
  console.log("Aggregated Data:", resultTable);
  tabledata.value = resultTable;   // reactive state for AG‑Grid & ECharts
}

/**
 * @function _getOrganizations
 * @description Retrieves a list of organizations the user is authorized to see.
 */
async function _getOrganizations(userId) {
  const { data, error } = await supabase
    .from('users_permissions')
    .select("*, organizations(*)")
    .eq('user_id', userId);

  /*   const { data, error } =await supabase
      .from('users_permissions')
      .select("*, organizations(*)")
      .eq('user_id', "afb591e9-30fa-4442-87da-499b48d91991"); // Faked user ID for testing
   */
  if (error) {
    console.error("Org Fetch Error:", error);
    return;
  }

  organisationsList.value = data
    .filter(p => !p.organizations.deleted)
    .map(item => ({
      id: item.organizations.id,
      name: item.organizations.name
    }));
}

// --- LIFECYCLE HOOKS ---

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await _getOrganizations(data.session.user.id);
    buildColDefs();
    console.log("instance", instance);
  }
});

onUnmounted(() => {
});

// --- WATCHERS ---

// Teste, ob dieser Wert reagiert:
watch(isDark, (val) => {
  console.log('VitePress Dark Mode ist jetzt:', val)
}, { immediate: true })

/** @description Watch for time interval changes */
watch(mysteps, async (val) => {
  buildColDefs();          // update column list
  await _transformData(val);
});

/** @description Watch for organization selection changes to refetch data */
watch(selectedOrganisations, async () => {
  console.log("Selected Orgs:", selectedOrganisations.value);
  await _loadRecords();
  await _transformData();
});

/** @description Trigger chart update whenever data or view settings change */
watch([tabledata, mysteps, selectedOrganisations], async () => {
});

function onGridReady1(params) { gridApi1.value = params.api; }
function onGridReady2(params) { gridApi2.value = params.api; }

/** @description Export to CSV Utility */
/* CSV export ----------------------------------------------------- */
function onBtnExport1() {
  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_Gruppe1_Stat1_nach${mysteps.value}_alle_${new Date().toISOString().slice(0, 10)}.csv`
  });
}

/** @description Export to CSV Utility */
/* CSV export ----------------------------------------------------- */
function onBtnExport2() {
  gridApi2.value?.exportDataAsCsv({
    fileName: `CI-Statistik_Gruppe1_Stat1_nach${mysteps.value}_begehbar_${new Date().toISOString().slice(0, 10)}.csv`
  });
}

watch(globalIsDark, (val) => console.log('Dark Mode ist:', val))
</script>


<template>
  <!-- SECTION: Organization Selection -->
  <v-card>
    <!-- Selection for organizations with a note about the faked user ID for testing -->
    <v-card-title>Organisationen auswählen:</v-card-title>
    <!-- Multi-select for organizations using chips for a modern, deletable UI representation -->
    <v-select v-model="selectedOrganisations" :items="organisationsList" item-title="name" item-value="id" multiple
      chips closable-chips />
  </v-card>

  <!-- DEBUG SECTION: Displays a list of selected organization IDs for verification during development -->
  <v-card v-if="selectedOrganisations.length > 0">
    <v-card-title>Ausgewählte Organisationen (nur zum Debuggen, kann später weg):</v-card-title>
    <v-list>
      <v-list-item v-for="orgId in selectedOrganisations" :key="orgId" :title="orgId" :value="orgId" />
    </v-list>
  </v-card>

  <!-- SECTION: Time Step Configuration -->
  <v-card v-if="tabledata && tabledata.length > 0">
    <!-- Allows user to toggle between Month, Week, and Day aggregation -->
    <v-card-title>Zeitschritte auswählen:</v-card-title>
    <v-select v-model="mysteps" :items="['Monat', 'Woche', 'Tag']" />
  </v-card>

  <v-card v-if="dataload === true">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <!-- SECTION: Tabular Data (AG Grid) -->
  <v-card v-if="tabledata && tabledata.length > 0">
    <v-card-title>Alle Traktecken</v-card-title>
    <!-- Data Grid: Rendered only when organizations are selected. 
         Uses reactive rowData and columnDefs based on the current time step. -->
    <!-- Grid 1 -->
    <ag-grid-vue v-if="selectedOrganisations.length > 0" :rowData="tabledata" :columnDefs="MyColDefs1"
      style="height: 500px; width: 100%" :paginationAutoPageSize="true" :pagination="true"
      :autoSizeStrategy="autoSizeStrategy" :key="isDark" :theme="currentTheme" @grid-ready="onGridReady1" />

    <!-- Fallback if no organization is selected for the grid -->
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar.
    </v-card-text>
    <!-- ACTION: Data Export -->
    <!-- Button to trigger CSV export using the AG Grid API2; disabled if the table is empty -->
    <v-btn color="primary" prepend-icon="mdi-download" @click="onBtnExport1"
      :disabled="!tabledata || tabledata.length === 0">
      CSV Export (Alle Traktecken)
    </v-btn>
  </v-card>


  <!-- SECTION: Tabular Data (AG Grid) -->
  <v-card v-if="tabledata && tabledata.length > 0">
    <v-card-title>Begehbare Traktecken</v-card-title>
    <!-- Data Grid: Rendered only when organizations are selected. 
         Uses reactive rowData and columnDefs based on the current time step. -->
    <!-- Grid 2 -->
    <ag-grid-vue v-if="selectedOrganisations.length > 0" :rowData="tabledata" :columnDefs="MyColDefs2"
      style="height: 500px; width: 100%" :paginationAutoPageSize="true" :pagination="true"
      :autoSizeStrategy="autoSizeStrategy" :key="isDark" :theme="currentTheme" @grid-ready="onGridReady2" />
    <!-- Fallback if no organization is selected for the grid -->
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar.
    </v-card-text>
    <!-- ACTION: Data Export -->
    <!-- Button to trigger CSV export using the AG Grid API2; disabled if the table is empty -->
    <v-btn color="primary" prepend-icon="mdi-download" @click="onBtnExport2"
      :disabled="!tabledata || tabledata.length === 0">
      CSV Export (Begehbare Traktecken)
    </v-btn>
  </v-card>

</template>
