---
title: Administration
description: Manage your administrators.
layout: page
---

<script setup>
    import { onMounted, ref, getCurrentInstance } from 'vue';
    import Firewall from '../../components/Firewall.vue';
    import { withBase } from "vitepress";
    import OrganizationsAdmins from '../../components/organizations/OrganizationsAdmins.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const organizationId = urlParams.get('organization');
    const goBack = () => {
        window.history.back();
    };
</script>

<Firewall>
    <v-toolbar>
        <v-toolbar-title>Unternehmen verwalten</v-toolbar-title>
        <template v-slot:prepend>
            <v-btn icon @click="goBack">
                <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
        </template>
    </v-toolbar>
    <v-card variant="tonal">
        <OrganizationsAdmins title="Administratoren" :organization_id="organizationId" :is_admin="true" :showAdmins="true" key="admin" />
        <p class="text-body-2 text-medium-emphasis px-2 ma-1" style="background-color:rgba(0, 0, 0, 0.04)">
            Administratoren können Berechtigungen verwalten.
        </p>
    </v-card>
</Firewall>