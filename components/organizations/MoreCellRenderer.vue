<!-- filepath: /Users/b-mini/sites/thuenen/tfm/TFM-Documentation/components/ActionCellRenderer.vue -->
<script setup>
import { withBase } from 'vitepress';
import { onMounted, ref } from 'vue';

    const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });

    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        window.location.href = withBase('/dashboard/records/?clusterId=' + props.params.data.cluster_id);
    }

    const showMenu = ref(false)
    const menuTarget = ref(null)

    // Define the menu items
    const menuItems = [
        { title: 'Details anzeigen', code: 'details', icon: 'mdi-eye' },
        { title: 'Bearbeiten', code: 'edit', icon: 'mdi-pencil' },
        { title: 'Löschen', code: 'delete', icon: 'mdi-delete' }
    ];

    async function show (evt) {
        if (showMenu.value) {
            showMenu.value = false
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        menuTarget.value = evt.target.closest('.v-btn')
        showMenu.value = true
    }
</script>

<template>
    <div>
        <v-btn
        icon="mdi-dots-vertical"
        size="small"
        variant="outlined"
        @click="show"
    ></v-btn>
    <v-menu
        v-model="showMenu"
        :offset="[-8,-12]"
        :target="menuTarget"
        location="bottom end"
        scroll-strategy="close"
    >
        <v-list
            :items="menuItems"
            class="py-0"
            density="compact"
            item-value="code"
            item-props
            slim
        >
            <template v-slot:prepend>
                <v-icon class="mr-n2" size="small"></v-icon>
            </template>
        </v-list>
    </v-menu>
    </div>
</template>