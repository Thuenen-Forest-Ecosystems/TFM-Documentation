


/**
 * Recursively traverses a schema and resolves properties that have a lookup_table defined.
 * It fetches the lookup data from the specified Supabase table and updates the schema.
 *
 * @param {object} schema - The schema object to process.
 * @param {object} supabase - The Supabase client instance.
 * @param {boolean} useApiForEnumOnly - Force API resolution even if schema names exist.
 * @returns {Promise<object>} A new schema object with resolved lookups.
 */
export async function resolveSchemaLookups(schema, supabase, useApiForEnumOnly = false) {
    if (!schema || !supabase) {
        return schema;
    }

        const newSchema = JSON.parse(JSON.stringify(schema));
    const lookupPromises = [];

    function traverse(node) {
        if (typeof node !== 'object' || node === null) {
            return;
        }

        for (const key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key)) {
                const property = node[key];
                if (property?.$tfm?.lookup_table) {
                    const shouldResolveByApi = useApiForEnumOnly || !property.$tfm.name_de || !property.$tfm.name_en;
                    if (shouldResolveByApi) {
                        const promise = (async () => {
                            const tableName = property.$tfm.lookup_table;
                            try {
                                const { data, error } = await supabase.schema('lookup').from(tableName).select('*');
                                if (error) {
                                    console.error(`Error fetching lookup table ${tableName}:`, error);
                                    return;
                                }

                                if (data && data.length > 0) {
                                    const enums = [null];
                                    const nameDe = [null];
                                    const nameEn = [null];
                                    const intervals = [null];

                                    const seenValues = new Set();
                                    seenValues.add(null);

                                    const isNumeric = property.type === 'integer' || property.type === 'number' || 
                                        (Array.isArray(property.type) && (property.type.includes('integer') || property.type.includes('number')));

                                    data.forEach(item => {
                                        let val = item.code !== undefined ? item.code : (item.id !== undefined ? item.id : item.value);
                                        if (isNumeric && val !== null && val !== undefined && val !== '') {
                                            val = Number(val);
                                        }

                                        if (!seenValues.has(val)) {
                                            seenValues.add(val);
                                            enums.push(val);
                                            nameDe.push(item.name_de !== undefined ? item.name_de : (item.name !== undefined ? item.name : null));
                                            nameEn.push(item.name_en !== undefined ? item.name_en : (item.name !== undefined ? item.name : null));
                                            intervals.push(item.interval || null);
                                        }
                                    });

                                    property.enum = enums;
                                    property.$tfm.name_de = nameDe;
                                    property.$tfm.name_en = nameEn;
                                    property.$tfm.interval = intervals;
                                }
                            } catch (e) {
                                console.error(`Exception fetching or processing lookup table ${tableName}:`, e);
                            }
                        })();
                        lookupPromises.push(promise);
                    }
                } else {
                    traverse(property);
                }
            }
        }
    }

    traverse(newSchema.properties);

    await Promise.all(lookupPromises);

    return newSchema;
}
