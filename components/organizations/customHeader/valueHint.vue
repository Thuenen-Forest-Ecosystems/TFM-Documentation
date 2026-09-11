<script setup>
    import { computed, onBeforeUnmount, ref, watch } from 'vue';

    // Spaltenkopf mit Info-Button, der auf Klick die Werte auflistet, die in der
    // Spalte stehen koennen. Werte, die in der Tabelle vorkommen, lassen sich
    // anklicken und werden als Spaltenfilter gesetzt (mehrere Werte = ODER).
    // Haengt als `innerHeaderComponent` nur im Textbereich des Kopfes, damit
    // Sortierung, Filter-Menue und Resize die von AG Grid bereitgestellten
    // bleiben.
    const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });

    const menu = ref(false);
    const menuTarget = ref(null);
    const selectedValues = ref([]);

    const displayName = computed(() => props.params?.displayName ?? '');
    const valueTitle = computed(() => props.params?.valueTitle || 'Mögliche Werte');
    const valueSource = computed(() => props.params?.valueSource || null);
    const colId = computed(() => props.params?.column?.getColId?.() ?? null);
    // AG Grids Textfilter begrenzt die Anzahl der Bedingungen; jede Auswahl ist
    // eine Bedingung, mehr Werte lassen sich nicht gleichzeitig filtern.
    const maxConditions = computed(() => props.params?.maxConditions ?? 5);

    // `valueHint` und `valueCounts` sind Funktionen, damit die Werte erst beim
    // Rendern gelesen werden: beim Aufbau der colDefs sind die Lookup-Tabellen
    // und die Zeilen noch nicht geladen.
    const values = computed(() => {
        const hint = props.params?.valueHint;
        const resolved = typeof hint === 'function' ? hint() : hint;
        return Array.isArray(resolved) ? resolved : [];
    });

    // Anzahl Ecken je Wert in der aktuell geladenen Tabelle - bewusst ungefiltert,
    // damit die Zahlen beim Filtern stehen bleiben.
    const counts = computed(() => {
        const counter = props.params?.valueCounts;
        const resolved = typeof counter === 'function' ? counter() : counter;
        return resolved instanceof Map ? resolved : new Map();
    });

    const hasValues = computed(() => values.value.length > 0);
    const atConditionLimit = computed(() => selectedValues.value.length >= maxConditions.value);

    function countFor(value) {
        return counts.value.get(value) ?? 0;
    }
    function isSelected(value) {
        return selectedValues.value.includes(value);
    }
    // Werte ohne Treffer wuerden die Tabelle leeren, und ueber dem
    // Bedingungslimit nimmt AG Grid den Filter nicht mehr an.
    function isSelectable(value) {
        return countFor(value) > 0 && (isSelected(value) || !atConditionLimit.value);
    }

    function _gridApi() {
        const api = props.params?.api;
        return api && !api.isDestroyed?.() ? api : null;
    }
    // Nur Gleich-Bedingungen stammen aus dieser Liste; ein von Hand gesetzter
    // Filter (z.B. "enthaelt") wird darum nicht als Auswahl angezeigt.
    function _selectedFromModel(model) {
        if (!model) {
            return [];
        }
        if (Array.isArray(model.conditions)) {
            return model.conditions
                .filter(condition => condition?.type === 'equals' && condition.filter != null)
                .map(condition => condition.filter);
        }
        return model.type === 'equals' && model.filter != null ? [model.filter] : [];
    }
    function readSelection() {
        const api = _gridApi();
        selectedValues.value = api && colId.value
            ? _selectedFromModel(api.getFilterModel()?.[colId.value])
            : [];
    }
    function applySelection(nextValues) {
        const api = _gridApi();
        if (!api || !colId.value) {
            return;
        }
        const conditions = nextValues.map(value => ({ filterType: 'text', type: 'equals', filter: value }));
        const model = conditions.length === 0
            ? null
            : conditions.length === 1
                ? conditions[0]
                : { filterType: 'text', operator: 'OR', conditions };

        api.setFilterModel({ ...api.getFilterModel(), [colId.value]: model });
        selectedValues.value = nextValues;
    }
    function toggleFilter(value) {
        if (!isSelectable(value)) {
            return;
        }
        applySelection(isSelected(value)
            ? selectedValues.value.filter(selected => selected !== value)
            : [...selectedValues.value, value]);
    }
    function clearColumnFilter() {
        applySelection([]);
    }

    // Klick und Mousedown duerfen nicht zum Kopf durchschlagen, sonst sortiert
    // bzw. verschiebt AG Grid die Spalte, waehrend das Menue aufgeht.
    function toggleMenu(event) {
        menuTarget.value = event.currentTarget;
        menu.value = !menu.value;
    }

    // Solange das Menue offen ist, den Filter mitlesen: er kann auch ueber das
    // Filter-Menue der Spalte oder "Alle zuruecksetzen" geaendert werden.
    watch(menu, (isOpen) => {
        const api = _gridApi();
        if (!api) {
            return;
        }
        if (isOpen) {
            readSelection();
            api.addEventListener('filterChanged', readSelection);
        } else {
            api.removeEventListener('filterChanged', readSelection);
        }
    });
    onBeforeUnmount(() => {
        _gridApi()?.removeEventListener('filterChanged', readSelection);
    });
</script>

<template>
    <span class="value-hint">
        <span
            v-if="hasValues"
            class="value-hint__icon"
            role="button"
            tabindex="-1"
            :aria-label="`${valueTitle} für ${displayName}`"
            @click.stop="toggleMenu"
            @mousedown.stop
            @touchstart.stop
        >
            <v-icon icon="mdi-information-outline" size="14" />
        </span>

        <span class="value-hint__text">{{ displayName }}</span>

        <v-menu
            v-model="menu"
            :target="menuTarget"
            location="bottom start"
            :close-on-content-click="false"
            scroll-strategy="close"
        >
            <v-card min-width="320" max-width="520">
                <v-card-item class="pb-1">
                    <v-card-title class="text-body-1">{{ valueTitle }} – {{ displayName }}</v-card-title>
                    <v-card-subtitle v-if="valueSource" class="text-caption">{{ valueSource }}</v-card-subtitle>
                </v-card-item>
                <v-divider />
                <v-list density="compact" max-height="360" class="py-0">
                    <v-list-item
                        v-for="value in values"
                        :key="value"
                        :disabled="!isSelectable(value)"
                        :active="isSelected(value)"
                        @click="toggleFilter(value)"
                    >
                        <template v-slot:prepend>
                            <v-icon
                                class="me-2"
                                size="16"
                                :color="isSelected(value) ? 'primary' : undefined"
                                :icon="isSelected(value) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                            />
                        </template>
                        <v-list-item-title class="text-body-2">{{ value }}</v-list-item-title>
                        <template v-slot:append>
                            <span class="text-caption text-medium-emphasis">{{ countFor(value) }}</span>
                        </template>
                    </v-list-item>
                </v-list>
                <v-divider />
                <div class="d-flex align-center ga-2 pa-2">
                    <div class="text-caption text-medium-emphasis flex-grow-1">
                        Klick filtert die Spalte (mehrere Werte = ODER). Zahl = Ecken mit diesem Wert in dieser Tabelle.
                        <template v-if="atConditionLimit">
                            <br />Mehr als {{ maxConditions }} Werte gleichzeitig sind nicht möglich.
                        </template>
                    </div>
                    <v-btn
                        v-if="selectedValues.length"
                        variant="text"
                        size="small"
                        rounded="xl"
                        prepend-icon="mdi-filter-remove"
                        @click="clearColumnFilter"
                    >Zurücksetzen</v-btn>
                </div>
            </v-card>
        </v-menu>
    </span>
</template>

<!--
    Bewusst nicht `scoped`: AG Grid mountet Vue-Komponenten ueber ein
    `{ extends: ... }`-Wrapper-Objekt, dadurch ist `instance.type.__scopeId`
    leer und das `data-v-*`-Attribut landet nie im DOM - scoped Regeln wuerden
    hier also nie greifen. Die Klassennamen sind deshalb eindeutig praefixt.
-->
<style>
    /* Der Kopftext darf schrumpfen (Ellipsis), das Icon bleibt sichtbar. */
    .value-hint {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
    }
    .value-hint__text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .value-hint__icon {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        /* Abstand am Icon statt per gap: der Kopftext wird von AG Grid
           umgebaut, das Icon bleibt so in jedem Fall abgesetzt. */
        margin-right: 12px;
        cursor: pointer;
        opacity: 0.55;
    }
    .value-hint__icon:hover {
        opacity: 1;
    }
</style>
