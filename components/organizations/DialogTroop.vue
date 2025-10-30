<script setup>

    import { getCurrentInstance, onMounted, ref, watch, computed } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    //const name = ref('');
    const valid = ref(false)
    const error = ref('')
    const success = ref('')
    const loading = ref(false)

    //const isControlTroop = ref(false)

    const props = defineProps({
        modelValue: Boolean,
        troopId: String,
        name: String,
        isControlTroop: Boolean,
        organization_id: String,
        title: String,
        text: String,
        btnText: String,
        icon: String,
        
        loading: {
            type: Boolean,
            default: false
        },
        disabled: {
            type: Array,
            default: () => []
        },
        placeholder: String
    });

    const emit = defineEmits(['confirm', 'success']);

    // local, writable state — do NOT emit on change
    const modelValue = ref(!!props.modelValue);
    const name = ref(props.name || '');
    const isControlTroop = ref(!!props.isControlTroop);

    watch(() => props.modelValue, (newVal) => {
        modelValue.value = newVal;
    });

    watch(() => props.name, v => { name.value = v || ''; });
    watch(() => props.isControlTroop, v => { isControlTroop.value = !!v; });

    
    function cancelAction() {
        emit('update:modelValue', false);
    }


    async function onSubmit() {
        upsertTroop( name.value, isControlTroop.value, props.troopId );
        isControlTroop.value = false;
        name.value = '';
    }

    const rules = {
        required: value => !!value || 'wird benötigt',
        minLength: value => ( value && value.length >= 4 ) || 'Muss mindestens 4 Zeichen lang sein',
        disabled: value => !(props.disabled.includes(value.toLowerCase()) && !name.value) || 'Name schon vergeben'
    };

    async function upsertTroop(troopName, isControlTroop, troopId = null) {
       
        if (troopName && props.organization_id) {
            if (troopId) {

                loading.value = true;

                const { data: updateData, error: updateError } = await supabase
                    .from('troop')
                    .update({ name: troopName, is_control_troop: isControlTroop })
                    .eq('id', troopId)
                    .select();

                loading.value = false;

                if (updateError) {
                    console.error('Error updating troop:', updateError);
                    return;
                }

                emit('success', updateData);
                cancelAction();
            }else{

                loading.value = true;
                
                const { data: insertData, error: insertError } = await supabase
                    .from('troop')
                    .insert({ name: troopName, organization_id: props.organization_id, is_control_troop: isControlTroop })
                    .select();

                loading.value = false;

                if (insertError) {
                    console.error('Error adding troop:', insertError);
                    return;
                }

                emit('success', insertData);
                cancelAction();
            }
        } else {
            console.error('Error: Troop name is required and organization_id must be set.');
        }
    }

</script>

<template>
    <v-dialog v-model="modelValue" max-width="500" @click:outside="cancelAction">
        <v-card rounded="lg">
            <v-toolbar>
                <v-btn v-if="props.icon" :icon="props.icon"></v-btn>

                <v-toolbar-title>{{ props.title || 'Mitarbeiter einladen' }}</v-toolbar-title>

                <v-toolbar-items>
                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        @click="cancelAction"
                ></v-btn>
                </v-toolbar-items>
            </v-toolbar>
            
            <v-card-text>
                <p v-if="props.text" class="mb-6 text-body-2 text-medium-emphasis">
                    {{  props.text }}
                </p>
                <v-chip v-if="error" color="red" class="my-2">
                    <span>{{ error }}</span>
                </v-chip>
                <div v-if="success" class="flex-column	 justify-space-between align-center">
                    <v-chip color="green" class="my-2">
                        <span>{{ success }}</span>
                    </v-chip>
                    <v-btn type="submit" @click="success = ''" block rounded="xl" color="primary"  class="my-3">
                        weitere Einladung verschicken
                    </v-btn>
                </div>
                <v-form v-else v-model="valid" @submit.prevent="onSubmit">
                    <v-text-field
                        label="Name"
                        persistent-hint
                        type="text"
                        v-model.trim="name"
                        :placeholder="props.placeholder || ''"
                        class="my-4"
                        rounded="xl"
                        variant="outlined"
                        :rules="[rules.required, rules.minLength, rules.disabled]"
                        autocomplete="off"
                    ></v-text-field>

                    <v-chip-group v-model="isControlTroop" selected-class="text-primary" column>
                        <v-chip :value="false" filter>Aufnahme-Trupp</v-chip>
                        <v-chip :value="true" filter>Kontroll-Trupp</v-chip>
                    </v-chip-group>

                    <v-btn type="submit" block :disabled="!valid" :loading="loading"  rounded="xl" color="primary"  class="my-3">
                        {{ btnText }}
                    </v-btn>
                </v-form>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>