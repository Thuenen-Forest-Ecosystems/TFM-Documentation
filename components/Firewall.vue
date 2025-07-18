<script setup>
    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { withBase } from "vitepress";

    const access_token = ref(null);
    const user_email = ref(null);
    const forwardTimeout = null;
    
    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    supabase.auth.onAuthStateChange((event, session) => {
        access_token.value = session?.access_token;
        user_email.value = session?.user?.email;

        
        clearTimeout(forwardTimeout);

        if(session === null){
            forwardTimeout = setTimeout(() => {
                window.location.href = withBase('/authentication/sign-in');
            }, 1000);
        }
        
    });

    function toSignIn() {
        window.location.href = withBase('/authentication/sign-in');
    }
</script>

<template>
    <div v-if="access_token">
        <slot />
    </div>
    <div v-else class="text-center ma-11">
        <h1 class="text-h4 mb-4">You are not signed in</h1>
        <p>
            <v-btn rounded="xl" variant="tonal" @click="toSignIn">
                <span>Sign in</span>
            </v-btn>
       </p>
    </div>
</template>