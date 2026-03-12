<script setup>
    import { ref, onMounted, getCurrentInstance, computed, nextTick, watch } from 'vue';

    const props = defineProps({
        recordsId: {
            type: String,
            required: true
        }
    });

    const model = defineModel({ type: Boolean, default: false });

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const messages = ref([]);
    const newMessage = ref('');
    const isLoading = ref(false);
    const isSending = ref(false);
    const currentUserId = ref(null);
    const messagesContainer = ref(null);

    onMounted(async () => {
        await loadCurrentUser();
        await fetchMessages();
    });

    watch(() => props.recordsId, async () => {
        messages.value = [];
        await fetchMessages();
    });

    // Scroll to bottom when dialog opens
    watch(model, (open) => {
        if (open) {
            nextTick(() => scrollToBottom());
        }
    });

    async function loadCurrentUser() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            currentUserId.value = session?.user?.id || null;
        } catch (e) {
            console.error('Error loading current user:', e);
        }
    }

    async function fetchMessages() {
        if (!props.recordsId) return;
        isLoading.value = true;
        try {
            const { data, error } = await supabase
                .from('records_messages')
                .select('id, created_at, note, user_id, is_system_message')
                .eq('records_id', props.recordsId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching messages:', error);
                return;
            }

            // Collect unique user IDs to fetch profiles
            const userIds = [...new Set(data.filter(m => m.user_id).map(m => m.user_id))];
            let profileMap = {};

            if (userIds.length > 0) {
                const { data: profiles, error: profileError } = await supabase
                    .from('users_profile')
                    .select('id, email, user_name')
                    .in('id', userIds);

                if (!profileError && profiles) {
                    profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
                }
            }

            messages.value = data.map(m => ({
                ...m,
                user_name: profileMap[m.user_id]?.user_name || profileMap[m.user_id]?.email || 'System',
                isOwn: m.user_id === currentUserId.value
            }));

            await nextTick();
            scrollToBottom();
        } catch (e) {
            console.error('Error fetching messages:', e);
        } finally {
            isLoading.value = false;
        }
    }

    async function sendMessage() {
        const text = newMessage.value.trim();
        if (!text || isSending.value) return;

        isSending.value = true;
        try {
            const { error } = await supabase
                .from('records_messages')
                .insert({
                    records_id: props.recordsId,
                    note: text,
                    user_id: currentUserId.value
                });

            if (error) {
                console.error('Error sending message:', error);
                return;
            }

            newMessage.value = '';
            await fetchMessages();
        } catch (e) {
            console.error('Error sending message:', e);
        } finally {
            isSending.value = false;
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    function scrollToBottom() {
        if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
    }

    function formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const tz = 'Europe/Berlin';
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz })
            + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    }

    async function deleteMessage(messageId) {
        try {
            const { error } = await supabase
                .from('records_messages')
                .delete()
                .eq('id', messageId);

            if (error) {
                console.error('Error deleting message:', error);
                return;
            }
            await fetchMessages();
        } catch (e) {
            console.error('Error deleting message:', e);
        }
    }
</script>

<template>
    <v-dialog v-model="model" max-width="600" scrollable>
        <v-card class="d-flex flex-column" style="height: 70vh;">
            <v-toolbar flat density="compact">
                <v-toolbar-title>
                    <v-icon class="mr-1" size="small">mdi-message-text</v-icon>
                    Nachrichten
                </v-toolbar-title>
                <template v-slot:append>
                    <v-btn icon="mdi-close" variant="text" @click="model = false" />
                </template>
            </v-toolbar>

            <!-- Messages area -->
            <v-card-text ref="messagesContainer" class="flex-grow-1 overflow-y-auto pa-3">
                <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-3" />

                <div v-if="!isLoading && messages.length === 0" class="text-center text-grey mt-8">
                    Noch keine Nachrichten
                </div>

                <div
                    v-for="msg in messages"
                    :key="msg.id"
                    class="d-flex mb-2"
                    :class="msg.isOwn ? 'justify-end' : 'justify-start'"
                >
                    <v-card
                        variant="tonal"
                        :max-width="msg.is_system_message ? '90%' : '80%'"
                        class="pa-2"
                        elevation="1"
                        rounded="lg"
                    >
                        <!-- System message -->
                        <template v-if="msg.is_system_message">
                            <div class="text-caption text-center font-italic">
                                {{ msg.note }}
                            </div>
                            <div class="text-caption text-grey text-center mt-1">
                                {{ formatDate(msg.created_at) }}
                            </div>
                        </template>

                        <!-- User message -->
                        <template v-else>
                            <div class="text-caption font-weight-bold">
                                {{ msg.user_name }}
                            </div>
                            <div class="text-body-2 my-1" style="white-space: pre-wrap;">{{ msg.note }}</div>
                            <div class="d-flex align-center justify-space-between">
                                <span class="text-caption text-grey mr-2">{{ formatDate(msg.created_at) }}</span>
                                <v-btn
                                    v-if="msg.isOwn"
                                    icon="mdi-delete-outline"
                                    size="x-small"
                                    variant="text"
                                    density="compact"
                                    @click="deleteMessage(msg.id)"
                                />
                            </div>
                        </template>
                    </v-card>
                </div>
            </v-card-text>

            <!-- Message input -->
            <v-divider />
            <v-card-actions class="pa-3">
                <v-textarea
                    v-model="newMessage"
                    placeholder="Nachricht schreiben..."
                    variant="outlined"
                    density="compact"
                    rows="1"
                    max-rows="4"
                    auto-grow
                    hide-details
                    class="flex-grow-1"
                    @keydown="handleKeydown"
                />
                <v-btn
                    icon="mdi-send"
                    color="primary"
                    class="ml-2"
                    :loading="isSending"
                    :disabled="!newMessage.trim()"
                    @click="sendMessage"
                />
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
