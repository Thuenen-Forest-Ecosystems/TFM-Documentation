<script setup>
    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const authErrors = ref(null);
    const accessToken = ref(null);
    const password = ref('');
    const password_repeat = ref('');
    const loading = ref(false);


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

    function changePassword() {
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
                signedUp.value = true;
            }
        });
    }


</script>


<template>
    <div v-if="authErrors">
        <h1>Authentication Error</h1><br/>
        <p>{{authErrors}}</p>
    </div>
    <div v-else>
        {{ accessToken.value }}
        <h1>Change Password</h1><br/>
        <p>
            <input type="password" v-model.trim="password" placeholder="Password" /><br/>
            <input type="password" v-model.trim="password_repeat" placeholder="Repeat Password" /><br/>
            <button class="raised-button" @click="changePassword">Password setzen</button>
        </p>
    </div>

</template>