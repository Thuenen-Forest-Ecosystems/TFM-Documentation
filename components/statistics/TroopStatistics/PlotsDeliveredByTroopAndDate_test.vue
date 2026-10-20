<script setup>
/**
 * @component Wann, welcher Trupp welche Ecke abgegeben hat
 * @description A VitePress component for visualizing Supabase records using AG Grid
 * Supports organization-based filtering and dynamic updates.
 */

import { ref, onMounted, getCurrentInstance, computed, watch, inject, onUnmounted } from 'vue';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3";
import { useData } from 'vitepress';

const { isDark } = useData();
ModuleRegistry.registerModules([AllCommunityModule]);

const globalIsDark = inject('globalIsDark', null);
const currentTheme = computed(() => {
  return isDark?.value
    ? themeQuartz.withPart(colorSchemeDark)
    : themeQuartz.withPart(colorSchemeLight);
});

const dataload = ref(false);
const dataloaded = ref(0);
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;
const tabledata = ref([]);
const organisationsList = ref([]);
const selectedOrganisation = ref(null);
const MyColDefs1 = ref([]);
const CheckboxExcludeTrainingTest = ref(false);
const gridApi1 = ref(null);
const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 5 };
const MIN_GRID_HEIGHT = 200;
const gridHeight = computed(() => {
  const rowHeight = 25;
  const maxRows = 50;
  const rows = Math.min(tabledata.value?.length ?? 0, maxRows) || 1;
  const height = rowHeight * rows;
  return `${Math.max(height, MIN_GRID_HEIGHT)}px`;
});

const isOrgSelected = computed(() => {
  return !!selectedOrganisation.value;
});

function buildColDefs() {
  MyColDefs1.value = [
    { field: "lil", headerName: "Landesinventurleitung", filter: "agTextColumnFilter" },
    { field: "cluster_name", headerName: "Trakt", filter: "agNumberColumnFilter" },
    { field: "plot_name", headerName: "Ecke", filter: "agNumberColumnFilter" },
    { field: "troop_name", headerName: "Trupp", filter: "agTextColumnFilter" },
    { field: "kt", headerName: "Kontrolltrupp?", filter: "agBooleanColumnFilter" },
    { field: "completed_as_troop_latest", headerName: "Abgabedatum", filter: "agDateColumnFilter" },
    { field: "wald2027", headerName: "Waldentscheid", filter: "agNumberColumnFilter" },
    { field: "begehbar2027", headerName: "Begehbarkeit", filter: "agNumberColumnFilter" }
  ];
}

async function fetchData() {
  if (!selectedOrganisation.value) {
    tabledata.value = [];
    return [];
  }

  dataload.value = true;
  dataloaded.value = 0;

  const id = selectedOrganisation.value;
  const orFilter = `responsible_administration.eq.${id},responsible_state.eq.${id},responsible_provider.eq.${id},responsible_troop.eq.${id}`;

  try {
    const { data, error } = await supabase
      .from('v_stats_troop_completed_latest')
      .select('responsible_state, responsible_administration, responsible_provider, responsible_troop, lil, cluster_name, plot_name, troop_name, kt, completed_as_troop_latest, wald2027, begehbar2027')
      .or(orFilter);

      if (error) throw error;

    const allRecords = data || [];
    dataloaded.value = allRecords.length;

    allRecords.sort((a, b) => {
      const compareState = String(a.responsible_state || '').localeCompare(String(b.responsible_state || ''));
      if (compareState !== 0) return compareState;

      const compareTroopName = String(a.troop_name || '').localeCompare(String(b.troop_name || ''));
      if (compareTroopName !== 0) return compareTroopName;

      return String(a.completed_as_troop_latest || '').localeCompare(String(b.completed_as_troop_latest || ''));
    });

    tabledata.value = allRecords;
    return allRecords;
  } catch (err) {
    console.error('Error fetching or processing data:', err);
    throw err;
  } finally {
    dataload.value = false;
  }
}

async function _getOrganizations(userId) {
  const { data, error } = await supabase
    .from('users_permissions')
    .select("*, organizations(*)")
    .eq('user_id', userId);

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

  if (organisationsList.value.length === 1) {
    selectedOrganisation.value = organisationsList.value[0].id;
  }
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    await _getOrganizations(data.session.user.id);
    buildColDefs();
  }
});

onUnmounted(() => {});
watch([selectedOrganisation, CheckboxExcludeTrainingTest], async () => {
  if (isOrgSelected.value) {
    await fetchData();
  } else {
    tabledata.value = [];
  }
});

function onGridReady1(params) {
  gridApi1.value = params.api;
}

function onBtnExport1() {
  gridApi1.value?.exportDataAsCsv({
    fileName: `CI-Statistik_troop_completed_latest_${new Date().toISOString().slice(0, 10)}.csv`
  });
}
</script>

<template>
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

  <v-card v-if="dataload" class="mb-4">
    <v-card-title class="d-flex flex-column align-center">
      <p><span>Lade Daten ({{ dataloaded }} Datensätze)</span></p>
      <p><v-progress-circular indeterminate color="primary" class="mt-2" /></p>
    </v-card-title>
  </v-card>

  <v-card>
    <v-card-title>Ergebnis</v-card-title>

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

    <v-card-text v-else-if="!dataload" class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar. Bitte Auswahl ändern.
    </v-card-text>

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