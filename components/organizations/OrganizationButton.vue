<script setup>
console.log('OrganizationButton component loaded');
    import { ref, onMounted, getCurrentInstance, inject } from 'vue'
    import { withBase } from 'vitepress'

    const access_token = ref(null);
    const user_email = ref(null);
    const user_organizations = ref([]);
    
    const instance = getCurrentInstance();
    // Use the injected Supabase client instead of global properties
    const supabase = inject('supabase');

    supabase.auth.onAuthStateChange((event, session) => {
        access_token.value = session?.access_token;
        user_email.value = session?.user?.email;
        if (session?.user) {
            //fetchUserOrganizations(session.user.id);
            fetchUsersPermissions(session.user.id);
        }
    });

    const fetchUserOrganizations = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('organization_users')
                .select('organization:organizations(name)')
                .eq('user_id', userId);
            
            if (error) throw error;
            user_organizations.value = data || [];
        } catch (error) {
            console.error('Error fetching organizations:', error);
        }
    };
    const fetchUsersPermissions = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('users_permissions')
                .select('*')
                .eq('user_id', userId);
            
            if (error) throw error;
            console.log('User permissions:', data);
        } catch (error) {
            console.error('Error fetching permissions:', error);
        }
    };

    const _toOrganizations = () => {
        if (typeof window !== 'undefined') {
            window.location.href = withBase('/dashboard/organizations');
        }
    };
</script>

<template>
    <a class="VPLink">
        <v-select
            rounded="xl"
            variant="outlined"
            density="compact"
            :items="['California', 'Colorado', 'Florida', 'Georgia', 'Texas', 'Wyoming']">
        </v-select>
    </a>
</template>

<style>
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
    .v-input__details{
        display: none;
    }
</style>