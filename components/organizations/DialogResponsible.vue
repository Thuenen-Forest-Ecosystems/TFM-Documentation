<script setup>

// parent component: <DialogResponsible v-model="responsibleDialog" :selected="selectedLos" @close="_handleClose" @confirm="(value) => _handleConfirm(value)"/>

    import { getCurrentInstance, onMounted, ref, watch } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const troops = ref([]);
    const selectedTroop = ref(null);

    const companies = ref([]);
    const selectedCompany = ref(null);
    const losName = ref('');

    const props = defineProps({
        modelValue: Boolean,
        selected: Object,
        organizationId: String
    });

    const emit = defineEmits(['close', 'confirm']);

    // Call this when user confirms
    const savingChanges = ref(false);
    function confirmAction() {
        savingChanges.value = true;
        emit('confirm', selectedCompany.value, selectedTroop.value, losName.value);
        //emit('confirm', props.selected, losName.value);
        emit('update:modelValue', false); // Close the dialog
    }

    function updateLos(){
        if(props.selected){
            props.selected.troop_id = selectedTroop.value;
            props.selected.responsible_organization_id = selectedCompany.value;
        }
    }

    // Call this when user cancels
    function cancelAction() {
        emit('update:modelValue', false);
    }

    function _selectCompany() {
        //selectedCompany.value = selectedCompany.value || null;
        selectedTroop.value = null; // Reset selected troop when a company is selected
        updateLos();
    }
    function _selectTroop(troop) {
        //selectedTroop.value = troop.id;
        selectedCompany.value = null; // Reset selected company when a troop is selected
        updateLos();
    }

    async function _getTroops() {
        if (!props.organizationId) return [];
        try {
            const { data, error } = await supabase
                .from('troop')
                .select('*')
                .eq('organization_id', props.organizationId);
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
        if (!props.organizationId) return [];
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('parent_organization_id', props.organizationId);
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

    watch(() => [props.selected, props.organizationId, props.modelValue] , ([newSelected, newOrgId, newDialog]) => {
        if(newSelected && newDialog){
            selectedTroop.value = newSelected.troop_id || null;
            selectedCompany.value = newSelected.responsible_organization_id || null;
            losName.value = newSelected.name || '';
        }
        if (newDialog && newOrgId) {
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
            <v-toolbar v-if="props.selected">
                <v-btn v-if="props.icon" :icon="props.icon"></v-btn>

                <v-toolbar-title>{{ props.selected?.name || '' }}</v-toolbar-title>

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
                    v-if="props.selected"
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
                    Wählen sie einen Dienstleister ODER einen Trupp.
                </p>

                <div class="align-center">
                    <v-list-subheader>Dienstleister</v-list-subheader>
                    <v-chip-group
                        selected-class="text-primary"
                        column
                        v-model="selectedCompany"
                        @update:model-value="_selectCompany"
                    >
                        <v-chip
                            v-for="company in companies"
                            :key="company.id"
                            :value="company.id"
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
                        @update:model-value="_selectTroop"
                    >
                        <v-chip
                            v-for="troop in troops"
                            :key="troop.id"
                            :value="troop.id"
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