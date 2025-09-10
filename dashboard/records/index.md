---
title: Trakt
description: Manage your records and their details.
layout: page
---

<script setup>

    import ClusterDetails from '../../components/records/ClusterDetails.vue';

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const clusterId = urlParams.get('clusterId');

    function historyBack() {
        window.history.back();
    }

    
</script>
<v-toolbar>
    <template v-slot:prepend>
        <v-btn icon="mdi-arrow-left" @click="historyBack"></v-btn>
    </template>
    <v-toolbar-title>Trakt</v-toolbar-title>
    
</v-toolbar>
<ClusterDetails :clusterId="clusterId"/>