
<script setup>
    import { ref, onMounted } from 'vue';
    import Player from '@vimeo/player';

    const player = ref(null);
    const dialog = ref(false);

    const props = defineProps({
        title: {
            type: String,
            default: ''
        },
        btnTitle: {
            type: String,
            default: ''
        }
    });

    onMounted(() => {
        const iframe = document.querySelector('iframe');
        if (iframe) {
            player.value = new Player(iframe);
        }
    });
</script>

<template>
    <v-dialog max-width="800">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn
            v-bind="activatorProps"
            color="surface-variant"
            :text="props.btnTitle"
            variant="outlined"
            prepend-icon="mdi-play"
            rounded="xl"
            ></v-btn>
        </template>

        <template v-slot:default="{ isActive }">
            <v-card :title="props.title">
                <v-card-text class="pa-0">
                    <div style="padding:62.5% 0 0 0;position:relative;">
                        <iframe
                            v-bind="iframeProps"
                            src="https://player.vimeo.com/video/1109589414?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
                            frameborder="0"
                            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                            referrerpolicy="strict-origin-when-cross-origin"
                            style="position:absolute;top:0;left:0;width:100%;height:100%;"
                            :title="props.title"
                        ></iframe>
                    </div>
                </v-card-text>
            </v-card>
        </template>
    </v-dialog>
</template>