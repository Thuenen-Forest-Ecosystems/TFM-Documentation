<script setup>

    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const contentProfile = useAttrs();

    const supabase = createClient(url, apikey)

    const currentSession = ref({});
    const authErrors = ref(null);
    const is_signeUp = ref(false);

    const username= ref(null);
    const password = ref(null);

    const access_token = ref(null);

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    }

    const login = async () => {
        if (!username.value || !password.value) {
            authErrors.value = 'Please enter username and password';
            return;
        }else{
            authErrors.value = null;
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
        const { user, session, error } = await supabase.auth.signUp({
            email: username.value,
            password: password.value,
        });
        if (error) {
            authErrors.value = error.message;
        }
    }
    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            authErrors.value = error.message;
        }else{
            window.location.replace("./login");
        }
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        currentSession.value = session;
        
        //console.log(parseJwt(session?.access_token));
        access_token.value = session?.access_token;

        if(event === 'SIGNED_IN' && contentProfile.forward){
            window.location.replace("./profile");
        }
    });

</script>

<template>

    <div v-if="!currentSession?.user">
        <div v-if="is_signeUp">

            <h1>Sign Up</h1><br/>

            <input type="text" v-model.trim="username" placeholder="Username" /><br/>
            <input type="password" v-model.trim="password" placeholder="Password" /><br/>
            <input type="password" v-model.trim="password" placeholder="Repeat Password" /><br/>
            <button class="raised-button" @click="signUp">SIGN UP</button>
            <p>
                <button @click="is_signeUp = false">LOGIN</button>
            </p>
        </div>
        <div v-else>
            
            <h1>Login</h1><br/>

            <p v-if="authErrors">{{authErrors}}</p>
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