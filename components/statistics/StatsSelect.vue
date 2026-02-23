<script setup>
    //Imports 
    import { ref, onMounted, getCurrentInstance, computed, watch } from 'vue';
    //import TestStats from '../../components/TestStats.vue';

    // Const's

// Datenstruktur mögliche Statistiken
const availableStats = ref([
  {
    "id": "g1",
    "name": "1. Gruppe",
    "stats": [
      { "id": "s1", "name": "Stat1.1" },
      { "id": "s2", "name": "Stat1.2" }
    ]
  },
  {
    "id": "g2",
    "name": "2. Gruppe",
    "stats": [
      { "id": "s1", "name": "Stat2.1"},
      { "id": "s2", "name": "Stat2.2"},
      { "id": "s3", "name": "Stat2.3"}
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
    window.open(`./${selectedStatsGrp.value.id}/${selectedStatInGrp.value.id}`, '_blank');
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
      label="Stat wählen"
      :disabled="availableElements[0] === ''"
    />
  </v-card>
  <div>
    <!-- Hier könnte die Ausgabe der ausgewählten Statistik erfolgen -->
    <p>nur für debug</p> 
    <p>Ausgewählte Gruppe: {{ selectedStatsGrp ? selectedStatsGrp.name : 'Keine Gruppe ausgewählt' }}</p>
    <p>Ausgewählte Statistik: {{ selectedStatInGrp ? selectedStatInGrp.name : 'Keine Statistik ausgewählt' }}</p>
    <p>Ausgewählte Gruppe (Nr.): {{ selectedStatsGrp ? selectedStatsGrp.id : 'Keine Gruppe ausgewählt' }}</p>
    <p>Ausgewählte Statistik (Nr.): {{ selectedStatInGrp ? selectedStatInGrp.id : 'Keine Statistik ausgewählt' }}</p>
  </div>
  <v-btn 
    color="primary" 
    prepend-icon="mdi-forward"
    @click="onBtnExport"
    :disabled="!selectedStatsGrp || !selectedStatInGrp"
  >
    Gehe zur Statistik (neuer Tab).
  </v-btn>
</template>