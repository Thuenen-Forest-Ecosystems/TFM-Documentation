<script setup>
/**
 * @component StatisticsDashboard
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

/** @section Reactive State */
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;

const my_data = ref([]);                // Raw records from Supabase
const tabledata = ref([]);               // Aggregated data for Grid & Chart
const steps = ref('Monat');              // Time step: 'Tag' | 'Woche' | 'Monat'
const organisationsList = ref([]);       // Available orgs for the user
const selectedOrganisations = ref([]);   // User selection (UUIDs)

/** @section Chart & Grid References */
const chartContainer = ref(null);        // DOM ref for ECharts
let myChart = null;                      // ECharts instance
const gridApi = ref(null);               // AG Grid API instance

/**
 * @description Column definitions for AG Grid. 
 * Note: headerName for the label column is reactive to the 'steps' variable.
 */
const MyColDefs = ref([
  { field: "label", headerName: steps, filter: "agTextColumnFilter" },
  { field: "count", headerName: "Anzahl", filter: "agNumberColumnFilter", type: 'rightAligned' }
]);

const autoSizeStrategy = { type: 'fitGridWidth', defaultMinWidth: 10 };

// --- LOGIC & FUNCTIONS ---

/**
 * @function updateChart
 * @async
 * @description Initializes, updates, or disposes of the ECharts instance.
 * Uses nextTick to ensure the v-if container is present in the DOM.
 */
const updateChart = async () => {
  await nextTick();

  // Clean up if container is removed (v-if = false)
  if (!chartContainer.value) {
    if (myChart) {
      myChart.dispose();
      myChart = null;
    }
    return;
  }

  // Init chart instance if not exists
  if (!myChart) {
    myChart = echarts.init(chartContainer.value);
  }

  const data = tabledata.value?.value || [];
  if (data.length === 0) return;

  const option = {
    title: { text: `Statistik: ${steps.value}`, left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label),
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value' },
    series: [{
      name: 'Anzahl',
      data: data.map(d => d.count),
      type: 'bar',
      itemStyle: { color: '#1976D2' }
    }],

toolbox: {
          show: true,
          feature: {
            saveAsImage: {
              show: true, // Enable export to image functionality
              title: 'Save as Image', // Customize the tooltip title
              name: `CI-Statistik_GruppeX_StatY_nach${steps.value}_${new Date().toISOString().slice(0,10)}`,
              backgroundColor: 'White', // Set background color for the exported image
              pixelRatio: 2
            }
          },
          right: '30px',
          top: '10px'
        },
        // Add export component
        export: {
          show: true,
          title: 'Export', // Customize the tooltip title
          name: 'chart',
          pixelRatio: 2,
          textStyle: {
            fontSize: 14,
            color: '#primary' // Use primary color for export text
          }
        },

  };

  myChart.setOption(option, true);
};

/**
 * @function _getData
 * @async
 * @description Fetches records from Supabase 'records' table based on selected organization IDs.
 */
async function _getData() {
  if (!selectedOrganisations.value || selectedOrganisations.value.length === 0) {
    my_data.value = [];
    return;
  }

  const ids = selectedOrganisations.value.join(',');
  const filters = [
    `responsible_administration.in.(${ids})`,
    `responsible_state.in.(${ids})`,
    `responsible_provider.in.(${ids})`,
    `responsible_troop.in.(${ids})`
  ];

  const { data, error } = await supabase
    .from('records')
    .select('id, updated_at')
    .or(filters.join(','));

  if (error) {
    console.error("Fetch Error:", error);
    return;
  }
  my_data.value = data;
}

/**
 * @function _accRecords
 * @description Aggregates raw data into time-based buckets (Day, Week, Month).
 * Updates tabledata.value with a computed property for reactivity.
 */
async function _accRecords(currentStep) {
  const groupedData = my_data.value.reduce((acc, entry) => {
    const date = new Date(entry.updated_at);
    let key;

    if (currentStep === 'Tag') {
      key = date.toISOString().split('T')[0];
    } else if (currentStep === 'Woche') {
      const year = date.getFullYear();
      const oneJan = new Date(year, 0, 1);
      const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
      key = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  tabledata.value = computed(() => 
    Object.entries(groupedData).map(([label, count]) => ({ label, count }))
  );
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
    await _getData();
    await _accRecords(steps.value);
    window.addEventListener('resize', () => myChart?.resize());
    console.log("instance", instance);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', () => myChart?.resize());
  myChart?.dispose();
});

// --- WATCHERS ---

// Teste, ob dieser Wert reagiert:
watch(isDark, (val) => {
  console.log('VitePress Dark Mode ist jetzt:', val)
}, { immediate: true })

/** @description Watch for time interval changes */
watch(steps, async (val) => {
  await _accRecords(val);
});

/** @description Watch for organization selection changes to refetch data */
watch(selectedOrganisations, async () => {
  console.log("Selected Orgs:", selectedOrganisations.value);
  await _getData();
  await _accRecords(steps.value);
});

/** @description Trigger chart update whenever data or view settings change */
watch([tabledata, steps, selectedOrganisations], async () => {
  await updateChart();
}, { deep: true, immediate: true });

/** @description AG Grid Ready Handler */
const onGridReady = (params) => { gridApi.value = params.api; };

/** @description Export to CSV Utility */
function onBtnExport() {
  gridApi.value?.exportDataAsCsv({ fileName: `CI-Statistik_GruppeX_StatY_nach${steps.value}_${new Date().toISOString().slice(0,10)}.csv` });
}

watch(globalIsDark, (val) => console.log('Dark Mode ist:', val))

</script>


<template>
  <!-- SECTION: Organization Selection -->
  <v-card>
    <!-- Selection for organizations with a note about the faked user ID for testing -->
    <v-card-title>Organisationen auswählen (user gefaked, um Auswahl zu testen):</v-card-title>
    <!-- Multi-select for organizations using chips for a modern, deletable UI representation -->
    <v-select
      v-model="selectedOrganisations"
      :items="organisationsList"
      item-title="name"
      item-value="id"
      multiple
      chips
      closable-chips
    />
  </v-card>

  <!-- DEBUG SECTION: Displays a list of selected organization IDs for verification during development -->
  <v-card v-if="selectedOrganisations.length > 0">
    <v-card-title>Ausgewählte Organisationen (nur zum Debuggen, kann später weg):</v-card-title>
    <v-list>
      <v-list-item
        v-for="orgId in selectedOrganisations"
        :key="orgId"
        :title="orgId"
        :value="orgId"
      />
    </v-list>
  </v-card>

  <!-- SECTION: Time Step Configuration -->
  <v-card>
    <!-- Allows user to toggle between Month, Week, and Day aggregation -->
    <v-card-title>Zeitschritte auswählen:</v-card-title>
    <v-select
      v-model="steps"
      :items="['Monat', 'Woche', 'Tag']"
    />
  </v-card>

  <!-- SECTION: Visual Representation (ECharts) -->
  <v-card class="mt-4">
    <v-card-title>Grafische Auswertung</v-card-title>
    
    <!-- Chart Container: Only rendered via v-if if tabledata is available. 
         The 'ref' is used by the updateChart function to mount ECharts. -->
    <div 
      v-if="tabledata.value && tabledata.value.length > 0" 
      ref="chartContainer" 
      style="width: 100%; height: 400px;"
    ></div>

    <!-- Empty State: Shown if no data is returned or no organization is selected -->
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar.
    </v-card-text>
  </v-card>

  <!-- SECTION: Tabular Data (AG Grid) -->
  <v-card>
    <v-card-title>Statistik der Testfälle (updated_at aus der Tabelle public.records):</v-card-title>
    <!-- Data Grid: Rendered only when organizations are selected. 
         Uses reactive rowData and columnDefs based on the current time step. -->
    <ag-grid-vue v-if="selectedOrganisations.length > 0"
      :rowData="tabledata.value"
      :columnDefs="MyColDefs"
      style = " height: 500px; width: 100%"
      :paginationAutoPageSize="true"
      :pagination="true"
      :autoSizeStrategy="autoSizeStrategy"
      :key="isDark"
      :theme="currentTheme"
      @grid-ready="onGridReady">
    </ag-grid-vue>
    <!-- Fallback if no organization is selected for the grid -->
    <v-card-text v-else class="text-center text-grey italic">
      Keine Daten für die aktuelle Auswahl verfügbar.
    </v-card-text>
  </v-card>

  <!-- ACTION: Data Export -->
  <!-- Button to trigger CSV export using the AG Grid API; disabled if the table is empty -->
  <v-btn 
    color="primary" 
    prepend-icon="mdi-download" 
    @click="onBtnExport"
    :disabled="!tabledata.value || tabledata.value.length === 0"
    >
        CSV Export
  </v-btn>
</template>

<style scoped>
  /* Standard height for chart consistency */
  .chart {
    height: 400px;
  }
</style>
