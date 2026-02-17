<script setup>
// Imports
import { ref, onMounted, getCurrentInstance, computed, watch } from 'vue';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component 
// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

// Variables
const instance = getCurrentInstance();
const supabase = instance.appContext.config.globalProperties.$supabase;
const my_data = ref([]);
const tabledata = ref([]);
const steps = ref('Monat');
const user = ref({});
const organisationsList = ref([]);
const selectedOrganisations = ref([]);

// My Column Definitions: Defines the columns to be displayed.
const MyColDefs = ref([
  { field: "label",headerName: steps, filter: "agTextColumnFilter" },
  { field: "count",headerName: "Anzahl", filter: "agNumberColumnFilter", type: 'rightAligned' }
]);

// 1. Grid API Ref erstellen
const gridApi = ref(null);

// 2. Funktion beim Initialisieren des Grids
const onGridReady = (params) => {
  gridApi.value = params.api;
};

// 3. Export Funktion
function onBtnExport() {
  if (gridApi.value) {
    gridApi.value.exportDataAsCsv({
      fileName: `export_statistik_${steps.value}.csv`
    });
  } else {
    console.error("Grid API ist noch nicht bereit.");
  }
}

// Functions
// get data
async function _getData() {
  if (!selectedOrganisations.value) {
    console.warn('No organisations selected. Please select at least one organisation to fetch data.');
    my_data.value = []; // Clear data if no organisations are selected
    return;
  } else {
    // Log the selected organisations for debugging purposes
    console.log('Selected Organisations:', selectedOrganisations.value);
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
    .or(filters.join(',')); // Verbindet die Filter ohne Leerzeichen

    if (error) {
      console.error(error);
     return;
    }
    my_data.value = data;
    console.log('Fetched Data:', my_data.value);
  }
}

// Accumulate records based on the selected time step (month, week, day)
async function _accRecords(steps) {
    const groupedData = my_data.value.reduce((acc, entry) => {
      const date = new Date(entry.updated_at);
      let key;
      // Dynamic key based on intervall
      if (steps === 'Tag') {
        // Day: YYYY-MM-DD
        key = date.toISOString().split('T')[0];
      } else if (steps === 'Woche') {
        // Week: ISO-Week or simply "Year-Weeknumber"
        const year = date.getFullYear();
        const oneJan = new Date(year, 0, 1);
        const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
        key = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      } else {
        // Month (Standard): YYYY-MM
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    // Conversion into array for viewing
    tabledata.value = computed(() => {
      return Object.entries(groupedData).map(([label, count]) => ({
        label, // generic as label is used for all intervalls
        count // generic as count is used for all intervalls
      }));
    });
  }

// Auto Size Strategy for the ag-grid: Configures the grid to fit the width of the columns and sets a default minimum width.
const autoSizeStrategy = {
    type: 'fitGridWidth',
    defaultMinWidth: 10
};

// Fetches organizations associated with the user.
async function _getOrganizations(userId){
    //  the next line should be activated in production to work with the logged in user
    //await supabase.from('users_permissions').select("*, organizations(*)").eq('user_id', userId).then(({ data, error }) => {
    // the next line with a fake userID is for testing purposes only, should be removed
    await supabase.from('users_permissions').select("*, organizations(*)").eq('user_id', "afb591e9-30fa-4442-87da-499b48d91991").then(({ data, error }) => {
            if (error) {
        console.error(error);
            return;
        }
        // only if organization is not deleted
        data = data.filter(permission => !permission.organizations.deleted);
        //organizationsAccess.value = data;
        console.log('OrgsAccess:', data.value);
        console.log('OrgsAccess.length:', data.length);
        const getSimplifiedOrgs = (data) => {
            const result = [];
            data.forEach(item => {
                result.push({
                id: item.organizations.id,
                name: item.organizations.name
                });
            });
        return result;
        };
        organisationsList.value = getSimplifiedOrgs(data);      
        console.log('organisationsList.value: ', organisationsList.value);
    });
}

// Lifecycle Hook - onMounted: Fetches the session, organisation, data and makes first aggregeation when the component is mounted.
onMounted(async () => {
  const { data, error } = await supabase.auth.getSession();
  if (data.session) {
    await _getOrganizations(data.session.user.id);
    await _getData();
    await _accRecords(steps.value);
  }
});

// Watchers
// Watch for changes in the 'steps' variable and update the accumulated records accordingly.
watch(steps, async (newsteps) => {
  await _accRecords(newsteps);
});

// Watch for changes in the 'selectedOrganisations' variable and log the new selection.
watch(selectedOrganisations, async (newselectedOrganisations) => {
  console.log('Selected Organisations changed:', newselectedOrganisations);
  await _getData();
  await _accRecords(steps.value);
});

</script>

<template>
  <v-card>
    <v-card-title>Organisationen auswählen:</v-card-title>
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
  <!-- ab hier nur zum debuggen-->
  <v-card v-if="selectedOrganisations.length > 0">
    <v-card-title>Ausgewählte Organisationen (nur zum Debuggen):</v-card-title>
    <v-list>
      <v-list-item
        v-for="orgId in selectedOrganisations"
        :key="orgId"
        :title="orgId"
        :value="orgId"
      />
    </v-list>
  </v-card>
  <!-- bis hier nur zum debuggen-->
  <v-card>
    <v-card-title>Zeitschritte auswählen:</v-card-title>
    <v-select
      v-model="steps"
      :items="['Monat', 'Woche', 'Tag']"
    />
  </v-card>
  <v-card>
    <v-card-title>Statistik der Testfälle (updated_at aus der Tabelle public.records):</v-card-title>
    <ag-grid-vue
      :rowData="tabledata.value"
      :columnDefs="MyColDefs"
      style = " height: 500px; width: 100%"
      :paginationAutoPageSize="true"
      :pagination="true"
      :autoSizeStrategy="autoSizeStrategy"
      @grid-ready="onGridReady">
    </ag-grid-vue>
  </v-card>
        <v-btn 
        color="primary" 
        prepend-icon="mdi-download" 
        @click="onBtnExport"
        :disabled="!tabledata.value || tabledata.value.length === 0"
      >
        CSV Export
      </v-btn>

</template>