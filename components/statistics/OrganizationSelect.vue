<script setup>
import { ref, onMounted, getCurrentInstance, watch } from 'vue';
import { getOrganizationsAndTroops } from './useOrganizationLookup.js';

const props = defineProps({
  modelValue: {
    type: [String, Array, null],
    default: null
  },
  label: {
    type: String,
    default: 'Organisation oder Trupp auswählen'
  },
  title: {
    type: String,
    default: 'Organisation oder Trupp auswählen:'
  },
  autoSelect: {
    type: Boolean,
    default: true
  },
  clearable: {
    type: Boolean,
    default: true
  },
  multiple: {
    type: Boolean,
    default: false
  },
  chips: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'loaded', 'change']);

const instance = getCurrentInstance();
const supabase = instance?.appContext?.config?.globalProperties?.$supabase;

const organisationsList = ref([]);
const loading = ref(false);

const selectedValue = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
  selectedValue.value = val;
});

watch(selectedValue, (val) => {
  emit('update:modelValue', val);
  emit('change', val);
});

onMounted(async () => {
  if (!supabase) return;

  loading.value = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      const res = await getOrganizationsAndTroops(supabase, data.session.user.id);
      organisationsList.value = res.organisationsList;
      emit('loaded', res);

      // Auto-select if a single entry is available and nothing is selected yet
      const isEmpty = !selectedValue.value || (Array.isArray(selectedValue.value) && selectedValue.value.length === 0);
      if (props.autoSelect && organisationsList.value.length === 1 && isEmpty) {
        selectedValue.value = props.multiple
          ? [organisationsList.value[0].id]
          : organisationsList.value[0].id;
      }
    }
  } catch (err) {
    console.error('Error in OrganizationSelect component:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-card class="mb-4">
    <v-card-title v-if="title">{{ title }}</v-card-title>
    <v-card-text>
      <v-select
        v-model="selectedValue"
        :items="organisationsList"
        item-title="name"
        item-value="id"
        :clearable="clearable"
        :label="label"
        :loading="loading"
        :multiple="multiple"
        :chips="chips || multiple"
        :closable-chips="multiple"
        hide-details
      >
        <!-- Optische Unterscheidung: Anzeige der getroffenen Auswahl -->
        <template #selection="{ item }">
          <div class="d-flex align-center">
            <v-icon
              v-if="item.raw?.icon"
              start
              size="small"
              :icon="item.raw.icon"
              :color="item.raw.color"
              class="mr-2"
            />
            <span class="mr-2">{{ item.raw?.name }}</span>
            <v-chip
              v-if="item.raw?.typeLabel"
              size="x-small"
              :color="item.raw.color"
              variant="tonal"
            >
              {{ item.raw.typeLabel }}
            </v-chip>
          </div>
        </template>

        <!-- Optische Unterscheidung: Anzeige in der Auswahlliste -->
        <template #item="{ props: itemProps, item }">
          <v-list-item
            v-bind="itemProps"
            :title="item.raw?.name"
          >
            <template #prepend>
              <v-icon
                v-if="item.raw?.icon"
                :icon="item.raw.icon"
                :color="item.raw.color"
              />
            </template>
            <template #append>
              <v-chip
                v-if="item.raw?.typeLabel"
                size="x-small"
                :color="item.raw.color"
                variant="tonal"
              >
                {{ item.raw.typeLabel }}
              </v-chip>
            </template>
          </v-list-item>
        </template>
      </v-select>
    </v-card-text>
  </v-card>
</template>

