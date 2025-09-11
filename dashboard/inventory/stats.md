# Statistics

<script setup>
  import { ref } from 'vue'
  import Tree from '../../components/statistics/Tree.vue'

  const tab = ref(null)
  const items = ref([
    {
        name: 'WZP',
        value: 1
    }
  ]);
</script>

<v-tabs
  v-model="tab"
  align-tabs="center"
  color="primary">
  <v-tab v-for="item in items" :key="item.value" :value="item.value">
      {{ item.name }}
  </v-tab>
</v-tabs>
<v-tabs-window v-model="tab">
  <v-tabs-window-item :value="1">
    <Tree :federal_state="5"/>
  </v-tabs-window-item>
</v-tabs-window>
