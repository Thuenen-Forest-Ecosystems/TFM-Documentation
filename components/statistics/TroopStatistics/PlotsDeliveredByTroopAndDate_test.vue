<script setup>
// ──────────────────────────────────────────────────────────────────────────────
// 1️⃣ Component Meta-Information (JSDoc)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @component PlotsDeliveredByTroopAndDate_test
 * @description VitePress component for visualizing delivered plot corners (Traktecken)
 * per field inventory team (Trupp) and delivery date using AG Grid.
 *
 * Data source:
 * - Supabase PostgreSQL RPC function: `public.stat_abgegebene_traktecken_pro_at(user_id text)`
 *   executed via POST request, filtering by the selected organization/troop UUID.
 *
 * Columns returned by RPC:
 * - `landesinventurleitung` (text)    : Landesinventurleitung (LIL)
 * - `cluster_name`          (integer) : Traktnummer
 * - `plot_name`             (smallint): Eckennummer (1-4)
 * - `troop_name`            (text)    : Truppname
 * - `kontrolltrupp`         (boolean) : Kontrolltrupp-Kennung (KT)
 * - `abgabedatum`           (timestamp): Abgabedatum des Trupps
 * - `waldentscheid2027`     (integer) : Waldentscheid für 2027
 * - `begehbarkeit2027`      (integer) : Begehbarkeit für 2027
 *
 * Features:
 * - Organization selection with single-org auto-selection
 * - Dynamic AG Grid Quartz theme (Light / Dark mode integration with VitePress)
 * - Dynamic row-height computation & automatic column width fitting
 * - AG Grid client-side sorting, text/number/date/boolean filtering & pagination
 * - CSV export of the loaded records
 */

// ──────────────────────────────────────────────────────────────────────────────
// 2️⃣ Imports – Vue Core, AG Grid, VitePress
// ──────────────────────────────────────────────────────────────────────────────
import { ref, onMounted, getCurrentInstance, computed, watch, inject, onUnmounted } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import { useData } from 'vitepress';

// VitePress dark-mode indicator
const { isDark } = useData();

// Register all AG Grid Community features (sorting, filtering, pagination, etc.)
ModuleRegistry.registerModules([AllCommunityModule]);

// ──────────────────────────────────────────────────────────────────────────────
// 3️⃣ Theme Handling – AG Grid Quartz Theme (Dark / Light Mode)
// ──────────────────────────────────────────────────────────────────────────────
const globalIsDark = inject('globalIsDark', null);

/**
 * Dynamically computes the AG Grid theme matching VitePress's current color mode.
 */
const currentTheme = computed(() => {
  return isDark?.value
    ? themeQuartz.withPart(colorSchemeDark)
    : themeQuartz.withPart(colorSchemeLight);
});

// ──────────────────────────────────────────────────────────────────────────────
// 4️⃣ Reactive State Variables
// ──────────────────────────────────────────────────────────────────────────────
// Loading state indicators
const dataload = ref(false);             // True while an RPC request is pending
const dataloaded = ref(0);               // Count of fetched records for progress display

// Supabase client instance injected globally into the Vue application
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;

// Grid data and organization filter state
const tabledata = ref([]);               // Grid row data (array of records from RPC)
const organisationsList = ref([]);       // List of available organizations for the dropdown
const selectedOrganisation = ref(null);   // UUID of the currently selected organization
const MyColDefs1 = ref([]);              // AG Grid column definitions
const CheckboxExcludeTrainingTest = ref(false); // Optional filter flag for test/training tracks

// AG Grid API instance reference
const gridApi1 = ref(null);

// AG Grid layout options: auto-fit columns to container width with 5px minimum
const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };
const MIN_GRID_HEIGHT = 200; // Minimum grid height in pixels

/**
 * Computes grid height dynamically based on the number of rows (up to 50 rows),
 * enforcing a minimum height of 200px.
 */
const gridHeight = computed(() => {
  const rowHeight = 25;
  const maxRows = 50;
  const rows = Math.min(tabledata.value?.length ?? 0, maxRows) || 1;
  const height = rowHeight * rows;
  return `${Math.max(height, MIN_GRID_HEIGHT)}px`;
});

/**
 * Checks whether an organization is currently selected.
 */
const isOrgSelected = computed(() => {
  return !!selectedOrganisation.value;
});

// ──────────────────────────────────────────────────────────────────────────────
// 5️⃣ Helper: Build AG Grid Column Definitions
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Configures the column definitions for the AG Grid table.
 * Field names correspond directly to the `RETURNS TABLE(...)` definition
 * of the PostgreSQL RPC function `stat_abgegebene_traktecken_pro_at`.
 */
function buildColDefs() {
  MyColDefs1.value = [
    { field: "landesinventurleitung", headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Traktnummer", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Eckennummer", filter: "agNumberColumnFilter" },
    { field: "troop_name", headerName: "Trupp", filter: "agTextColumnFilter" },
    { field: "kontrolltrupp", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "abgabedatum", headerName: "Abgabedatum", filter: "agDateColumnFilter" },
    { field: "waldentscheid2027", headerName: "Waldentscheid2027", filter: "agNumberColumnFilter" },
    { field: "begehbarkeit2027", headerName: "Begehbarkeit2027", filter: "agNumberColumnFilter" }
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// 6️⃣ Data Loading – Fetch Delivered Plots via RPC
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Fetches delivered plot records for the selected organization by invoking
 * the PostgreSQL RPC function `stat_abgegebene_traktecken_pro_at`.
 *
 * The call sends an HTTP POST request to `/rest/v1/rpc/stat_abgegebene_traktecken_pro_at`
 * with parameter `{ user_id: selectedOrganisation.value }`.
 *
 * Fetched records are sorted client-side by:
 * 1. Landesinventurleitung (alphabetical)
 * 2. Truppname (alphabetical)
 * 3. Abgabedatum (chronological)
 */
async function fetchData() {
  // If no organization is selected, clear table data and return early
  if (!selectedOrganisation.value) {
    tabledata.value = [];
    return [];
  }

  dataload.value = true;
  dataloaded.value = 0;

  try {
    // Invoke Supabase RPC function (HTTP POST to /rest/v1/rpc/<fn>)
    const { data, error } = await supabase
      .rpc('stat_abgegebene_traktecken_pro_at', {
        user_id: selectedOrganisation.value
      });

    if (error) throw error;

    const allRecords = data || [];
    dataloaded.value = allRecords.length;

    // Client-side multi-column sort: Landesinventurleitung -> Trupp -> Abgabedatum
    allRecords.sort((a, b) => {
      const compareLil = String(a.landesinventurleitung || '').localeCompare(String(b.landesinventurleitung || ''));
      if (compareLil !== 0) return compareLil;

      const compareTroopName = String(a.troop_name || '').localeCompare(String(b.troop_name || ''));
      if (compareTroopName !== 0) return compareTroopName;

      return String(a.abgabedatum || '').localeCompare(String(b.abgabedatum || ''));
    });

    tabledata.value = allRecords;
    return allRecords;
  } catch (err) {
    console.error('Error fetching or processing RPC data:', err);
    throw err;
  } finally {
    dataload.value = false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 7️⃣ Organization Lookup
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Loads organizations the currently authenticated user has permissions for.
 * Excludes soft-deleted organizations and auto-selects the organization if
 * only a single one is available.
 *
 * @param {string} userId - The authenticated user's UUID from the Supabase session
 */
async function _getOrganizations(userId) {
  const { data, error } = await supabase
    .from('users_permissions')
    .select("*, organizations(*)")
    .eq('user_id', userId);

  if (error) {
    console.error("Org Fetch Error:", error);
    return;
  }

  // Extract non-deleted organizations
  organisationsList.value = data
    .filter(p => !p.organizations.deleted)
    .map(item => ({
      id: item.organizations.id,
      name: item.organizations.name
    }));

  // Auto-select if user only has access to one organization
  if (organisationsList.value.length === 1) {
    selectedOrganisation.value = organisationsList.value[0].id;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 8️⃣ Lifecycle Hooks & Watchers
// ──────────────────────────────────────────────────────────────────────────────
/**
 * On component mount:
 * 1. Retrieve the active user session from Supabase
 * 2. Fetch the authorized organizations
 * 3. Initialize AG Grid column definitions
 */
onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    await _getOrganizations(data.session.user.id);
    buildColDefs();
  }
});

onUnmounted(() => {});

/**
 * Watcher: Re-fetches data whenever the selected organization changes.
 * Clears the table if selection is cleared.
 */
watch([selectedOrganisation, CheckboxExcludeTrainingTest], async () => {
  if (isOrgSelected.value) {
    await fetchData();
  } else {
    tabledata.value = [];
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 9️⃣ AG Grid Event Handlers & Export Actions
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Stores the AG Grid API reference when the grid is initialized.
 * @param {import('ag-grid-community').GridReadyEvent} params
 */
function onGridReady1(params) {
  gridApi1.value = params.api;
}

/**
 * Exports the current grid data to a CSV file.
 * File name contains the current date: CI-Statistik_abgegebene_traktecken_pro_at_YYYY-MM-DD.csv
 */
function onBtnExport1() {
  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_abgegebene_traktecken_pro_at_${new Date().toISOString().slice(0, 10)}.csv`
  });
}
</script>

<template>
  <!-- Organization Selector Card -->
  <v-card class="mb-4">
    <v-card-title>Organisationen auswählen:</v-card-title>
    <v-card-text>
      <v-select
        v-model="selectedOrganisation"
        :items="organisationsList"
        item-title="name"
        item-value="id"
        clearable
        label="Organisation auswählen"
        hide-details
      />
    </v-card-text>
  </v-card>

  <!-- Data Loading Progress Indicator -->
  <v-card v-if="dataload" class="mb-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <!-- Results Card with AG Grid Table and CSV Export -->
  <v-card>
    <v-card-title>Ergebnis</v-card-title>

    <!-- AG Grid Table (rendered when organization is selected and records exist) -->
    <ag-grid-vue
      v-if="isOrgSelected && tabledata && tabledata.length > 0"
      :rowData="tabledata"
      :columnDefs="MyColDefs1"
      :style="{ height: gridHeight }"
      style="width: 100%"
      :paginationAutoPageSize="true"
      :pagination="true"
      :autoSizeStrategy="autoSizeStrategy"
      :key="isDark"
      :theme="currentTheme"
      @grid-ready="onGridReady1"
    />

    <!-- Empty State Message -->
    <v-card-text v-else-if="!dataload" class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar. Bitte Auswahl ändern.
    </v-card-text>

    <!-- Card Actions: CSV Export Button -->
    <v-card-actions>
      <v-btn
        color="primary"
        prepend-icon="mdi-download"
        @click="onBtnExport1"
        :disabled="!tabledata || tabledata.length === 0"
      >
        CSV Export (Alle Traktecken)
      </v-btn>
    </v-card-actions>
  </v-card>
</template>