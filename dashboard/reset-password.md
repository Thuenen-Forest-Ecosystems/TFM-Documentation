
<script setup>

    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey)

    const form = ref(false)
    const new_password = ref('')
    const new_password_confirm = ref('')
    const error = ref('')
    const success = ref('')
    const loading = ref(false)
  
    const onSubmit = async () => {
        if (new_password.value !== new_password_confirm.value || new_password.value === '') {
            error.value = 'Passwords do not match';
            success.value = '';
            return;
        }
        // Logic to reset the password
        const { data, error: apiError } = await supabase.auth.updateUser({
            password: new_password.value
        })
        if (apiError) {
            error.value = 'Error resetting password: ' + apiError.message;
            success.value = '';
        } else {
            success.value = 'Password reset successfully';
            error.value = '';
        }
    };
    const rules = {
        required: value => !!value || 'Required.',
        counter: value => value.length <= 20 || 'Max 20 characters',
        email: value => {
        const pattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return pattern.test(value) || 'Invalid e-mail.'
        },
    }
    const _to_login = () => {
        window.location.href = '/TFM-Documentation/dashboard/profile';
    }
</script>

# Reset Password

Enter a new password you would like to set.

<v-chip color="red" v-if="error" class="my-2">
    <span>{{ error }}</span>
</v-chip>
<v-chip color="green" v-if="success" class="my-2">
    <span>{{ success }}</span>
</v-chip>

<v-form v-if="success === ''" v-model="form"
        @submit.prevent="onSubmit">
<v-text-field
    hint="Select a strong new password"
    label="Password"
    persistent-hint
    type="password"
    :rules="[rules.require]"
    v-model="new_password"
    class="my-8"
    rounded="xl"
    variant="outlined"
></v-text-field>

<v-text-field
    hint="Re-enter your new password"
    label="Confirm Password"
    persistent-hint
    type="password"
    :rules="[rules.require]"
    v-model="new_password_confirm"
    class="my-8"
    rounded="xl"
    variant="outlined"
></v-text-field>

<v-btn type="submit" :disabled="!form" :loading="loading"  rounded="xl" @click="_resetPassword" color="primary"  class="my-3">
    Reset Password
</v-btn>
</v-form>

<div>
    <v-btn rounded="xl" @click="_to_login"  class="my-3">
    Login
    </v-btn>
</div>