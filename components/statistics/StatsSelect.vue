<script setup>
    //Imports 
    import { ref, onMounted, getCurrentInstance, computed, watch } from 'vue';
    //import TestStats from '../../components/TestStats.vue';

    // Const's

// Datenstruktur mögliche Statistiken
const availableStats = ref([
  {
    "id": "TroopStatistics",
    "name": "1. Truppstatistiken",
    "stats": [
    //  { "id": "PerformanceByTroopCumulative", "name": "1. Kumulative Leistung pro Inventurtrupp" },
      { "id": "PlotsDeliveredByTroopAndDate", "name": "1.1 Abgabe von Ecken durch Trupp nach Datum (View)" },
      { "id": "PerformanceByTroopByMonth", "name": "1.2.1 Leistung pro Inventurtrupp (abgegebene Trakte) pro Monat" },
      { "id": "PerformanceByTroopByWeek", "name": "1.2.2 Leistung pro Inventurtrupp (abgegebene Trakte) pro Woche" },
      { "id": "ListControlledByKT", "name": "1.3.1 Liste kontrollierte Trakte nach Aufnahmetrupp und Kontrolltrupp" },
      { "id": "CountControlledByKT", "name": "1.3.2 Anzahl abgegebener und kontrollierte Trakte nach Aufnahmetrupp und Kontrolltrupp"}//,
    //  { "id": "PerformanceByTroopAverage", "name": "2. Durchschnittliche Leistung pro Inventurtrupp" },
    //  { "id": "PlotsDeliveredByToopAndDate_old", "name": "3. Abgabe von Ecken durch Trupp nach Datum" },


    ]
  },
   {
    "id": "PlotStatistics",
    "name": "2. Plot/Traktstatistiken",
    "stats": [
      { "id": "PlotsNewMarker2", "name": "2.1.1 Alle Ecken bei denen die alte Markierung nicht wiedergefunden, jedoch Ecke eindeutig identifiziert wurde und neue Marke gesetzt wurde"},
      { "id": "PlotsNewMarker3", "name": "2.1.2 Alle Ecken bei denen die Markierung erstmals neu gesetzt wurde"},
      { "id": "PlotsNewMarker4", "name": "2.1.3 Alle Ecken bei denen die alte Markierung nicht wieder gefunden wurde, eine neue Markierung gesetzt wurde und eine Neuaufnahme erfolgte"},
      { "id": "ForestAccessChange", "name": "2.2 Statistik zur geänderten Begehbarkeit gegenüber der Vorgängerinventur"},
      { "id": "ForestStatusChange", "name": "2.3.1 Statistik zu geändertem Waldentscheid gegenüber der Vorgängerinventur nach Traktecken"},
      { "id": "ForestStatusChangeByTroop", "name": "2.3.2 Statistik zu geändertem Waldentscheid gegenüber der Vorgängerinventur nach Anzahl pro Trupp"},
      { "id": "ForestBoundariesUnchanged", "name": "2.4 Statistik zu übernommenen Bestandesgrenzen (42)" },
      { "id": "PlotsNotAccessibleDueToCalamities", "name": "2.6 Statistik zu nicht begehbaren Traktecken wegen Kalamitäten" }
/*      { "id": "s2", "name": "Stat2.2"},
      { "id": "s3", "name": "Stat2.3"}*/
    ]
  }
]);

// Hier werden die Auswahlen gespeichert
const selectedStatsGrp = ref(null);
const selectedStatInGrp = ref(null);
// Das Array für das zweite Select (startet leer/mit Leerstring)
const availableElements = ref([""]);

async function onBtnExport() {
  if (selectedStatsGrp.value && selectedStatInGrp.value) {
  //  window.open(`./${selectedStatsGrp.value.id}/${selectedStatInGrp.value.id}`, '_blank');
    window.location.href=`./${selectedStatsGrp.value.id}/${selectedStatInGrp.value.id}`;
  }
}

// Watcher: Überwacht die Auswahl der Gruppe
watch(selectedStatsGrp, (newGroup) => {
  if (newGroup && newGroup.stats) {
    // Wenn Gruppe gewählt: Stats zuweisen
    availableElements.value = newGroup.stats;
  } else {
    // Falls Auswahl gelöscht wird: zurück auf Standard
    availableElements.value = [""];
  }
  // Reset der zweiten Auswahl bei Gruppenwechsel
  selectedStatInGrp.value = null;
});

</script>

<template>
  <v-card>
    <!-- Descriptive title for the group of stats selection -->
    <v-card-title>Statistikgruppe auswählen:</v-card-title>
    <!-- Erstes Select: Bindung an selectedStatsGrp -->
    <v-select
      v-model="selectedStatsGrp"
      :items="availableStats"
      item-title="name"
      return-object
      label="Gruppe wählen"
    />
  </v-card>
  <v-card>
    <!-- Descriptive title for the group of stats selection -->
    <v-card-title>Statistik aus der Gruppe auswählen:</v-card-title>
    <!-- Zweites Select: Nutzt das dynamisch befüllte availableElements -->
    <v-select
      v-model="selectedStatInGrp"
      :items="availableElements"
      item-title="name"
      return-object
      label="Statistik wählen"
      :disabled="availableElements[0] === ''"
    />
  </v-card>
<!--   <div>
    <p>nur für debug</p> 
    <p>Ausgewählte Gruppe: {{ selectedStatsGrp ? selectedStatsGrp.name : 'Keine Gruppe ausgewählt' }}</p>
    <p>Ausgewählte Statistik: {{ selectedStatInGrp ? selectedStatInGrp.name : 'Keine Statistik ausgewählt' }}</p>
    <p>Ausgewählte Gruppe (Nr.): {{ selectedStatsGrp ? selectedStatsGrp.id : 'Keine Gruppe ausgewählt' }}</p>
    <p>Ausgewählte Statistik (Nr.): {{ selectedStatInGrp ? selectedStatInGrp.id : 'Keine Statistik ausgewählt' }}</p>
  </div> -->
  <v-btn 
    color="primary" 
    prepend-icon="mdi-forward"
    @click="onBtnExport"
    :disabled="!selectedStatsGrp || !selectedStatInGrp"
  >
    Gehe zur Statistik (neuer Tab).
  </v-btn>
</template>