<script setup>

    import { ref, onMounted, getCurrentInstance } from 'vue'
    import { createClient } from '@supabase/supabase-js'

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey)

    const form = ref(false)
    const new_email = ref('')
    const error = ref('')
    const success = ref('')
    const loading = ref(false)

    const rules = {
        required: value => !!value || 'Required.',
        counter: value => value.length <= 20 || 'Max 20 characters',
        email: value => {
        const pattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return pattern.test(value) || 'Invalid e-mail.'
        },
    }

    const onSubmit = async () => {
        if (!form.value) return
        loading.value = true
        // Logic to change the email
       
        const { data, error: apiError } = await supabase.auth.updateUser({
            email: new_email.value
        })
        if (apiError) {
            error.value = 'Error changing email: ' + apiError.message;
            success.value = '';
        } else {
            success.value = 'Email changed successfully';
            error.value = '';
        }
        loading.value = false
    };

    function required (v) {
        return !!v || 'Field is required'
    }

</script>

# E-Mail-Adresse ändern

<v-chip color="red" v-if="error" class="my-2">
    <span>{{ error }}</span>
</v-chip>
<v-chip color="green" v-if="success" class="my-2">
    <span>{{ success }}</span>
</v-chip>

<v-form
    v-if="success === ''"
        v-model="form"
        @submit.prevent="onSubmit"
      >
<v-text-field
    hint="Geben Sie Ihre neue E-Mail Adresse ein"
    label="E-Mail Adresse"
    persistent-hint
    type="email"
    v-model="new_email"
    :rules="[rules.required, rules.email]"
    class="my-8"
    rounded="xl"
    variant="outlined"
    clearable
></v-text-field>
<v-btn type="submit" :disabled="!form" :loading="loading" rounded="xl" color="primary"  class="my-3">
    E-Mailadresse ändern
</v-btn>
</v-form>