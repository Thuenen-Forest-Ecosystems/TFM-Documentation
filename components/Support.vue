<script setup>
    import { ref, getCurrentInstance, onMounted, shallowRef } from 'vue';
    const drawer = ref(false);

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const supportProfiles = shallowRef([]);

    const openMail = (email) => {
        if (typeof window !== 'undefined') {
            window.location.href = `mailto:${email}`;
        }
    };
    async function dbAdmin() {
        const { data, error } = await supabase.from('users_profile').select('email, user_name').eq('is_database_admin', true);
        if (error) {
            console.error('Error fetching admin data:', error);
        } else {
            console.log('Admin data:', data);
            supportProfiles.value = data;
            
        }
    }
    onMounted(() => {
        dbAdmin();
    });
</script>

<template>
  <div>
    <div class="bottom-0 right-0 position-fixed ma-4 p-2 z-index-1000" style="z-index:1005;">
      <v-fab :icon="drawer ? 'mdi-close' : 'mdi-face-agent'" @click="drawer = !drawer"></v-fab>
    </div>
    
      <v-navigation-drawer
        v-model="drawer"
        location="right"
        :scrim="false"
        width="300"
        class="navigation-drawer--temporary"
      >
        <v-list>
            <v-list-item>
                <template v-slot:prepend>
                    <v-icon>mdi-face-agent</v-icon>
                </template>
                <v-list-item-title class="text-h6">Hilfe</v-list-item-title>
            </v-list-item>

            <v-list-item>
                <p>Haben Sie Fehler gefunden, Verbesserungsvorschläge oder benötigen Sie Unterstützung?</p>
            </v-list-item>
            <v-divider></v-divider>

            <v-list-subheader class="text-h8">Technisch</v-list-subheader>

            <template v-for="value in supportProfiles" :key="value?.email || Math.random()">
                <v-list-item 
                    v-if="value && value.email"
                    @click="openMail(value.email)"
                >
                    <v-list-item-title>{{ value.user_name || '' }}</v-list-item-title>
                    <v-list-item-subtitle>{{ value.email }}</v-list-item-subtitle>
                    <template v-slot:append>
                        <v-icon>mdi-email</v-icon>
                    </template>
                </v-list-item>
            </template>
        </v-list>
      </v-navigation-drawer>
    
    </div>
</template>