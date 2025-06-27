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
            fetchUserOrganizations(session.user.id);
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

    const _toOrganizations = () => {
        window.location.href = withBase('/dashboard/organizations');
    };
</script>

   <template>
      <div>
        <h2>Custom Component in Sidebar</h2>
        <p>This is a custom component rendered in the sidebar.</p>
      </div>
    </template>

<style scoped>
    .organization-button .VPLink {
        display: block;
        padding: 8px 12px;
        color: var(--vp-c-text-1);
        text-decoration: none;
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .organization-button .VPLink:hover {
        background-color: var(--vp-c-bg-soft);
    }

    .organization-button .disabled {
        display: block;
        padding: 8px 12px;
        color: var(--vp-c-text-2);
        opacity: 0.6;
    }
</style>