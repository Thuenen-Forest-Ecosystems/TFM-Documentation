---
aside: false
---

<script setup>
import MapExample from '../components/map_example/map_example.vue';
</script> 

# Interaktive Kartenanwendung zur Datenvisualisierung

Wir zeigen konzeptionell, wie man eine interaktive Karte mit [MapLibre GL](https://maplibre.org/) erstellt, um Daten der Bundeswaldinventur (BWI) aus der Thünen-API zu visualisieren.

### Datenschutz und das LAEA-Gitter
Da die exakten geografischen Positionen der BWI-Trakte geheim gehalten werden müssen, sind die öffentlichen BWI-Daten in der API den 1x1 km LAEA-Gitterzellen zugeordnet. Wir nutzen diese Zellen, um die Daten der BWI-Trakte an ihrer ungefähren Position auf der Karte anzuzeigen.

### Aufbau der Karte
Die Anwendung kombiniert verschiedene Datenquellen:
*   **Dynamische Basiskarte:** Wechselt automatisch zwischen OpenStreetMap (Light Mode) und CartoDB Dark Matter (Dark Mode), passend zum eingestellten Theme.
*   **WMS-Overlay:** Das 1 km LAEA-Gitter für Deutschland wird als optimierter (getachelter) WMS-Layer über die Karte gelegt.

### Interaktive Funktionen
Beim Klick auf eine Gitterzelle wird folgender Prozess ausgelöst:
1.  **Gitter-Identifizierung:** Wir rufen die eindeutige ID der LAEA-Gitterzelle über eine *GetFeatureInfo*-Anfrage vom WMS-Layer ab.
2.  **API-Datenabruf:** Mit dieser ID führen wir einen API-Aufruf durch, um strukturierte Details des Traktes (Trakte, Plots, Bäume, Totholz usw.) abzurufen.
3.  **Status-Übersetzung:** Technische Status-Codes (z. B. für den Baumstatus) werden über eine Lookup-API automatisch in deutsche Klartexte übersetzt.

### Analyse-Dashboard
Sobald Daten geladen sind, bietet die Anwendung verschiedene Möglichkeiten zur Auswertung:
*   **Filterung:** Die Daten können nach **Inventur-Intervall** (z. B. BWI 2012, BWI 2022) oder **Baum-Status** (z. B. lebend, entnommen, ausgefallen) gefiltert werden.
*   **Echtzeit-Statistik:** In der Sidebar werden sofort berechnete Kennzahlen wie Baum-Anzahl, Durchschnitts-BHD, Durchschnitts-Höhe und Totholz-Metriken angezeigt.
*   **Detail-Tabelle:** Unter der Karte listet eine strukturierte Tabelle alle einzelnen Bäume mit ihren spezifischen Attributen auf.

Falls eine Zelle angeklickt wird, die keinen BWI-Trakt enthält, wird in der Sidebar eine entsprechende Meldung angezeigt.

<MapExample />

Feedback ist sehr willkommen.
