<script setup>
    //Imports 
    import { ref, onMounted, getCurrentInstance, computed, watch } from 'vue';
    import StatsSelect from '../../components/statistics/StatsSelect.vue';
</script>

# Statistiken

Hier werden Statistiken zur Auswahl angezeigt

<v-app class="bg-transparent">
  <StatsSelect />
</v-app>

