<script>
    import { historyBack } from './Utils.js';

    export default {
        methods: {
            historyBack
        }
    };
</script>

<template>
    <v-btn
        rounded="xl"
        size="x-small"
        variant="text"
        class="my-4"
        @click="historyBack()"
    >  
        <template v-slot:prepend>
            <v-icon>mdi-arrow-left</v-icon>
        </template>
        Zurück
</v-btn>
</template>