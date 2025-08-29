    <script setup>
    import { onMounted, ref, nextTick } from 'vue';
    import Handsontable from 'handsontable';
    import 'handsontable/styles/handsontable.css';
    import 'handsontable/styles/ht-theme-main.css';

    // Hier können Sie Daten für die Tabelle definieren.
    // In einem echten Szenario würden diese vielleicht von einer API geladen.
    const hotData = ref([
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
    ]);

    // Referenz zum Tabellen-Container
    const tableContainer = ref(null);
    let hotInstance = null;

    onMounted(async () => {

        await nextTick();

      // Sicherstellen, dass Handsontable erst im Browser ausgeführt wird
      if (tableContainer.value) {
        hotInstance = new Handsontable(tableContainer.value, {
            data: Handsontable.helper.createSpreadsheetData(5, 50),
            width: '100%',
            height: 'auto',
            colHeaders: true,
            rowHeaders: true,
            colWidths: 100,
            manualColumnResize: true,
            licenseKey: 'non-commercial-and-evaluation', // Nicht-kommerzielle Lizenz verwenden
        });
      }
    });
    
    </script>

    <template>
      <div style="width: 500px; height:500px;" ref="tableContainer"></div>
    </template>