<script setup>
    import { onMounted, ref, getCurrentInstance, useAttrs, watch } from 'vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const attrs = useAttrs();

    async function _openAdminsDialog() {
        const adminEmail = prompt('Enter administrator email:');
        if (adminEmail && adminEmail.trim() !== '' && attrs.organization_id) {
            try {
                const { data, error: supabaseError } = await supabase.functions.invoke('invite-user', {
                    method: 'POST',
                    body: {
                        email: adminEmail,
                        metaData: {
                            role: attrs.role,
                            organization_id: attrs.organization_id // Use organization ID from attributes
                        }
                    }
                });
                if (supabaseError) {
                    console.error('Error inviting administrator:', supabaseError);
                    alert(`Error inviting administrator: ${supabaseError.message}`);
                } else {
                    await _requestData(attrs.organization_id); // Refresh the list of administrators
                }
            } catch (error) {
                console.error('Unexpected error:', error);
                alert(`Unexpected error: ${error.message}`);
            }
        }
    }

    watch(() => attrs.organization_id, (newVal) => {
        if (newVal) {
            _requestData(newVal);
        }
    });

    onMounted(() => {
        if (attrs.organization_id) {
            _requestData(attrs.organization_id);
        }
    });
</script>


<template>
    <div>
        <v-list>
            <v-list-item
                v-for="(user, index) in users"
                :key="index"
            >
                <v-list-item-title>{{ user.email }}</v-list-item-title>
                <template v-slot:append>
                    <v-avatar>
                        <v-icon icon="mdi-delete" @click="_removeUser(user.id)"></v-icon>
                    </v-avatar>
                </template>
            </v-list-item>
        </v-list>
    </div>
</template>