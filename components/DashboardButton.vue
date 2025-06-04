<script setup>
    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'

    const access_token = ref(null);
    const user_email = ref(null);
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey)

    supabase.auth.onAuthStateChange((event, session) => {
        access_token.value = session?.access_token;
        user_email.value = session?.user?.email;
    });

    const _toProfile = () => {
        window.location.href = '/TFM-Documentation/dashboard/profile';
    };
    const _toSignIn = () => {
        window.location.href = './TFM-Documentation/authentication/sign-in';
    };
</script>


<template>
    <a v-if="user_email" class="VPLink">
        <v-btn rounded="xl" variant="tonal"  @click="_toProfile">
            <span>DASHBOARD</span>
        </v-btn>
    </a>
    <a v-else class="VPLink">
        <v-btn rounded="xl" variant="tonal"  @click="_toSignIn">
            <span>sign in</span>
        </v-btn>
    </a>
</template>

<style scoped>
    .VPLink {
        display: flex;
        align-items: center;
        padding: 0 12px;
        line-height: var(--vp-nav-height);
        font-size: 14px;
        font-weight: 500;
        color: var(--vp-c-text-1);
        transition: color 0.25s;
    }
</style>