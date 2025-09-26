<script setup>

// parent component: <DialogResponsible v-model="responsibleDialog" :selected="selectedLos" @close="_handleClose" @confirm="(value) => _handleConfirm(value)"/>

    import { getCurrentInstance, onMounted, ref, watch, computed } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const troops = ref([]);
    const selectedTroop = ref(null);

    const companies = ref([]);
    const selectedCompany = ref(null);
    const losName = ref('');

    const organizationPermissionText = ref(null);

    const responibilityAlreadySet = ref(0);
    const troopAlreadySet = ref(0);

    const uniqueClusterIds = computed(() => {
        if (!props.selectedRows || props.selectedRows.length === 0) return [];
        const uniqueIds = new Set(props.selectedRows.map(row => row.cluster_id).filter(id => id !== undefined && id !== null));
        return Array.from(uniqueIds);
    });

    const props = defineProps({
        modelValue: Boolean,
        selected: Object,
        organizationId: String,
        organizationType: String,
        selectedRows: Array,
    });

    const emit = defineEmits(['close', 'confirm', 'update:modelValue']);

    // Call this when user confirms
    const savingChanges = ref(false);
    function confirmAction() {
        const troopValue = selectedTroop.value === 'deselect' ? null : selectedTroop.value;
        const companyValue = selectedCompany.value === 'deselect' ? null : selectedCompany.value;

        savingChanges.value = true;
        emit('confirm', companyValue, troopValue);
        //emit('confirm', props.selected, losName.value);
        emit('update:modelValue', false); // Close the dialog
        resetSelection();
    }

    function updateLos(){
        if(props.selected){
            props.selected.troop_id = selectedTroop.value;
            props.selected.responsible_organization_id = selectedCompany.value;
        }
    }

    function initTexte(){

        let permissionColumn = null;
        console.log('Organization Type:', props.organizationType);

        switch(props.organizationType){
            case 'root':
                permissionColumn = 'responsible_state';
                organizationPermissionText.value = 'Dienstleister oder Landesinventurleitung';
                break;
            case 'country':
                permissionColumn = 'responsible_provider';
                organizationPermissionText.value = 'Dienstleister';
                break;
            case 'provider':
                permissionColumn = 'responsible_troop';
                break;
        }


        if(permissionColumn && props.selectedRows && props.selectedRows.length > 0){
            responibilityAlreadySet.value = props.selectedRows.filter(row => row[permissionColumn] !== null).length;
        }else{
            responibilityAlreadySet.value = 0;
        }

        if(props.selectedRows && props.selectedRows.length > 0){
            troopAlreadySet.value = props.selectedRows.filter(row => row.troop_id !== null).length;
        }else{
            troopAlreadySet.value = 0;
        }

    }

    function resetSelection(){
        savingChanges.value = false;
        selectedTroop.value = null;
        selectedCompany.value = null;
    }

    // Call this when user cancels
    function cancelAction() {
       resetSelection();
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

            // Add null to unassign troop
            troops.value.push({ id: 'deselect', name: 'Berechtigung entziehen' });

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
            companies.value.push({ id: 'deselect', name: 'Berechtigung entziehen' });
        } catch (e) {
            console.error('An unexpected error occurred while fetching companies:', e);
            return [];
        }
    }

    watch(() => [props.selected, props.organizationId, props.modelValue, props.selectedRows] , ([newSelected, newOrgId, newDialog, newSelectedRows]) => {
        initTexte();
        if(newSelected && newDialog){
            //selectedTroop.value = newSelected.troop_id || null;
            //selectedCompany.value = newSelected.responsible_organization_id || null;
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
            <!--<v-toolbar v-if="props.selected">
                <v-btn v-if="props.icon" :icon="props.icon"></v-btn>

                <v-toolbar-title>{{ props.selected?.name || '' }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="cancelAction"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>-->
            <v-card-title>Berechtigung zuweisen</v-card-title>
            <v-card-subtitle>{{ uniqueClusterIds.length }} Trakte und {{ props.selectedRows.length }} Ecken ausgewählt</v-card-subtitle>

            <!--<v-text-field
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
                />-->

                <v-card variant="tonal" class="ma-2" v-if="organizationPermissionText" :title="organizationPermissionText ">
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
                </v-card>
                <v-card variant="tonal" title="Inventur Trupps" class="ma-2">
                    <v-card-text>
                        <v-chip-group
                            selected-class="text-primary"
                            column
                            v-model="selectedTroop"
                            @update:model-value="_selectTroop"
                        >
                            <v-chip
                                v-for="troop in troops"
                                :key="troop.id === null ? 'deselect' : troop.id"
                                :value="troop.id"
                                class="ma-1"
                            >
                                {{ troop.name || troop.entityName || 'unknown' }}
                            </v-chip>
                        </v-chip-group>
                    </v-card-text>
                </v-card>


            <v-alert
                class="mx-2"
                v-if="selectedCompany && responibilityAlreadySet > 0"
                color="warning"
               
                variant="outlined"
            >
                <p class="mt-2 text">
                    Mit der Bestätigung werden {{ responibilityAlreadySet }} bestehende Berechtigungen ({{ organizationPermissionText }}) für Ecken überschrieben.
                </p>
            </v-alert>
            <v-alert
                class="mx-2"
                v-if="selectedTroop && troopAlreadySet > 0"
                color="warning"
                variant="outlined"
            >
                <p class="mt-2 text">
                    Mit der Bestätigung werden {{ troopAlreadySet }} bestehende Berechtigungen (Trupp) für Ecken überschrieben.
                </p>
            </v-alert>
            <v-card-actions>
                
                <v-spacer></v-spacer>
                <v-btn
                    text="Anwenden"
                    variant="elevated"
                    rounded="xl"
                    color="primary"
                    :loading="savingChanges"
                    :disabled="savingChanges || (!selectedCompany && !selectedTroop)"
                    :loading-text="savingChanges ? 'Änderungen werden gespeichert...' : ''"
                    @click="confirmAction"
                ></v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>