<script setup>

    import { getCurrentInstance, onMounted, ref, watch } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const email = ref('');
    const valid = ref(false)
    const error = ref('')
    const success = ref('')

    const isControlTroop = ref(false)

    const props = defineProps({
        email: String,
        modelValue: Boolean,
        title: String,
        text: String,
        btnText: String,
        icon: String,
        isControlTroop: Boolean,
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

    const emit = defineEmits(['confirm']);

    function cancelAction() {
        emit('update:modelValue', false); // Close the dialog
    }


    async function onSubmit() {
        emit('confirm', email.value, isControlTroop.value); // Emit the email value
        isControlTroop.value = false;
        email.value = '';
    }

    const rules = {
        required: value => !!value || 'wird benötigt',
        minLength: value => ( value && value.length >= 4 ) || 'Muss mindestens 4 Zeichen lang sein',
        disabled: value => !props.disabled.includes(value.toLowerCase()) || 'Name schon vergeben'
    };


</script>

<template>
    <v-dialog v-model="props.modelValue" max-width="500" @click:outside="cancelAction">
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
                        v-model.trim="email"
                        :placeholder="props.placeholder || ''"
                        class="my-4"
                        rounded="xl"
                        variant="outlined"
                        :rules="[rules.required, rules.minLength, rules.disabled]"
                    ></v-text-field>

                    <v-chip-group v-model="isControlTroop" selected-class="text-primary" column>
                        <v-chip :value="false" filter>Aufnahme-Trupp</v-chip>
                        <v-chip :value="true" filter>Kontroll-Trupp</v-chip>
                    </v-chip-group>

                    <v-btn type="submit" block :disabled="!valid" :loading="props.loading"  rounded="xl" color="primary"  class="my-3">
                        {{ btnText }}
                    </v-btn>
                </v-form>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>