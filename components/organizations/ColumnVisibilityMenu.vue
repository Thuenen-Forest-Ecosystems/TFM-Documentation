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
    // Abschnitte: eine Spaltengruppe je Eintrag, ungruppierte Spalten stehen
    // gesammelt im Abschnitt ohne Titel.
    const sections = ref([]);
    const hiddenCount = computed(
        () => sections.value.reduce(
            (count, section) => count + section.columns.filter(column => !column.visible).length,
            0
        )
    );

    // Voller Gruppenpfad einer Spalte ("Obergruppe / Untergruppe"). Ueber den
    // Pfad statt ueber die Gruppen-Instanz zu buendeln sorgt dafuer, dass eine
    // Gruppe auch dann genau einmal im Menue steht, wenn ihre Spalten in der
    // Grid-Reihenfolge nicht direkt nebeneinander liegen - etwa nach einem aus
    // localStorage wiederhergestellten Spaltenzustand.
    function groupPathOf(column) {
        const path = [];
        let parent = column.getOriginalParent?.();

        while (parent) {
            const name = (parent.getColGroupDef?.()?.headerName || '').trim();
            if (name) path.unshift(name);
            parent = parent.getOriginalParent?.();
        }

        return path.join(' / ');
    }

    function refreshItems() {
        const api = props.api;
        if (!api || api.isDestroyed?.()) {
            sections.value = [];
            return;
        }

        const sectionList = [];
        const sectionByPath = new Map();
        const columnByKey = new Map();

        api.getAllGridColumns().forEach(column => {
            const colDef = column.getColDef();
            // Technische Spalten (Aktionen, Auswahl, Status-Icon) sind per
            // lockVisible markiert und werden nicht zum Ausblenden angeboten.
            if (colDef.lockVisible) return;

            const groupPath = groupPathOf(column);
            const label = (colDef.headerName || '').trim() || colDef.field || column.getColId();
            const key = `${groupPath}|${label}`;
            const existing = columnByKey.get(key);

            // Die Trupp-Spalte ist zweimal definiert (columnGroupShow open/closed)
            // und hat damit zwei colIds; beide gehoeren zu einem Menueeintrag und
            // werden gemeinsam geschaltet, sonst bliebe die Gruppe halb sichtbar.
            if (existing) {
                existing.colIds.push(column.getColId());
                existing.visible = existing.visible || column.isVisible();
                return;
            }

            const item = {
                key,
                label,
                colIds: [column.getColId()],
                visible: column.isVisible()
            };
            columnByKey.set(key, item);

            let section = sectionByPath.get(groupPath);
            if (!section) {
                section = {
                    key: groupPath || '__ungrouped__',
                    label: groupPath,
                    columns: [],
                    allVisible: false,
                    someVisible: false
                };
                sectionByPath.set(groupPath, section);
                sectionList.push(section);
            }
            section.columns.push(item);
        });

        // Erst nach dem Zusammenfassen auswerten, sonst fehlt die zweite
        // Trupp-Spalte im Gruppenzustand.
        sectionList.forEach(section => {
            section.allVisible = section.columns.every(column => column.visible);
            section.someVisible = section.columns.some(column => column.visible);
        });

        sections.value = sectionList;
    }

    function setVisibility(item, visible) {
        props.api?.setColumnsVisible(item.colIds, !!visible);
        emit('state-changed');
    }

    function setSectionVisibility(section, visible) {
        const colIds = section.columns.flatMap(column => column.colIds);
        if (!colIds.length) return;

        props.api?.setColumnsVisible(colIds, !!visible);
        emit('state-changed');
    }

    function showAll() {
        const colIds = sections.value.flatMap(
            section => section.columns.flatMap(column => column.colIds)
        );
        if (!colIds.length) return;

        props.api?.setColumnsVisible(colIds, true);
        emit('state-changed');
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
            sections.value = [];
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
                prepend-icon="mdi-view-column-outline"
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
        <v-card min-width="340" rounded="lg">
            <v-toolbar color="transparent" density="compact">
                <v-toolbar-title class="text-subtitle-2">Angezeigte Spalten</v-toolbar-title>
            </v-toolbar>
            <v-divider />
            <v-list density="compact" class="py-0" style="max-height: 55vh; overflow-y: auto;">
                <template v-for="section in sections" :key="section.key">
                    <!-- Spaltengruppe: eigene Checkbox schaltet alle Unterspalten -->
                    <v-list-item v-if="section.label" class="px-2">
                        <v-checkbox
                            :model-value="section.allVisible"
                            :indeterminate="section.someVisible && !section.allVisible"
                            :label="section.label"
                            density="compact"
                            color="primary"
                            hide-details
                            @update:modelValue="setSectionVisibility(section, $event)"
                        />
                    </v-list-item>
                    <v-list-item
                        v-for="column in section.columns"
                        :key="column.key"
                        :class="section.label ? 'px-2 pl-8' : 'px-2'"
                    >
                        <v-checkbox
                            :model-value="column.visible"
                            :label="column.label"
                            density="compact"
                            color="primary"
                            hide-details
                            @update:modelValue="setVisibility(column, $event)"
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
