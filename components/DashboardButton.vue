<script setup>
    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey)

    const _toProfile = () => {
        window.location.href = '/TFM-Documentation/dashboard/profile';
    };
</script>


<template>
    <a class="VPLink">
        <v-btn rounded="xl" variant="tonal"  @click="_toProfile">
            <span>Dashboard</span>
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