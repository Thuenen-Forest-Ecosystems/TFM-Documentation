<script setup>

    import { ref, onMounted } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    import { getCurrentInstance } from 'vue'

    const supabase = getCurrentInstance().appContext.config.globalProperties.$supabase;

    const currentSession = ref({});

    const access_token = ref(null);

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    }

    supabase.auth.onAuthStateChange((event, session) => {
        currentSession.value = session;
        
        //console.log(parseJwt(session?.access_token));
        access_token.value = session?.access_token;
    });

</script>


<template>
    
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