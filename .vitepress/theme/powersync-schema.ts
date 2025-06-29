import { column, Schema, Table } from '@powersync/web';

const records = new Table({
    plot_id: column.text,
    plot_name: column.integer,
    created_at: column.text,
    cluster_id: column.text,
    cluster_name: column.integer,
    responsible_administration: column.text,
    responsible_state: column.text,
    responsible_provider: column.text,
    responsible_troop: column.text,
    is_valid: column.integer,
    schema_id: column.text
});
const schemas = new Table({
    interval_name: column.text
});
const clusters = new Table({
    cluster_name: column.text
});
const organizations = new Table({
    name: column.text,
    type: column.text
});
const troop = new Table({
    name: column.text
});
const users_profile = new Table({
    organization_id: column.text
});
const organizations_lose = new Table({
    cluster_ids: column.text,
    name: column.text
});

export const AppSchema = new Schema({
    schemas,
    records,
    clusters,
    organizations,
    troop,
    users_profile,
    organizations_lose
});

export type Database = (typeof AppSchema)['types'];
//export type SchemasRecord = Database['schemas'];