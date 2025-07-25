<script setup>

// parent component: <DialogResponsible v-model="responsibleDialog" :selected="selectedLos" @close="_handleClose" @confirm="(value) => _handleConfirm(value)"/>

    import { getCurrentInstance, onMounted, ref, watch, defineEmits } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const troops = ref([]);
    const selectedTroop = ref(null);

    const companies = ref([]);
    const selectedCompany = ref(null);
    const losName = ref('');

    const props = defineProps({
        modelValue: Boolean,
        selected: Object
    });

    const emit = defineEmits(['close', 'confirm']);

    // Call this when user confirms
    const savingChanges = ref(false);
    function confirmAction() {
        savingChanges.value = true;
        emit('confirm', props.selected, losName.value);
        emit('update:modelValue', false); // Close the dialog
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
            losName.value = newSelected.name || '';
            savingChanges.value = false;
            _getTroops();
            _getCompanies();
        }else {
            troops.value = [];
        }
    }, { immediate: true });

    
    const rules = {
        required: value => !!value || 'wird benötigt',
        minLength: value => ( value && value.length >= 4 ) || 'Muss mindestens 4 Zeichen lang sein',
        //disabled: value => !props.disabled.includes(value.toLowerCase()) || 'Name schon vergeben'
    };
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
                <v-text-field
                    label="Name ändern"
                    persistent-hint
                    type="text"
                    v-model.trim="losName"
                    :placeholder="props.selected.name"
                    class="my-4"
                    rounded="xl"
                    variant="outlined"
                    :rules="[rules.required, rules.minLength, rules.disabled]"
                />

                <p class="mb-6 text-body-2 text-medium-emphasis">
                    Wähle einen Dienstleister ODER einen Trupp, welcher für das Los zuständig ist.
                </p>

                <div class="align-center">
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
                </div>
                <div>
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
                </div>

                </v-card-text>
            <v-card-actions>
                
                <v-spacer></v-spacer>
                <v-btn
                    text="Anwenden"
                    variant="elevated"
                    rounded="xl"
                    color="primary"
                    :loading="savingChanges"
                    :disabled="savingChanges"
                    :loading-text="savingChanges ? 'Änderungen werden gespeichert...' : ''"
                    @click="confirmAction"
                ></v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>