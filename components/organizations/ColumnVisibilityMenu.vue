<script setup>
    import { ref, computed, watch, onBeforeUnmount } from 'vue';

    // AG Grid Community enthaelt kein Columns Tool Panel (Enterprise-Feature),
    // daher steuert dieses Menue die Spaltensichtbarkeit ueber die Grid-API.
    // Die Komponente steht bewusst neben dem Grid, damit der Button in der
    // Seiten-Toolbar sitzen kann (Issue #254).
    const props = defineProps({
        api: {
            type: Object,
            default: null
        },
        label: {
            type: String,
            default: 'Spalten'
        }
    });

    const emit = defineEmits(['state-changed']);

    const menuOpen = ref(false);
    const items = ref([]);
    const hiddenCount = computed(() => items.value.filter(item => !item.visible).length);

    function refreshItems() {
        const api = props.api;
        if (!api || api.isDestroyed?.()) {
            items.value = [];
            return;
        }

        const result = [];
        const byKey = new Map();

        api.getAllGridColumns().forEach(column => {
            const colDef = column.getColDef();
            // Technische Spalten (Aktionen, Auswahl, Status-Icon) sind per
            // lockVisible markiert und werden nicht zum Ausblenden angeboten.
            if (colDef.lockVisible) return;

            const groupLabel = column.getOriginalParent?.()?.getColGroupDef?.()?.headerName || '';
            const label = (colDef.headerName || '').trim() || colDef.field || column.getColId();
            // Die Trupp-Spalte ist zweimal definiert (columnGroupShow open/closed)
            // und hat damit zwei colIds; beide gehoeren zu einem Menueeintrag und
            // werden gemeinsam geschaltet, sonst bliebe die Gruppe halb sichtbar.
            const key = `${groupLabel}|${label}`;
            const existing = byKey.get(key);

            if (existing) {
                existing.colIds.push(column.getColId());
                existing.visible = existing.visible || column.isVisible();
                return;
            }

            const item = {
                key,
                label,
                groupLabel,
                colIds: [column.getColId()],
                visible: column.isVisible()
            };
            byKey.set(key, item);
            result.push(item);
        });

        items.value = result;
    }

    function setVisibility(item, visible) {
        props.api?.setColumnsVisible(item.colIds, !!visible);
        emit('state-changed');
    }

    function showAll() {
        const colIds = items.value.flatMap(item => item.colIds);
        if (colIds.length) {
            props.api?.setColumnsVisible(colIds, true);
            emit('state-changed');
        }
    }

    function resetToDefault() {
        if (!props.api) return;

        // Setzt Sichtbarkeit, Reihenfolge und Breite auf die colDefs zurueck.
        props.api.resetColumnState();
        refreshItems();
        emit('state-changed');
    }

    function onMenuToggle(isOpen) {
        if (isOpen) refreshItems();
    }

    // Das Grid wird beim Nachladen neu aufgebaut, die API wechselt dabei.
    let boundApi = null;
    const GRID_EVENTS = ['columnVisible', 'columnMoved', 'newColumnsLoaded'];

    function unbind() {
        if (!boundApi) return;
        if (!boundApi.isDestroyed?.()) {
            GRID_EVENTS.forEach(event => boundApi.removeEventListener(event, refreshItems));
        }
        boundApi = null;
    }

    watch(() => props.api, (api) => {
        unbind();
        if (!api) {
            items.value = [];
            return;
        }
        boundApi = api;
        GRID_EVENTS.forEach(event => api.addEventListener(event, refreshItems));
        refreshItems();
    }, { immediate: true });

    onBeforeUnmount(unbind);
</script>

<template>
    <v-menu
        v-model="menuOpen"
        :close-on-content-click="false"
        location="bottom end"
        @update:modelValue="onMenuToggle"
    >
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn
                v-bind="activatorProps"
                :disabled="!api"
                variant="outlined"
                rounded="xl"
            >
                {{ label }}
                <v-chip
                    v-if="hiddenCount"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="ml-2"
                >
                    {{ hiddenCount }} ausgeblendet
                </v-chip>
            </v-btn>
        </template>
        <v-card min-width="320" rounded="lg">
            <v-toolbar color="transparent" density="compact">
                <v-toolbar-title class="text-subtitle-2">Angezeigte Spalten</v-toolbar-title>
            </v-toolbar>
            <v-divider />
            <v-list density="compact" class="py-0" style="max-height: 55vh; overflow-y: auto;">
                <template v-for="(item, index) in items" :key="item.key">
                    <v-list-subheader
                        v-if="item.groupLabel && item.groupLabel !== items[index - 1]?.groupLabel"
                    >
                        {{ item.groupLabel }}
                    </v-list-subheader>
                    <v-list-item class="px-2">
                        <v-checkbox
                            :model-value="item.visible"
                            :label="item.label"
                            density="compact"
                            color="primary"
                            hide-details
                            @update:modelValue="setVisibility(item, $event)"
                        />
                    </v-list-item>
                </template>
            </v-list>
            <v-divider />
            <v-card-actions>
                <v-btn variant="text" @click="showAll">Alle anzeigen</v-btn>
                <v-spacer />
                <v-btn variant="text" @click="resetToDefault">Standard</v-btn>
            </v-card-actions>
        </v-card>
    </v-menu>
</template>
