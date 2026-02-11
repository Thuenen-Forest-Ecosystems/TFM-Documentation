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
const steps = ref("Monat"); 

// My Column Definitions: Defines the columns to be displayed.
const MyColDefs = ref([
  { field: "label",headerName: steps, filter: "agTextColumnFilter" },
  { field: "count",headerName: "Anzahl", filter: "agNumberColumnFilter", type: 'rightAligned' }
]);

// Functions
// get data
async function _getData() {
  const { data, error } = await supabase.from('records').select('id,updated_at').limit(1000000);
  if (error) {
    console.error(error);
    return;
  }
  my_data.value = data;
}

// Accumulate records based on the selected time step (month, week, day)
async function _accRecords(steps) {
    const groupedData = my_data.value.reduce((acc, entry) => {
      const date = new Date(entry.updated_at);
      let key;
      // Dynamic key based on intervall
      if (steps === "Tag") {
        // Day: YYYY-MM-DD
        key = date.toISOString().split('T')[0];
      } else if (steps === "Woche") {
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

// Lifecycle Hook - onMounted: Fetches the session and data when the component is mounted.
onMounted(async () => {
  const { data, error } = await supabase.auth.getSession();
  if (data.session) {
    await _getData();
    await _accRecords(steps);
  }
});

// Watchers
// Watch for changes in the 'steps' variable and update the accumulated records accordingly.
watch(steps, async (newsteps) => {
  _accRecords(newsteps);
});

</script>

<template>
  <div>Zeitschritte auswählen: 
    <select v-model="steps">
      <option disabled value="">Please select one</option>
      <option value="Monat">Monat</option>
      <option value="Woche">Woche</option>
      <option value="Tag">Tag</option>
    </select>
  </div>
  <ag-grid-vue
    :rowData="tabledata.value"
    :columnDefs="MyColDefs"
    style = " height: 500px; width: 100%"
    :paginationAutoPageSize="true"
    :pagination="true"
    :autoSizeStrategy="autoSizeStrategy">
  </ag-grid-vue>
</template>