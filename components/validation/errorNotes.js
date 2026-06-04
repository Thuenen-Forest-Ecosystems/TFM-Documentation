function normalizePath(path) {
    if (path == null || path === '') return 'root';
    return path;
}

export function normalizeNoteText(value) {
    if (value == null) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const text = normalizeNoteText(item);
            if (text) return text;
        }
        return null;
    }

    if (typeof value === 'object') {
        if ('note' in value) {
            return normalizeNoteText(value.note);
        }
        if ('text' in value) {
            return normalizeNoteText(value.text);
        }
        if ('message' in value) {
            return normalizeNoteText(value.message);
        }
        return null;
    }

    return null;
}

export function parseErrorField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Error parsing stored error field:', error);
        }
    }
    return [];
}

export function getErrorKey(instancePath, schemaPath, message, source) {
    return `${normalizePath(instancePath)}-${normalizePath(schemaPath)}-${message}-${source}`;
}

function getSavedErrorMessage(error) {
    return error?.message || error?.error?.text || error?.rawError?.text || null;
}

function getSavedErrorNote(error) {
    return (
        normalizeNoteText(error?.note)
        /*|| normalizeNoteText(error?.rawError?.note)*/
        || normalizeNoteText(error?.error?.note)
        || null
    );
}

export function createSavedAcknowledgedErrorsMap(record) {
    const errorMap = new Map();

    for (const err of parseErrorField(record?.validation_errors)) {
        const source = err?.source || 'ajv';
        const message = getSavedErrorMessage(err);
        if (!message) continue;
        const key = getErrorKey(err?.instancePath, err?.schemaPath, message, source);
        errorMap.set(key, { ...err, source, message });
    }

    for (const err of parseErrorField(record?.plausibility_errors)) {
        const source = err?.source || 'tfm';
        const message = getSavedErrorMessage(err);
        if (!message) continue;
        const key = getErrorKey(err?.instancePath, err?.schemaPath, message, source);
        errorMap.set(key, { ...err, source, message });
    }

    return errorMap;
}

export function getSavedNote(savedAcknowledgedErrors, { instancePath, schemaPath, message, source }) {
    if (!message || !savedAcknowledgedErrors) return null;

    const exactKey = getErrorKey(instancePath, schemaPath, message, source);
    let savedError = savedAcknowledgedErrors.get(exactKey);

    if (!savedError && instancePath && instancePath !== '' && instancePath !== 'root') {
        const fallbackKey = getErrorKey('', schemaPath, message, source);
        savedError = savedAcknowledgedErrors.get(fallbackKey);
    }

    if (!savedError) {
        for (const err of savedAcknowledgedErrors.values()) {
            if (err?.message === message && err?.source === source) {
                savedError = err;
                break;
            }
        }
    }

    return savedError ? getSavedErrorNote(savedError) : null;
}

export function withSavedValidationNote(error, savedAcknowledgedErrors) {
    const savedNote = getSavedNote(savedAcknowledgedErrors, {
        instancePath: error?.instancePath,
        schemaPath: error?.schemaPath,
        message: error?.message,
        source: 'ajv'
    });
    return savedNote ? { ...error, savedNote } : error;
}

export function normalizePlausibilityInstancePath(path) {
    if (!path) return '';
    if (path.startsWith('/plot/0/')) {
        return path.slice('/plot/0'.length);
    }
    if (path === '/plot/0') {
        return '';
    }
    return path;
}

export function getPlausibilityMessage(error) {
    return error?.error?.text || error?.message || error?.rawError?.text || null;
}

export function getPlausibilityType(error) {
    return error?.error?.type || error?.type || error?.rawError?.type || 'error';
}

export function getPlausibilitySchemaPath(error) {
    return error?.schemaPath || error?.rawError?.schemaPath || null;
}

export function withSavedPlausibilityNote(error, savedAcknowledgedErrors) {
    const message = getPlausibilityMessage(error);
    const schemaPath = getPlausibilitySchemaPath(error);
    const source = error?.source || 'tfm';
    const savedNote = getSavedNote(savedAcknowledgedErrors, {
        instancePath: error?.instancePath,
        schemaPath,
        message,
        source
    });
    return savedNote ? { ...error, savedNote } : error;
}
