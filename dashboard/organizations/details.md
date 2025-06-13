<script setup>

    import { onMounted, ref, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js'
    import { useRouter } from 'vitepress'
    import { withBase } from 'vitepress'
    import OrganizationsAdmins from '../../components/organizations/OrganizationsAdmins.vue';
    import OrganizationsPlots from '../../components/organizations/OrganizationsPlots.vue';
    import ListOfTroops from '../../components/organizations/ListOfTroops.vue';
    import TroopSelection from '../../components/organizations/TroopSelection.vue';
    import OrganizationResponsible from '../../components/organizations/OrganizationResponsible.vue';

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const router = useRouter();

    const queryParams = ref({});
    const tab = ref('history'); // Default tab

    const organizationsDetail = ref({});

    async function _editOrganizationName(orgId, newName) {
        const organizationName = prompt('Enter new organization name:', newName);
        if (organizationName) {
            const { data, error } = await supabase
                .from('organizations')
                .update({ name: organizationName })
                .eq('id', orgId);

            if (error) {
                console.error('Error updating organization name:', error);
            } else {
                organizationsDetail.value.name = organizationName;
            }
        }
    }
    async function _deleteOrganization(organizationId) {
        try {
            const { data, error } = await supabase.from('organizations').delete().eq('id', organizationId).select().single();
            if (error) {
                console.error('Supabase error:', error);
                alert(`Supabase error: ${error.message}`); // User feedback
                return;
            }
            if (data) {
                // get vitepress config base
                const base = instance.appContext.config.globalProperties.$base;
                router.go(withBase('/dashboard/organizations')); // Go back to the previous page
            }
        } catch (e) {
            console.error('An unexpected error occurred:', e);
            alert(`An unexpected error occurred: ${e.message}`); // User feedback
        }
    }


    onMounted(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams.entries()) {
            queryParams.value[key] = value;
        }

        const { data: organizations, error } = await supabase
            .from('organizations')
            .select('*')
            .or(`id.eq.${queryParams.value.orgId}`)
            .order('name', { ascending: true })
            .single();

        if (error) {
            console.error('Error fetching organizations:', error);
        } else {
            organizationsDetail.value = organizations;
        }
    });
</script>

<v-toolbar color="transparent" flat>
    <v-btn icon="mdi-arrow-left" @click="router.go(withBase('/dashboard/organizations'))"></v-btn>
    <v-toolbar-title>
        <div class="d-flex flex-column">
            <span class="text-h6">{{organizationsDetail.entityName}}</span>
            <span class="text-caption text-grey">{{organizationsDetail.name}}</span>
        </div>
    </v-toolbar-title>
    <div class="d-flex ga-1">
        <v-btn icon="mdi-pencil" @click="_editOrganizationName(organizationsDetail.id, organizationsDetail.name)"></v-btn>
        <v-btn icon="mdi-delete" @click="_deleteOrganization(organizationsDetail.id)"></v-btn>
    </div>
</v-toolbar>
<v-tabs
    v-model="tab"
    align-tabs="center"
>
    <v-tab value="history">Aktuelles</v-tab>
    <v-tab value="cluster">Trakte</v-tab>
    <v-tab value="admins">Verantwortlich</v-tab>
    <v-tab value="troop">Trupps</v-tab>
</v-tabs>
<v-card-text>
    <v-tabs-window v-model="tab">
        <v-tabs-window-item value="history">
            coming soon
        </v-tabs-window-item>
        <v-tabs-window-item value="cluster">
            <OrganizationsPlots :organizationsDetail="organizationsDetail"/>
        </v-tabs-window-item>
        <v-tabs-window-item value="admins">
            <OrganizationsAdmins :organization_id="organizationsDetail.id" :isEditable="false" title="Verantwortliche Organisation" role="organization_admin" is_organization_admin="true"/>
        </v-tabs-window-item>
        <v-tabs-window-item value="troop">
            <TroopSelection :organization_id="organizationsDetail.parent_organization_id"/>
        </v-tabs-window-item>
    </v-tabs-window>
</v-card-text>
