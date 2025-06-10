<script setup>
    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    import { withBase } from 'vitepress'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const form = ref(false)
    const authErrors = ref(null);
    const accessToken = ref(null);
    const password = ref('');
    const password_repeat = ref('');
    const error = ref('')
    const success = ref('')
    const loading = ref(false)


    if(window.location.hash) {
        var hash = window.location.hash.substring(1); //Puts hash in variable, and removes the # character

        var accessTokenQuery = hash.split('&').find(e => e.startsWith('access_token='));
        if(accessTokenQuery) {
            accessToken.value = accessTokenQuery.split('=')[1];
        }
        // get error_description
        var error_description = hash.split('&').find(e => e.startsWith('error_description='));
        
        if(error_description) {
            error_description = decodeURIComponent(error_description.split('=')[1]);
            /// remove add sign from error_description
            error_description = error_description.replace(/\+/g, ' ');
            authErrors.value = error_description;
        }
    }

    const onSubmit = async () => {
        if (password.value !== password_repeat.value) {
            error.value = 'Passwords do not match';
            return;
        }
        const supabase = createClient(url, apikey, {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken.value}`
                }
            }
        });
        loading.value = true;
        supabase.auth.updateUser({
            password: password.value
        })
        .then(({ data, error }) => {
            loading.value = false;
            if (error) {
                authErrors.value = error.message;
            } else {
                window.location.href = withBase('/dashboard/profile');
                //signedUp.value = true;
            }
            
        });
    }
    const rules = {
        required: value => !!value || 'Required.',
        counter: value => value.length <= 20 || 'Max 20 characters',
        email: value => {
        const pattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return pattern.test(value) || 'Invalid e-mail.'
        },
    }

</script>


<template>
    <v-chip color="red" v-if="error" class="my-2">
        <span>{{ error }}</span>
    </v-chip>
    <v-chip color="green" v-if="success" class="my-2">
        <span>{{ success }}</span>
    </v-chip>

    <div v-if="authErrors">
        <h1>Authentication Error</h1><br/>
        <p>{{authErrors}}</p>
    </div>
    <div v-else>
        <h1>Set Password</h1><br/>
        
        <v-form v-if="success === ''" v-model="form" @submit.prevent="onSubmit">
            <v-text-field
                hint="Select a strong password"
                label="Password"
                persistent-hint
                type="password"
                :rules="[rules.require]"
                v-model="password"
                class="my-8"
                rounded="xl"
                variant="outlined"
            ></v-text-field>

            <v-text-field
                hint="Re-enter your password"
                label="Confirm Password"
                persistent-hint
                type="password"
                :rules="[rules.require]"
                v-model="password_repeat"
                class="my-8"
                rounded="xl"
                variant="outlined"
            ></v-text-field>
            <v-btn type="submit" :disabled="!form" :loading="loading"  rounded="xl" @click="changePassword" color="primary"  class="my-3">
                Set Password
            </v-btn>
        </v-form>
    </div>

</template>