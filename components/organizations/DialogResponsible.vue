<script setup>

// parent component: <DialogResponsible v-model="responsibleDialog" :selected="selectedLos" @close="_handleClose" @confirm="(value) => _handleConfirm(value)"/>

    import { getCurrentInstance, onMounted, ref, watch, defineEmits } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const troops = ref([]);
    const selectedTroop = ref(null);

    const companies = ref([]);
    const selectedCompany = ref(null);


    const props = defineProps({
        modelValue: Boolean,
        selected: Object
    });

    const emit = defineEmits(['close', 'confirm']);

    // Call this when user confirms
    function confirmAction() {
        emit('confirm', props.selected);
    }

    function updateLos(){
        props.selected.troop_id = selectedTroop.value;
        props.selected.responsible_organization_id = selectedCompany.value;
    }

    // Call this when user cancels
    function cancelAction() {
        emit('update:modelValue', false);
    }

    function _selectCompany(company) {
        selectedCompany.value = company.id;
        selectedTroop.value = null; // Reset selected troop when a company is selected
        updateLos();
    }
    function _selectTroop(troop) {
        selectedTroop.value = troop.id;
        selectedCompany.value = null; // Reset selected company when a troop is selected
        updateLos();
    }

    async function _getTroops() {
        if (!props.selected || !props.selected.id) return [];
        try {
            const { data, error } = await supabase
                .from('troop')
                .select('*')
                .eq('organization_id', props.selected.organization_id);
            if (error) {
                console.error('Error fetching troops:', error);
                return [];
            }
            troops.value = data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching troops:', e);
            return [];
        }
    }
    async function _getCompanies(){
        if (!props.selected || !props.selected.id) return [];
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('parent_organization_id', props.selected.organization_id);
            if (error) {
                console.error('Error fetching companies:', error);
                return [];
            }
            companies.value = data || [];
        } catch (e) {
            console.error('An unexpected error occurred while fetching companies:', e);
            return [];
        }
    }

    watch(() => [props.selected, props.modelValue] , ([newSelected, newDialog]) => {
        if (newDialog && newSelected && newSelected.id) {
            selectedTroop.value = newSelected.troop_id || null;
            selectedCompany.value = newSelected.responsible_organization_id || null;
            _getTroops();
            _getCompanies();
        }else {
            troops.value = [];
        }
    }, { immediate: true });


</script>

<template>
    <v-dialog v-model="props.modelValue" max-width="500" @click:outside="cancelAction">
        <v-card rounded="lg">
            <v-toolbar>
                <v-btn v-if="props.icon" :icon="props.icon"></v-btn>

                <v-toolbar-title>{{ props.selected.name }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="cancelAction"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>
            <v-card-text>
                <p class="mb-6 text-body-2 text-medium-emphasis">
                    Wähle einen Dienstleister oder einen Trupp, welcher für das Los zuständig ist.
                </p>
                <v-row class="mt-4">
                    <v-col cols="5" class="align-center">
                        <v-list-subheader>Dienstleister</v-list-subheader>
                        <v-chip-group
                            selected-class="text-primary"
                            column
                            v-model="selectedCompany"
                        >
                            <v-chip
                                v-for="company in companies"
                                :key="company.id"
                                :value="company.id"
                                @click="_selectCompany(company)"
                                class="ma-1"
                            >
                            {{ company.name || company.entityName || 'unknown' }}
                            </v-chip>
                        </v-chip-group>
                    </v-col>
                    <v-col class="align-center">oder</v-col>
                     <v-col cols="5">
                        <v-list-subheader>Troops</v-list-subheader>
                        <v-chip-group
                            selected-class="text-primary"
                            column
                            v-model="selectedTroop"
                        >
                            <v-chip
                                v-for="troop in troops"
                                :key="troop.id"
                                :value="troop.id"
                                @click="_selectTroop(troop)"
                                class="ma-1"
                            >
                            {{ troop.name || troop.entityName || 'unknown' }}
                            </v-chip>
                        </v-chip-group>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                
                <v-spacer></v-spacer>
                <v-btn
                    text="Anwenden"
                    variant="elevated"
                    rounded="xl"
                    color="primary"
                    @click="confirmAction"
                ></v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>