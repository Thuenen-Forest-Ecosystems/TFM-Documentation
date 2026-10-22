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
  // If no organization or troop is selected, clear table data and return early
  if (!selectedOrganisation.value) {
    tabledata.value = [];
    dataloaded.value = 0;
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

    if (error) {
      console.warn('RPC stat_abgegebene_traktecken_pro_at returned an error:', error);
      tabledata.value = [];
      dataloaded.value = 0;
      return [];
    }

    // Prevent errors if RPC response is null, undefined, not an array, or empty
    if (!data || !Array.isArray(data) || data.length === 0) {
      tabledata.value = [];
      dataloaded.value = 0;
      return [];
    }

    const allRecords = [...data];
    dataloaded.value = allRecords.length;

    // Client-side multi-column sort: Landesinventurleitung -> Trupp -> Abgabedatum
    allRecords.sort((a, b) => {
      if (!a || !b) return 0;

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
    tabledata.value = [];
    dataloaded.value = 0;
    return [];
  } finally {
    dataload.value = false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 7️⃣ Organization & Troop Lookup
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Loads organizations and troops the currently authenticated user has permissions for.
 * Queries `users_permissions` / `organizations` as well as `public.troop` to populate
 * the selection dropdown with both organizations and their associated troops.
 *
 * @param {string} userId - The authenticated user's UUID from the Supabase session
 */
async function _getOrganizations(userId) {
  // 1. Fetch user permissions and related organizations
  const { data, error } = await supabase
    .from('users_permissions')
    .select("*, organizations(*)")
    .eq('user_id', userId);

  if (error) {
    console.error("Org Fetch Error:", error);
    return;
  }

  const validPermissions = data || [];

  // All organization IDs the user has access to
  const allUserOrgIds = validPermissions
    .filter(p => p.organizations && !p.organizations.deleted)
    .map(p => p.organizations.id);

  // Extract organizations according to admin filter
  const orgItems = validPermissions
    .filter(p => p.organizations && !p.organizations.deleted && p.is_organization_admin)
    .map(item => ({
      id: item.organizations.id,
      name: item.organizations.name,
      type: 'org',
      typeLabel: 'Organisation',
      icon: 'mdi-domain',
      color: 'primary'
    }));

  // 2. Query public.troop for troops belonging to the user's organizations
  let troopItems = [];
  if (allUserOrgIds.length > 0) {
    const { data: troopData, error: troopError } = await supabase
      .from('troop')
      .select('id, name, deleted, organization_id, is_control_troop')
      .in('organization_id', allUserOrgIds)
      .order('name');

    if (troopError) {
      console.error("Troop Fetch Error:", troopError);
    } else if (troopData) {
      troopItems = troopData
        .filter(t => !t.deleted)
        .map(t => ({
          id: t.id,
          name: t.name,
          type: 'troop',
          typeLabel: t.is_control_troop ? 'Kontrolltrupp' : 'Trupp',
          icon: t.is_control_troop ? 'mdi-account-check' : 'mdi-account-group',
          color: t.is_control_troop ? 'warning' : 'teal'
        }));
    }
  } else {
    // Fallback if no specific organizations are assigned
    const { data: troopData, error: troopError } = await supabase
      .from('troop')
      .select('id, name, deleted, is_control_troop')
      .order('name');

    if (troopError) {
      console.error("Troop Fetch Error:", troopError);
    } else if (troopData) {
      troopItems = troopData
        .filter(t => !t.deleted)
        .map(t => ({
          id: t.id,
          name: t.name,
          type: 'troop',
          typeLabel: t.is_control_troop ? 'Kontrolltrupp' : 'Trupp',
          icon: t.is_control_troop ? 'mdi-account-check' : 'mdi-account-group',
          color: t.is_control_troop ? 'warning' : 'teal'
        }));
    }
  }

  // Combine organizations and troops in the selection list
  organisationsList.value = [
    ...orgItems,
    ...troopItems
  ];

  // Auto-select if only a single entry is available
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
 * File name contains the selected organization/troop name and current date:
 * CI-Statistik_abgegebene_traktecken_pro_at_<Organisation/Trupp>_YYYY-MM-DD.csv
 */
function onBtnExport1() {
  const selectedItem = organisationsList.value.find(item => item.id === selectedOrganisation.value);
  const namePart = selectedItem?.name ? `${selectedItem.name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}_` : '';
  const datePart = new Date().toISOString().slice(0, 10);

  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_abgegebene_traktecken_pro_at_${namePart}${datePart}.csv`
  });
}
</script>

<template>
  <!-- Organization and Troop Selector Card -->
  <v-card class="mb-4">
    <v-card-title>Organisation oder Trupp auswählen:</v-card-title>
    <v-card-text>
      <v-select
        v-model="selectedOrganisation"
        :items="organisationsList"
        item-title="name"
        item-value="id"
        clearable
        label="Organisation oder Trupp auswählen"
        hide-details
      >
        <!-- Optische Unterscheidung: Anzeige der getroffenen Auswahl -->
        <template #selection="{ item }">
          <div class="d-flex align-center">
            <v-icon
              v-if="item.raw?.icon"
              start
              size="small"
              :icon="item.raw.icon"
              :color="item.raw.color"
              class="mr-2"
            />
            <span class="mr-2">{{ item.raw?.name }}</span>
            <v-chip
              v-if="item.raw?.typeLabel"
              size="x-small"
              :color="item.raw.color"
              variant="tonal"
            >
              {{ item.raw.typeLabel }}
            </v-chip>
          </div>
        </template>

        <!-- Optische Unterscheidung: Anzeige in der Auswahlliste -->
        <template #item="{ props, item }">
          <v-list-item
            v-bind="props"
            :title="item.raw?.name"
          >
            <template #prepend>
              <v-icon
                v-if="item.raw?.icon"
                :icon="item.raw.icon"
                :color="item.raw.color"
              />
            </template>
            <template #append>
              <v-chip
                v-if="item.raw?.typeLabel"
                size="x-small"
                :color="item.raw.color"
                variant="tonal"
              >
                {{ item.raw.typeLabel }}
              </v-chip>
            </template>
          </v-list-item>
        </template>
      </v-select>
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