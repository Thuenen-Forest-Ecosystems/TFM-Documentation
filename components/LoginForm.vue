<script setup>

    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const contentProfile = useAttrs();

    const supabase = createClient(url, apikey)
    console.log(url, apikey)

    const currentSession = ref({});
    const authErrors = ref(null);
    const is_signeUp = ref(false);

    const username= ref(null);
    const password = ref(null);
    const password_repeat = ref(null);

    const signedUp = ref(false);

    const access_token = ref(null);

    // Get Errors from URL
    if(window.location.hash) {
        var hash = window.location.hash.substring(1); //Puts hash in variable, and removes the # character
        // get error_description
        var error_description = hash.split('&').find(e => e.startsWith('error_description='));
        if(error_description) {
            console.log(decodeURIComponent(error_description.split('=')[1]));
            error_description = decodeURIComponent(error_description.split('=')[1]);
            /// remove add sign from error_description
            error_description = error_description.replace(/\+/g, ' ');
            authErrors.value = error_description;

        }
    }

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    }

    const login = async () => {
        authErrors.value = null;

        if (!username.value || !password.value) {
            authErrors.value = 'Please enter username and password';
            return;
        }
        if (is_signeUp.value && password.value !== password_repeat.value) {
            authErrors.value = 'Passwords do not match';
            return;
        }
        
        const { user, session, error } = await supabase.auth.signInWithPassword({
            email: username.value,
            password: password.value,
        });
        if (error) {
            authErrors.value = error.message;
        }
    }
    const signUp = async () => {
        if (!username.value || !password.value) {
            authErrors.value = 'Please enter username and password';
            return;
        }else{
            authErrors.value = null;
        }
        const { data, error } = await supabase.auth.signUp({
            email: username.value,
            password: password.value,
        });
        if (error) {
            authErrors.value = error.message;
        }else{
            console.log(data);
            signedUp.value = true;
            authErrors.value = null;
        }
    }
    const logout = async () => {
       
        supabase.auth.signOut().then(() => {
            console.log('signed out');
            authErrors.value = null;
        }).catch((error) => {
            console.log(error);
        }).finally(() => {
            console.log('finally');
        });
        return;
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            authErrors.value = error.message;
        }else{
            window.location.replace("./login");
        }
    }

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        
        currentSession.value = session;

        if(event === 'SIGNED_IN' && contentProfile.forward){
            //window.location.replace("./profile");
        }
    });

</script>

<template>

    <div v-if="!currentSession?.user">
        <div v-if="is_signeUp">

            <h1>Sign Up</h1><br/>
            <p v-if="authErrors">{{authErrors}}</p>
            <p v-if="signedUp">Please check your email to confirm your account</p>
            <p v-if="signedUp">If you do not receive an email, please check your spam folder</p>
            <p v-else>
                <input type="text" v-model.trim="username" placeholder="Username" /><br/>
                <input type="password" v-model.trim="password" placeholder="Password" /><br/>
                <input type="password" v-model.trim="password_repeat" placeholder="Repeat Password" /><br/>
                <button class="raised-button" @click="signUp">SIGN UP</button>
            </p>
            <p>
                <button @click="is_signeUp = false">LOGIN</button>
            </p>
        </div>
        <div v-else>
            
            <h1>Login</h1><br/>
            <p  v-if="authErrors">{{authErrors}}</p>
            <input type="text" v-model.trim="username" placeholder="Username" /><br/>
            <input type="password" v-model.trim="password" placeholder="Password" /><br/>
            <button class="raised-button" @click="login">ANMELDEN</button>
            <p>
                <button  @click="is_signeUp = true">SIGN UP</button>
            </p>
        </div>  
        
    </div>
    <div v-else>
        <div>
            <slot />
        </div>
        <hr/>
        <div style="text-align: center;">
            <button @click="logout">ABMELDEN</button>
        </div>
    </div>
</template>


<style scoped>
    input {
        margin-bottom: 15px;
        padding: 10px;
        border-radius: 100px;
        width: 100%;
        background-color: rgba(100,100,100,0.1);
    }
    .raised-button {
        background-color: #4CAF50;
        border: none;
        color: white;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 100px;
        padding: 10px 24px;
    }
</style>