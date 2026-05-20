<script setup>
    import { computed, getCurrentInstance, ref, watch } from 'vue';
    import { getOrganizationById, getTroopById } from '../Utils';

    const props = defineProps({
        modelValue: {
            type: Boolean,
            required: true
        },
        record: {
            type: Object,
            required: false,
            default: null
        },
        schema: {
            type: Object,
            required: false,
            default: null
        }
    });

    const emit = defineEmits(['update:modelValue']);

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const loadingSnapshots = ref(false);
    const loadError = ref('');
    const snapshots = ref([]);
    const troopById = ref({});
    const userProfileById = ref({});
    const resolvedMetaReferenceValues = ref({});

    const leftSnapshotKey = ref(null);
    const rightSnapshotKey = ref(null);
    const expandedPanels = ref([0]);
    const exportingCsv = ref(false);

    const showOnlyChanges = ref(true);

    // Hardcoded exclusion list for property keys/paths.
    // Example: 'intkey' excludes paths like properties.edges[0].intkey
    // Leave empty to disable the additional properties key exclusion.
    const hardcodedPropertiesKeyFilters = [
        'intkey'
    ];

    // Hardcoded allow-list for compare fields.
    // Leave empty to show all schema-defined fields.
    // Rules are applied to Meta Data fields.
    // Properties are always shown and are not filtered by these rules.
    // Each entry can be a string rule or an object: { rule, title }.
    // Rules support exact path, wildcard suffix "*" and nested wildcard ".*".
    // Example: { rule: 'properties.*' }
    // Example: { rule: 'previous_properties.*' }
    const includedFieldRules = [
        { rule: 'updated_by', title: 'Zuletzt bearbeitet von' },
        { rule: 'responsible_troop', title: 'Verantwortlicher Trupp' },
    ];

    // Hardcoded resolver rules for metadata reference fields.
    // Add entries here to resolve further UUID-based metadata fields.
    // rule supports exact path and wildcard syntax (same behavior as includedFieldRules).
    // resolver must be one of: userProfile, troop, organization.
    const metaReferenceResolverRules = [
        { rule: 'updated_by', resolver: 'userProfile' },
        { rule: 'responsible_troop', resolver: 'troop' },
        { rule: 'responsible_provider', resolver: 'organization' },
        { rule: 'responsible_state', resolver: 'organization' },
        { rule: 'responsible_administration', resolver: 'organization' }
    ];

    const excludedTopLevelKeys = new Set([
        'troopData',
        'providerData',
        'stateData',
        'administrationData',
        'updatedByProfile',
        'sortByDate'
    ]);

    watch(
        () => props.modelValue,
        async (isOpen) => {
            if (!isOpen) return;
            await loadSnapshots();
        }
    );

    watch(
        () => props.record?.plot_id,
        async (newPlotId, oldPlotId) => {
            if (!props.modelValue || !newPlotId || newPlotId === oldPlotId) return;
            await loadSnapshots();
        }
    );

    watch(
        () => [props.record?.id, props.record?.sortByDate, props.record?.updated_at, props.record?.created_at],
        () => {
            if (!props.modelValue || snapshots.value.length === 0) return;
            applyDefaultSelection();
        }
    );

    function close() {
        emit('update:modelValue', false);
    }

    function formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    function getSnapshotTimestamp(record, isLatest) {
        if (!record) return null;
        return isLatest
            ? (record.updated_at || record.created_at || null)
            : (record.created_at || record.updated_at || null);
    }

    function buildSnapshot(record, isLatest) {
        const timestamp = getSnapshotTimestamp(record, isLatest);
        const key = `${isLatest ? 'current' : 'history'}:${record.id}:${timestamp || 'none'}`;
        const labelPrefix = isLatest ? 'Aktuell' : 'Historie';

        return {
            key,
            isLatest,
            timestamp,
            label: `${labelPrefix} - ${formatDate(timestamp)}`,
            record
        };
    }

    function isSameSnapshot(snapshot, record) {
        if (!snapshot || !record) return false;
        if (snapshot.record?.id !== record.id) return false;

        const snapshotTimestamp = snapshot.timestamp ? String(snapshot.timestamp) : '';
        const recordTimestampValue = record.sortByDate || record.updated_at || record.created_at || '';
        const recordTimestamp = recordTimestampValue ? String(recordTimestampValue) : '';

        if (!snapshotTimestamp || !recordTimestamp) return true;
        return snapshotTimestamp === recordTimestamp;
    }

    function applyDefaultSelection() {
        if (snapshots.value.length === 0) {
            leftSnapshotKey.value = null;
            rightSnapshotKey.value = null;
            return;
        }

        const latestSnapshot = snapshots.value.find((item) => item.isLatest) || snapshots.value[0];
        const activeSnapshot = snapshots.value.find((item) => isSameSnapshot(item, props.record)) || null;

        rightSnapshotKey.value = latestSnapshot?.key || snapshots.value[0].key;

        if (activeSnapshot && activeSnapshot.key !== rightSnapshotKey.value) {
            leftSnapshotKey.value = activeSnapshot.key;
            return;
        }

        const fallbackLeft = snapshots.value.find((item) => item.key !== rightSnapshotKey.value) || snapshots.value[0];
        leftSnapshotKey.value = fallbackLeft?.key || null;
    }

    async function loadSnapshots() {
        const plotId = props.record?.plot_id;
        if (!plotId) {
            snapshots.value = [];
            leftSnapshotKey.value = null;
            rightSnapshotKey.value = null;
            return;
        }

        loadingSnapshots.value = true;
        loadError.value = '';

        const [latestResult, historyResult] = await Promise.all([
            supabase
                .from('records')
                .select('*')
                .eq('plot_id', plotId)
                .maybeSingle(),
            supabase
                .from('record_changes')
                .select('*')
                .eq('plot_id', plotId)
                .order('created_at', { ascending: false })
        ]);

        if (latestResult.error) {
            loadingSnapshots.value = false;
            loadError.value = latestResult.error.message || 'Fehler beim Laden des aktuellen Datensatzes.';
            return;
        }

        if (historyResult.error) {
            loadingSnapshots.value = false;
            loadError.value = historyResult.error.message || 'Fehler beim Laden der Historie.';
            return;
        }

        const nextSnapshots = [];

        if (latestResult.data) {
            nextSnapshots.push(buildSnapshot(latestResult.data, true));
        }

        (historyResult.data || []).forEach((historyItem) => {
            nextSnapshots.push(buildSnapshot(historyItem, false));
        });

        nextSnapshots.sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime;
        });

        const troopIds = Array.from(new Set(
            nextSnapshots
                .map((snapshot) => snapshot.record?.responsible_troop)
                .filter(Boolean)
        ));

        if (troopIds.length > 0) {
            const troopMap = { ...troopById.value };

            await Promise.all(troopIds.map(async (troopId) => {
                if (troopMap[troopId] !== undefined) return;
                const troop = await getTroopById(supabase, troopId);
                troopMap[troopId] = troop || null;
            }));

            troopById.value = troopMap;
        }

        snapshots.value = nextSnapshots;
        applyDefaultSelection();
        loadingSnapshots.value = false;
    }

    function formatTroopLabel(snapshot) {
        const troopId = snapshot?.record?.responsible_troop;
        if (!troopId) return 'kein Trupp';

        const troop = troopById.value[troopId];
        if (!troop) return `Trupp ${String(troopId).substring(0, 8)}…`;

        const troopType = troop.is_control_troop ? 'KT' : 'AT';
        return `${troop.name || troop.id} (${troopType})`;
    }

    function normalizeReferencePath(path) {
        if (!path) return '';
        if (path.startsWith('records.')) return path.slice('records.'.length);
        return path;
    }

    function looksLikeUuid(value) {
        if (value === undefined || value === null) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
    }

    async function resolveUserProfileReference(userId) {
        if (!looksLikeUuid(userId)) return null;

        const key = String(userId);
        if (Object.prototype.hasOwnProperty.call(userProfileById.value, key)) {
            const cached = userProfileById.value[key];
            return cached?.user_name || cached?.email || null;
        }

        const { data, error } = await supabase
            .from('users_profile')
            .select('id, email, user_name')
            .eq('id', key)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user profile:', error);
            userProfileById.value = { ...userProfileById.value, [key]: null };
            return null;
        }

        userProfileById.value = { ...userProfileById.value, [key]: data || null };
        return data?.user_name || data?.email || null;
    }

    async function resolveTroopReference(troopId) {
        if (!troopId) return null;

        const troop = await getTroopById(supabase, String(troopId));
        if (!troop) return null;

        const troopType = troop.is_control_troop ? 'KT' : 'AT';
        return `${troop.name || troop.id} (${troopType})`;
    }

    async function resolveOrganizationReference(organizationId) {
        if (!organizationId) return null;

        const organization = await getOrganizationById(supabase, String(organizationId));
        if (!organization) return null;

        return organization.name || organization.id || null;
    }

    function getResolverByName(name) {
        if (name === 'userProfile') return resolveUserProfileReference;
        if (name === 'troop') return resolveTroopReference;
        if (name === 'organization') return resolveOrganizationReference;
        return null;
    }

    function getMetaReferenceResolver(path) {
        if (!path) return null;

        const normalizedPath = normalizeReferencePath(path);
        const matchedRule = metaReferenceResolverRules.find((ruleEntry) => {
            const normalizedRule = normalizeReferencePath(ruleEntry.rule || '');
            return matchesIncludedFieldRule(normalizedPath, normalizedRule);
        });

        if (!matchedRule) return null;

        const resolve = getResolverByName(matchedRule.resolver);
        if (!resolve) return null;

        return { resolve, normalizedPath };
    }

    function setResolvedMetaReferenceValue(path, rawValue, resolvedValue) {
        const existingByPath = resolvedMetaReferenceValues.value[path] || {};
        resolvedMetaReferenceValues.value = {
            ...resolvedMetaReferenceValues.value,
            [path]: {
                ...existingByPath,
                [rawValue]: resolvedValue
            }
        };
    }

    function getResolvedMetaReferenceValue(path, value) {
        if (value === undefined || value === null) return '';

        const normalizedPath = normalizeReferencePath(path);
        const byPath = resolvedMetaReferenceValues.value[normalizedPath] || null;
        if (!byPath) return '';

        const resolved = byPath[String(value)];
        if (typeof resolved !== 'string') return '';
        return resolved;
    }

    function formatMetaValue(path, value) {
        const resolved = getResolvedMetaReferenceValue(path, value);
        if (resolved) return resolved;
        return formatValue(value);
    }

    async function resolveMetaReferenceValues(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return;

        const pending = new Map();

        rows.forEach((row) => {
            if (getSectionKey(row.path) !== 'metadata') return;

            const resolver = getMetaReferenceResolver(row.path);
            if (!resolver) return;

            [row.leftValue, row.rightValue].forEach((raw) => {
                if (raw === undefined || raw === null) return;

                const rawValue = String(raw);
                if (!rawValue) return;

                const current = resolvedMetaReferenceValues.value[resolver.normalizedPath]?.[rawValue];
                if (current !== undefined) return;

                const key = `${resolver.normalizedPath}:${rawValue}`;
                if (pending.has(key)) return;

                pending.set(key, {
                    path: resolver.normalizedPath,
                    rawValue,
                    resolve: resolver.resolve
                });
            });
        });

        await Promise.all(Array.from(pending.values()).map(async (item) => {
            let resolved = null;
            try {
                resolved = await item.resolve(item.rawValue);
            } catch (error) {
                console.error('Error resolving metadata reference value:', item.path, error);
            }
            setResolvedMetaReferenceValue(item.path, item.rawValue, resolved || null);
        }));
    }

    function stableSerialize(value) {
        if (value === undefined) return '__undefined__';
        if (value === null) return 'null';

        const valueType = typeof value;
        if (valueType === 'number' || valueType === 'boolean' || valueType === 'string') {
            return JSON.stringify(value);
        }

        if (Array.isArray(value)) {
            return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
        }

        if (valueType === 'object') {
            const keys = Object.keys(value).sort();
            return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
        }

        return String(value);
    }

    function schemaTypeIncludes(schemaNode, expectedType) {
        if (!schemaNode) return false;
        if (Array.isArray(schemaNode.type)) return schemaNode.type.includes(expectedType);
        return schemaNode.type === expectedType;
    }

    function getChildSchema(schemaNode, key) {
        if (!schemaNode) return null;

        if (schemaNode.properties?.[key]) return schemaNode.properties[key];

        for (const compositeKey of ['allOf', 'anyOf', 'oneOf']) {
            if (!Array.isArray(schemaNode[compositeKey])) continue;
            for (const child of schemaNode[compositeKey]) {
                const match = getChildSchema(child, key);
                if (match) return match;
            }
        }

        return null;
    }

    function getArrayItemSchema(schemaNode) {
        if (!schemaNode) return null;

        if (schemaNode.items) {
            if (Array.isArray(schemaNode.items)) return schemaNode.items[0] || null;
            return schemaNode.items;
        }

        for (const compositeKey of ['allOf', 'anyOf', 'oneOf']) {
            if (!Array.isArray(schemaNode[compositeKey])) continue;
            for (const child of schemaNode[compositeKey]) {
                const itemSchema = getArrayItemSchema(child);
                if (itemSchema) return itemSchema;
            }
        }

        return null;
    }

    function resolveTopLevelSchema(topLevelKey) {
        if (!props.schema) return null;
        if (topLevelKey === 'properties' || topLevelKey === 'previous_properties') return props.schema;
        if (props.schema.properties?.[topLevelKey]) return props.schema.properties[topLevelKey];
        return null;
    }

    function registerTitle(titleMap, path, schemaNode) {
        if (!path) return;
        if (schemaNode?.title && !titleMap[path]) {
            titleMap[path] = schemaNode.title;
        }
    }

    function flattenValueWithSchema(value, schemaNode, path, target, titleMap) {
        // Compare only fields that are explicitly backed by schema nodes.
        if (!schemaNode) return;

        if (Array.isArray(value)) {
            const hasArraySchema = schemaTypeIncludes(schemaNode, 'array') || !!schemaNode?.items;

            if (!hasArraySchema) {
                return;
            }

            const itemSchema = getArrayItemSchema(schemaNode);
            if (value.length === 0) {
                target[path] = [];
                registerTitle(titleMap, path, schemaNode);
                return;
            }

            value.forEach((item, index) => {
                const itemPath = `${path}[${index}]`;
                flattenValueWithSchema(item, itemSchema, itemPath, target, titleMap);
            });
            return;
        }

        if (value !== null && typeof value === 'object') {
            const keys = Object.keys(value).sort();

            if (keys.length === 0 && path) {
                target[path] = value;
                registerTitle(titleMap, path, schemaNode);
                return;
            }

            keys.forEach((key) => {
                const nextPath = path ? `${path}.${key}` : key;
                const childSchema = getChildSchema(schemaNode, key);
                if (!childSchema) return;
                flattenValueWithSchema(value[key], childSchema, nextPath, target, titleMap);
            });
            return;
        }

        target[path] = value;
        registerTitle(titleMap, path, schemaNode);
    }

    function flattenValueWithoutSchema(value, path, target) {
        if (Array.isArray(value)) {
            if (value.length === 0) {
                target[path] = [];
                return;
            }

            value.forEach((item, index) => {
                const itemPath = `${path}[${index}]`;
                flattenValueWithoutSchema(item, itemPath, target);
            });
            return;
        }

        if (value !== null && typeof value === 'object') {
            const keys = Object.keys(value).sort();

            if (keys.length === 0) {
                target[path] = value;
                return;
            }

            keys.forEach((key) => {
                const nextPath = path ? `${path}.${key}` : key;
                flattenValueWithoutSchema(value[key], nextPath, target);
            });
            return;
        }

        target[path] = value;
    }

    function normalizeRecord(record) {
        if (!record || typeof record !== 'object') return {};

        const normalized = {};
        Object.keys(record).forEach((key) => {
            if (excludedTopLevelKeys.has(key)) return;
            normalized[key] = record[key];
        });

        return normalized;
    }

    function buildFlatRecord(record) {
        const normalized = normalizeRecord(record);
        const flat = {};
        const titles = {};

        Object.keys(normalized)
            .sort()
            .forEach((topLevelKey) => {
                const isPropertiesRoot = topLevelKey === 'properties';
                if (topLevelKey === 'previous_properties') return;

                const topLevelSchema = resolveTopLevelSchema(topLevelKey);

                if (isPropertiesRoot) {
                    if (topLevelSchema) {
                        flattenValueWithSchema(normalized[topLevelKey], topLevelSchema, topLevelKey, flat, titles);
                        return;
                    }

                    // Fallback so properties are still compared even when
                    // schema is temporarily unavailable.
                    flattenValueWithoutSchema(normalized[topLevelKey], topLevelKey, flat);
                    return;
                }

                // Meta data is always compared, even when it is not part of the JSON schema.
                flattenValueWithoutSchema(normalized[topLevelKey], topLevelKey, flat);
            });

        return { flat, titles };
    }

    function buildFlatPreviousProperties(record) {
        const normalized = normalizeRecord(record);
        const flat = {};
        const titles = {};

        if (!Object.prototype.hasOwnProperty.call(normalized, 'previous_properties')) {
            return { flat, titles };
        }

        const topLevelSchema = resolveTopLevelSchema('previous_properties');
        if (topLevelSchema) {
            flattenValueWithSchema(normalized.previous_properties, topLevelSchema, 'previous_properties', flat, titles);
            return { flat, titles };
        }

        // Fallback so BWI2022 values remain visible without schema.
        flattenValueWithoutSchema(normalized.previous_properties, 'previous_properties', flat);
        return { flat, titles };
    }

    function toPreviousPropertiesPath(path) {
        if (path === 'properties') return 'previous_properties';
        if (path.startsWith('properties.')) return `previous_properties.${path.slice('properties.'.length)}`;
        if (path.startsWith('properties[')) return `previous_properties${path.slice('properties'.length)}`;
        return '';
    }

    function fromPreviousPropertiesPath(path) {
        if (path === 'previous_properties') return 'properties';
        if (path.startsWith('previous_properties.')) return `properties.${path.slice('previous_properties.'.length)}`;
        if (path.startsWith('previous_properties[')) return `properties${path.slice('previous_properties'.length)}`;
        return '';
    }

    const snapshotItems = computed(() => snapshots.value.map((snapshot) => {
        const troopLabel = formatTroopLabel(snapshot);
        return {
            title: `${snapshot.label} - ${troopLabel}`,
            subtitle: `Verantwortlicher Trupp: ${troopLabel}`,
            value: snapshot.key
        };
    }));

    const leftSnapshot = computed(() => snapshots.value.find((item) => item.key === leftSnapshotKey.value) || null);
    const rightSnapshot = computed(() => snapshots.value.find((item) => item.key === rightSnapshotKey.value) || null);

    function swapSnapshots() {
        const tmp = leftSnapshotKey.value;
        leftSnapshotKey.value = rightSnapshotKey.value;
        rightSnapshotKey.value = tmp;
    }

    const allRows = computed(() => {
        if (!leftSnapshot.value || !rightSnapshot.value) return [];

        const left = buildFlatRecord(leftSnapshot.value.record);
        const right = buildFlatRecord(rightSnapshot.value.record);
        const BWI2022 = buildFlatPreviousProperties(rightSnapshot.value.record);
        const leftFlat = left.flat;
        const rightFlat = right.flat;
        const BWI2022Flat = BWI2022.flat;

        const mappedBWI2022Keys = Object.keys(BWI2022Flat)
            .map((path) => fromPreviousPropertiesPath(path))
            .filter((path) => !!path);

        const keys = new Set([
            ...Object.keys(leftFlat),
            ...Object.keys(rightFlat),
            ...mappedBWI2022Keys
        ]);

        return Array.from(keys)
            .sort((a, b) => a.localeCompare(b))
            .map((path) => {
                const leftValue = leftFlat[path];
                const rightValue = rightFlat[path];
                const BWI2022Path = toPreviousPropertiesPath(path);
                const BWI2022Value = BWI2022Path ? BWI2022Flat[BWI2022Path] : undefined;
                const changed = stableSerialize(leftValue) !== stableSerialize(rightValue);
                return {
                    path,
                    title: left.titles[path] || right.titles[path] || BWI2022.titles[BWI2022Path] || '',
                    leftValue,
                    rightValue,
                    BWI2022Value,
                    changed
                };
            });
    });

    function normalizeIncludedFieldRule(ruleEntry) {
        if (typeof ruleEntry === 'string') {
            return { rule: ruleEntry, title: '' };
        }

        if (ruleEntry && typeof ruleEntry.rule === 'string') {
            return {
                rule: ruleEntry.rule,
                title: typeof ruleEntry.title === 'string' ? ruleEntry.title : ''
            };
        }

        return null;
    }

    const normalizedIncludedFieldRules = includedFieldRules
        .map((ruleEntry) => normalizeIncludedFieldRule(ruleEntry))
        .filter((ruleEntry) => !!ruleEntry?.rule);

    function matchesIncludedFieldRule(path, rule) {
        if (!path || !rule) return false;

        if (rule === '*') return true;

        if (rule.endsWith('.*')) {
            const prefix = rule.slice(0, -2);
            return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
        }

        if (rule.endsWith('*')) {
            const prefix = rule.slice(0, -1);
            return path.startsWith(prefix);
        }

        return path === rule || path.startsWith(`${rule}.`) || path.startsWith(`${rule}[`);
    }

    function getHardcodedFieldTitle(path) {
        const matched = normalizedIncludedFieldRules.find((ruleEntry) => {
            return ruleEntry.title && matchesIncludedFieldRule(path, ruleEntry.rule);
        });

        return matched?.title || '';
    }

    function isFieldIncluded(path) {
        if (getSectionKey(path) === 'properties') return true;
        if (normalizedIncludedFieldRules.length === 0) return true;
        return normalizedIncludedFieldRules.some((ruleEntry) => matchesIncludedFieldRule(path, ruleEntry.rule));
    }

    const configuredRows = computed(() => {
        return allRows.value
            .filter((row) => isFieldIncluded(row.path))
            .map((row) => {
                const hardcodedTitle = getHardcodedFieldTitle(row.path);
                return {
                    ...row,
                    displayTitle: hardcodedTitle || row.title || row.path
                };
            });
    });

    watch(
        () => [props.modelValue, leftSnapshotKey.value, rightSnapshotKey.value, configuredRows.value.length],
        async ([isOpen]) => {
            if (!isOpen || !leftSnapshot.value || !rightSnapshot.value) return;
            await resolveMetaReferenceValues(configuredRows.value);
        }
    );

    const changedRows = computed(() => configuredRows.value.filter((row) => row.changed));

    const visibleRows = computed(() => {
        const sourceRows = showOnlyChanges.value ? changedRows.value : configuredRows.value;
        const needles = hardcodedPropertiesKeyFilters
            .map((value) => String(value || '').trim().toLowerCase())
            .filter((value) => !!value);

        if (needles.length === 0) return sourceRows;

        return sourceRows.filter((row) => {
            if (getSectionKey(row.path) !== 'properties') return true;

            const path = row.path.toLowerCase();
            const title = (row.displayTitle || row.title || '').toLowerCase();
            const isExcluded = needles.some((needle) => path.includes(needle) || title.includes(needle));
            return !isExcluded;
        });
    });

    function getSectionKey(path) {
        if (
            path === 'properties'
            || path.startsWith('properties.')
            || path === 'previous_properties'
            || path.startsWith('previous_properties.')
        ) {
            return 'properties';
        }

        if (
            path === 'validation_errors'
            || path.startsWith('validation_errors.')
            || path === 'plausibility_errors'
            || path.startsWith('plausibility_errors.')
        ) {
            return 'errors';
        }

        return 'metadata';
    }

    function groupRowsBySection(rows) {
        const grouped = {
            metadata: [],
            properties: [],
            errors: []
        };

        rows.forEach((row) => {
            grouped[getSectionKey(row.path)].push(row);
        });

        return grouped;
    }

    const sectionRowsVisible = computed(() => groupRowsBySection(visibleRows.value));
    const sectionRowsAll = computed(() => groupRowsBySection(configuredRows.value));
    const sectionRowsChanged = computed(() => groupRowsBySection(changedRows.value));

    const compareSections = computed(() => {
        const defs = [
            { key: 'metadata', label: 'Meta Data' },
            { key: 'properties', label: 'Properties' }
        ];

        return defs.map((def, index) => ({
            ...def,
            panelIndex: index,
            rows: sectionRowsVisible.value[def.key],
            total: sectionRowsAll.value[def.key].length,
            changed: sectionRowsChanged.value[def.key].length
        }));
    });

    const compareSectionByKey = computed(() => {
        return compareSections.value.reduce((acc, section) => {
            acc[section.key] = section;
            return acc;
        }, {});
    });

    function formatValue(value) {
        if (value === undefined) return '—';
        if (value === null) return 'null';
        if (typeof value === 'string') return value === '' ? '""' : value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return stableSerialize(value);
    }

    function escapeCsvValue(value) {
        const text = String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
    }

    function getCsvTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    async function downloadComparisonCsv() {
        if (!leftSnapshot.value || !rightSnapshot.value) return;

        const exportRows = [
            ...sectionRowsAll.value.metadata,
            ...sectionRowsAll.value.properties
        ];

        if (exportRows.length === 0) return;

        exportingCsv.value = true;
        try {
            await resolveMetaReferenceValues(exportRows);

            const leftLabel = leftSnapshot.value.label || 'Version A';
            const rightLabel = rightSnapshot.value.label || 'Version B';

            const header = [
                'Section',
                'Field',
                'Path',
                leftLabel,
                rightLabel,
                'BWI2022',
                'Changed'
            ];

            const rows = exportRows.map((row) => {
                const section = getSectionKey(row.path);
                const leftVal = section === 'metadata'
                    ? formatMetaValue(row.path, row.leftValue)
                    : formatValue(row.leftValue);
                const rightVal = section === 'metadata'
                    ? formatMetaValue(row.path, row.rightValue)
                    : formatValue(row.rightValue);
                const bwi2022Val = section === 'properties' ? formatValue(row.BWI2022Value) : '';

                return [
                    section,
                    row.displayTitle || row.title || row.path,
                    row.path,
                    leftVal,
                    rightVal,
                    bwi2022Val,
                    row.changed ? 'yes' : 'no'
                ];
            });

            const csvContent = [header, ...rows]
                .map((cols) => cols.map((col) => escapeCsvValue(col)).join(';'))
                .join('\r\n');

            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `comparison_${getCsvTimestamp()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } finally {
            exportingCsv.value = false;
        }
    }
</script>

<template>
    <v-dialog :model-value="props.modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="1200" scrollable>
        <v-card>
            <v-toolbar flat density="compact">
                <v-toolbar-title>Vergleich</v-toolbar-title>
                <template v-slot:append>
                    <v-btn icon="mdi-close" variant="text" @click="close" />
                </template>
            </v-toolbar>

            <v-progress-linear v-if="loadingSnapshots" indeterminate color="primary" />

            <v-card-text class="pt-4">
                <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-3">
                    {{ loadError }}
                </v-alert>

                <v-alert v-else-if="!loadingSnapshots && snapshots.length === 0" type="info" variant="tonal" density="compact">
                    Keine Vergleichsdaten für diesen Datensatz gefunden.
                </v-alert>

                <template v-else>
                    <v-row dense>
                        <v-col cols="12" md="5">
                            <v-select
                                v-model="leftSnapshotKey"
                                :items="snapshotItems"
                                label="Version A"
                                variant="outlined"
                                density="compact"
                                hide-details
                            />
                        </v-col>

                        <v-col cols="12" md="2" class="d-flex justify-center align-center py-0">
                            <v-btn icon="mdi-swap-horizontal" variant="tonal" @click="swapSnapshots" />
                        </v-col>

                        <v-col cols="12" md="5">
                            <v-select
                                v-model="rightSnapshotKey"
                                :items="snapshotItems"
                                label="Version B"
                                variant="outlined"
                                density="compact"
                                hide-details
                            />
                        </v-col>

                        <v-col cols="12" class="d-flex justify-end">
                            <v-btn
                                prepend-icon="mdi-download"
                                variant="tonal"
                                size="small"
                                :loading="exportingCsv"
                                :disabled="!leftSnapshot || !rightSnapshot || configuredRows.length === 0"
                                @click="downloadComparisonCsv"
                            >
                                CSV herunterladen
                            </v-btn>
                        </v-col>

                    </v-row>

                    <v-row dense class="mt-1 mb-2">
                        <v-col cols="12" md="12">
                            <v-switch
                                v-model="showOnlyChanges"
                                color="primary"
                                density="compact"
                                hide-details
                                label="Nur Unterschiede anzeigen"
                            />
                        </v-col>
                    </v-row>

                    <div class="d-flex align-center ga-2 mb-3 flex-wrap">
                        <v-chip size="small" variant="tonal">Felder: {{ configuredRows.length }}</v-chip>
                        <v-chip size="small" color="warning" variant="tonal">Unterschiede: {{ changedRows.length }}</v-chip>
                    </div>

                    <v-alert v-if="!leftSnapshot || !rightSnapshot" type="info" density="compact" variant="tonal" class="mb-2">
                        Bitte zwei Versionen auswählen.
                    </v-alert>

                    <template v-else>
                        <v-expansion-panels v-model="expandedPanels" multiple variant="accordion" class="compare-sections mb-3">
                            <v-expansion-panel :value="0">
                                <v-expansion-panel-title>
                                    <div class="d-flex align-center ga-2 flex-wrap">
                                        <span class="font-weight-medium">{{ compareSectionByKey.metadata.label }}</span>
                                        <v-chip size="x-small" variant="tonal">Felder: {{ compareSectionByKey.metadata.total }}</v-chip>
                                        <v-chip size="x-small" color="warning" variant="tonal">Unterschiede: {{ compareSectionByKey.metadata.changed }}</v-chip>
                                    </div>
                                </v-expansion-panel-title>

                                <v-expansion-panel-text>
                                    <div class="compare-table-wrapper">
                                        <v-table density="compact" fixed-header class="compare-table">
                                            <colgroup>
                                                <col class="compare-col-field-meta" />
                                                <col class="compare-col-value-meta" />
                                                <col class="compare-col-value-meta" />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th class="text-left">Feld</th>
                                                    <th class="text-left">Version A</th>
                                                    <th class="text-left">Version B</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="row in compareSectionByKey.metadata.rows" :key="'metadata:' + row.path" :class="{ 'compare-row-changed': row.changed }">
                                                    <td class="compare-path">
                                                        <div class="compare-field-title">{{ row.displayTitle }}</div>
                                                        <div class="compare-title">{{ row.path }}</div>
                                                    </td>
                                                    <td>
                                                        <div class="compare-value">{{ formatMetaValue(row.path, row.leftValue) }}</div>
                                                    </td>
                                                    <td>
                                                        <div class="compare-value">{{ formatMetaValue(row.path, row.rightValue) }}</div>
                                                    </td>
                                                </tr>
                                                <tr v-if="compareSectionByKey.metadata.rows.length === 0">
                                                    <td colspan="3" class="text-medium-emphasis pa-4">
                                                        Keine passenden Felder gefunden.
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </v-table>
                                    </div>
                                </v-expansion-panel-text>
                            </v-expansion-panel>
                        </v-expansion-panels>

                        <div class="compare-static-section mb-3">
                            <div class="d-flex align-center ga-2 flex-wrap mb-2">
                                <span class="font-weight-medium">{{ compareSectionByKey.properties.label }}</span>
                                <v-chip size="x-small" variant="tonal">Felder: {{ compareSectionByKey.properties.total }}</v-chip>
                                <v-chip size="x-small" color="warning" variant="tonal">Unterschiede: {{ compareSectionByKey.properties.changed }}</v-chip>
                            </div>

                            <div class="compare-table-wrapper compare-table-wrapper-full">
                                <v-table density="compact" class="compare-table">
                                    <colgroup>
                                        <col class="compare-col-field-properties" />
                                        <col class="compare-col-value-properties" />
                                        <col class="compare-col-value-properties" />
                                        <col class="compare-col-value-properties" />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th class="text-left">Feld</th>
                                            <th class="text-left">Version A</th>
                                            <th class="text-left">Version B</th>
                                            <th class="text-left">BWI2022</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="row in compareSectionByKey.properties.rows" :key="'properties:' + row.path" :class="{ 'compare-row-changed': row.changed }">
                                            <td class="compare-path">
                                                <div class="compare-field-title">{{ row.displayTitle }}</div>
                                                <div class="compare-title">{{ row.path }}</div>
                                            </td>
                                            <td>
                                                <div class="compare-value">{{ formatValue(row.leftValue) }}</div>
                                            </td>
                                            <td>
                                                <div class="compare-value">{{ formatValue(row.rightValue) }}</div>
                                            </td>
                                            <td>
                                                <div class="compare-value">{{ formatValue(row.BWI2022Value) }}</div>
                                            </td>
                                        </tr>
                                        <tr v-if="compareSectionByKey.properties.rows.length === 0">
                                            <td colspan="4" class="text-medium-emphasis pa-4">
                                                Keine passenden Felder gefunden.
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>
                        </div>

                    </template>
                </template>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped>
    .compare-table {
        width: 100%;
        table-layout: fixed;
    }

    .compare-col-field-meta {
        width: 40%;
    }

    .compare-col-value-meta {
        width: 30%;
    }

    .compare-col-field-properties {
        width: 34%;
    }

    .compare-col-value-properties {
        width: 22%;
    }

    .compare-table-wrapper {
        max-height: 60vh;
        overflow: auto;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
    }

    .compare-table-wrapper-full {
        max-height: none;
        overflow: visible;
    }

    .compare-path {
        white-space: normal;
        vertical-align: top;
    }

    .compare-field-title {
        font-family: inherit;
        font-size: 0.82rem;
        line-height: 1.25;
    }

    .compare-value {
        white-space: pre-wrap;
        word-break: break-word;
        vertical-align: top;
        font-family: monospace;
        font-size: 0.78rem;
    }

    .compare-title {
        font-family: monospace;
        font-size: 0.72rem;
        line-height: 1.2;
        opacity: 0.7;
    }

    .compare-row-changed td {
        background: rgba(var(--v-theme-warning), 0.08);
    }
</style>
