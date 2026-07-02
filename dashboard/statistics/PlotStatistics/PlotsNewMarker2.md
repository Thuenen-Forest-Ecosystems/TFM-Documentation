---
layout: home
---

<!-- Script block for Vue's <script setup> syntax. This section
     imports and prepares any components or utilities needed by the template. -->
<script setup>
    /*  Import the specific Stats component from its relative path.*/
    import Stats from '../../../components/statistics/PlotStatistics/PlotsNewMarker2.vue';
</script>

<!-- Markdown heading that will be rendered as an <h1> element.
     It describes the content: "Cumulative performance per inventory team". -->
[← Zurück zur Statistikauswahl](/dashboard/statistics/){.vp-button .brand}


# Alle Ecken bei denen die alte Markierung nicht wiedergefunden, jedoch Ecke eindeutig identifiziert wurde und neue Marke gesetzt wurden  (View)

::: warning Hinweis
Diese Statistik(en) sind derzeit ein erster Vorschlag und können noch Fehler enthalten. Weitere Ergänzungen und Korrekturen folgen. Wir bitten um kritische Prüfung und um Vorschläge für weitere Statistiken. Anmerkungen und Vorschläge schicken Sie bitte an bwi-support@thuenen.de.

(Version 260702)
:::

<!-- Vuetify application wrapper with a transparent background.
     It provides the necessary layout and styling context for the component. -->
<v-app class="bg-transparent">
  <!-- Render the imported TestStats component inside the Vuetify app container. -->
  <Stats />
</v-app>

<style>
    .vp-doc.container{
        max-width: 5000px !important;
        margin: 0 auto;
    }
</style> 