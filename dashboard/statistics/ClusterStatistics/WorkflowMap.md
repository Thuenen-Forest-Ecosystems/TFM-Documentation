---
layout: home
---

<!-- Script block for Vue's <script setup> syntax. This section
     imports and prepares any components or utilities needed by the template. -->
<script setup>
    /*  Import the specific Stats component from its relative path.*/
    import Stats from '../../../components/statistics/ClusterStatistics/WorkflowMap.vue';
</script>

<!-- Markdown heading that will be rendered as an <h1> element.
     It describes the content: "Cumulative performance per inventory team". -->
[← Zurück zur Statistikauswahl](/dashboard/statistics/){.vp-button .brand}


# Workflowkarte (View)

::: warning Hinweis
Diese Karte ust derzeit ein erster Vorschlag und kann noch Fehler enthalten. Weitere Ergänzungen und Korrekturen folgen. Wir bitten um kritische Prüfung und um Vorschläge für weitere Karten. Anmerkungen und Vorschläge schicken Sie bitte an bwi-support@thuenen.de.

(Version 260723)
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