<script setup>
/**
 * @component ExportCsvButton
 * @description Reusable Vuetify button component for AG Grid CSV exports supporting both
 * standard CSV (comma separated, decimal point) and German Excel CSV (semicolon separated, decimal comma).
 */
import { computed } from 'vue';

const props = defineProps({
  gridApi: { type: Object, default: null },
  filenamePrefix: { type: String, required: true },
  selectedOrganisation: { type: [String, Object], default: null },
  organisationsList: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: 'CSV Export' },
  color: { type: String, default: 'primary' },
  icon: { type: String, default: 'mdi-download' }
});

function generateFilename(suffix = '') {
  let prefix = props.filenamePrefix.endsWith('_') ? props.filenamePrefix.slice(0, -1) : props.filenamePrefix;
  let namePart = '';
  if (props.selectedOrganisation) {
    const orgId = typeof props.selectedOrganisation === 'object'
      ? props.selectedOrganisation.id
      : props.selectedOrganisation;

    const selectedItem = props.organisationsList?.find(item => item.id === orgId);
    if (selectedItem?.name) {
      namePart = `${selectedItem.name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')}_`;
    }
  }
  const datePart = new Date().toISOString().slice(0, 10);
  const suffixPart = suffix ? `_${suffix}` : '';
  return `${prefix}_${namePart}${datePart}${suffixPart}.csv`;
}

function exportStandardCsv() {
  if (!props.gridApi) return;
  props.gridApi.exportDataAsCsv({
    fileName: generateFilename()
  });
}

function exportGermanExcelCsv() {
  if (!props.gridApi) return;
  props.gridApi.exportDataAsCsv({
    fileName: generateFilename('excel_de'),
    columnSeparator: ';',
    processCellCallback: (params) => {
      const val = params.value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') {
        return String(val).replace('.', ',');
      }
      if (typeof val === 'string' && /^-?\d+\.\d+$/.test(val.trim())) {
        return val.trim().replace('.', ',');
      }
      return val;
    }
  });
}
</script>

<template>
  <v-menu location="bottom start">
    <template #activator="{ props: menuProps }">
      <v-btn
        :color="color"
        :prepend-icon="icon"
        append-icon="mdi-chevron-down"
        :disabled="disabled || !gridApi"
        v-bind="menuProps"
      >
        {{ label }}
      </v-btn>
    </template>
    <v-list density="compact">
      <v-list-item @click="exportStandardCsv">
        <template #prepend>
          <v-icon icon="mdi-file-delimited-outline" class="mr-2" />
        </template>
        <v-list-item-title>Standard CSV (Komma: , | Dezimal: .)</v-list-item-title>
      </v-list-item>
      <v-list-item @click="exportGermanExcelCsv">
        <template #prepend>
          <v-icon icon="mdi-file-excel-outline" color="success" class="mr-2" />
        </template>
        <v-list-item-title>Excel CSV Deutsch (Semikolon: ; | Dezimalkomma: ,)</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
