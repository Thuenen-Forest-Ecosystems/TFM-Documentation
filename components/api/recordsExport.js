// Shared record export helpers.
//
// The ZIP archive built here is used in two places:
//   - components/api/DownloadBtn.vue  → all records the user has access to
//   - components/organizations/ListOfClusterRecord.vue → only the selected Ecken
// Both must produce the exact same file layout, hence the shared module.

import JSZip from 'jszip'

// ── Schema ──────────────────────────────────────────────────────────────────
// Newest visible, non-deprecated schema row.
export async function fetchNewestSchema(supabase) {
  const { data, error } = await supabase
    .from('schemas')
    .select('id, title, version, schema')
    .eq('is_visible', true)
    .eq('is_deprecated', false)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (error || !data?.schema) {
    console.error('Error fetching schema:', error || 'schema missing in schemas row')
    return null
  }

  return data
}

// The plot-level schema lives at schema.properties.plot.items (or .plots.items)
function getPlotSchema(schema) {
  if (!schema?.properties) return null
  const plots = schema.properties.plot || schema.properties.plots
  return plots?.items || null
}

function typesOf(prop) {
  const types = Array.isArray(prop.type) ? prop.type : [prop.type]
  return types.filter(x => x !== 'null')
}

function isScalar(prop) {
  const types = typesOf(prop)
  return !types.includes('array') && !types.includes('object')
}

function isTable(prop) {
  return typesOf(prop).includes('array') && !!prop.items?.properties
}

// An object with declared sub-properties. Flattened into columns; when it sits
// directly on the plot it also gets its own CSV (position, plot_coordinates).
function isObjectNode(prop) {
  const types = typesOf(prop)
  return types.includes('object') && !types.includes('array') && !!prop.properties
}

// An object WITHOUT declared properties. The three occurrences in the schema
// (position.position_mean, position.position_median,
// plot_coordinates.center_location) are all documented as "Latitude /
// Longitude", so they become a pair of coordinate columns.
function isCoordinatePair(prop) {
  const types = typesOf(prop)
  return types.includes('object') && !types.includes('array') && !prop.properties
}

const COORD_PARTS = ['latitude', 'longitude']

// Leaf columns of one properties dict. Nested objects contribute prefixed
// columns, coordinate pairs contribute <key>_latitude / <key>_longitude.
// Arrays are skipped — they become tables of their own.
function collectFields(properties, prefix = [], titlePrefix = '') {
  const fields = []

  for (const [key, prop] of Object.entries(properties || {})) {
    const path = [...prefix, key]
    const name = prop.title || key
    const title = titlePrefix ? `${titlePrefix} — ${name}` : name

    if (isScalar(prop)) {
      fields.push({ key: path.join('_'), title, path })
    } else if (isCoordinatePair(prop)) {
      for (const part of COORD_PARTS) {
        fields.push({ key: `${path.join('_')}_${part}`, title: `${title} (${part})`, path, coord: part })
      }
    } else if (isObjectNode(prop)) {
      fields.push(...collectFields(prop.properties, path, title))
    }
  }

  return fields
}

// Emits one option per array node (at any depth) and per object node sitting
// directly on the plot. `path` is the key sequence from record.properties to
// the node; `indexColumns` names the 1-based position columns needed to tell
// nested rows apart — top-level sub-tables keep their historic header and get
// none.
function collectTables(properties, path, titlePrefix, indexColumns, options) {
  for (const [key, prop] of Object.entries(properties || {})) {
    const nodePath = [...path, key]
    const name = prop.title || key
    const title = titlePrefix ? `${titlePrefix} — ${name}` : name

    if (isTable(prop)) {
      const childIndexColumns = [...indexColumns, `${nodePath.join('_')}_index`]
      const fields = collectFields(prop.items.properties)
      if (fields.length) {
        options.push({
          key: nodePath.join('.'),
          title,
          fields,
          path: nodePath,
          indexColumns: nodePath.length > 1 ? childIndexColumns : []
        })
      }
      collectTables(prop.items.properties, nodePath, title, childIndexColumns, options)
    } else if (isObjectNode(prop)) {
      // Deeper objects are already columns of their plot-level ancestor's file.
      if (path.length === 0) {
        const fields = collectFields(prop.properties)
        if (fields.length) {
          options.push({ key: nodePath.join('.'), title, fields, path: nodePath, indexColumns: [] })
        }
      }
      collectTables(prop.properties, nodePath, title, indexColumns, options)
    }
  }
}

// All downloadable tables: "plot" (scalar fields) + one per object / array node
export function buildDownloadOptions(schema) {
  const plotSchema = getPlotSchema(schema)
  if (!plotSchema?.properties) return []

  const options = []

  // Deliberately scalars only: position and plot_coordinates get their own
  // files, so flattening them in here as well would duplicate every value.
  const scalarFields = Object.entries(plotSchema.properties)
    .filter(([, prop]) => isScalar(prop))
    .map(([key, prop]) => ({ key, title: prop.title || key, path: [key] }))

  if (scalarFields.length) {
    options.push({ key: '_plot', title: 'Eckendaten', fields: scalarFields, path: [], indexColumns: [] })
  }

  collectTables(plotSchema.properties, [], '', [], options)

  return options
}

// ── Coordinates ─────────────────────────────────────────────────────────────
function toNumber(val) {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

// The same logical value arrives in several shapes: the app writes
// {latitude, longitude} (record-position.dart), archived data carries GeoJSON
// {type:'Point', coordinates:[lng, lat]}, and some rows hold a bare [lng, lat].
function readLatLng(val) {
  if (!val) return null

  if (Array.isArray(val)) {
    if (val.length < 2) return null
    return { longitude: toNumber(val[0]), latitude: toNumber(val[1]) }
  }

  if (typeof val !== 'object') return null

  if (Array.isArray(val.coordinates)) {
    if (val.coordinates.length < 2) return null
    return { longitude: toNumber(val.coordinates[0]), latitude: toNumber(val.coordinates[1]) }
  }

  const latitude = toNumber(val.latitude ?? val.lat)
  const longitude = toNumber(val.longitude ?? val.lng ?? val.lon ?? val.long)
  if (latitude === null && longitude === null) return null
  return { latitude, longitude }
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export const exportTimestamp = () =>
  new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')

function escapeCsv(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') val = JSON.stringify(val)
  const str = '' + val
  return `"${str.replace(/"/g, '""')}"`
}

function buildCsv(rows, headers) {
  const lines = [headers.join(';')]
  for (const row of rows) {
    lines.push(headers.map(h => escapeCsv(row[h])).join(';'))
  }
  return lines.join('\n')
}

function buildHeaders(option) {
  return [
    'cluster_name',
    'plot_name',
    'download_datetime',
    ...(option.indexColumns || []),
    ...option.fields.map(f => f.key)
  ]
}

// Follows option.path inside one record's properties. Returns one entry per
// target container, carrying the 1-based indices of the array segments
// traversed on the way.
function resolveContainers(props, path) {
  let level = [{ value: props, indices: [] }]

  for (const segment of path) {
    const next = []
    for (const entry of level) {
      const value = entry.value?.[segment]
      if (value === null || value === undefined) continue

      if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item !== null && item !== undefined) {
            next.push({ value: item, indices: [...entry.indices, i + 1] })
          }
        })
      } else if (typeof value === 'object') {
        next.push({ value, indices: entry.indices })
      }
    }
    level = next
  }

  return level
}

function readField(container, field) {
  let value = container
  for (const segment of field.path) {
    if (value === null || value === undefined || typeof value !== 'object') return null
    value = value[segment]
  }

  if (!field.coord) return value ?? null

  const pair = readLatLng(value)
  return pair ? pair[field.coord] ?? null : null
}

// resolveContainers only reports array segments, buildDownloadOptions only
// names the ones we actually print — align them at the deep end.
function indexValues(option, indices) {
  const columns = option.indexColumns || []
  const offset = indices.length - columns.length
  const values = {}
  columns.forEach((column, i) => { values[column] = indices[offset + i] ?? null })
  return values
}

// One row per record for "_plot" and for object nodes, one row per array item
// for sub-tables.
function buildRows(option, records, date) {
  const rows = []

  for (const rec of records) {
    const props = rec.properties || {}
    const base = { cluster_name: rec.cluster_name, plot_name: rec.plot_name, download_datetime: date }

    if (option.key === '_plot') {
      const row = { ...base }
      for (const f of option.fields) row[f.key] = readField(props, f)
      rows.push(row)
      continue
    }

    for (const { value, indices } of resolveContainers(props, option.path)) {
      const row = { ...base, ...indexValues(option, indices) }
      for (const f of option.fields) row[f.key] = readField(value, f)
      rows.push(row)
    }
  }

  return rows
}

// Dots separate schema levels; filenames keep them apart with a double
// underscore so "edges.edges" cannot collide with a field called edges_edges.
function fileNameFor(option) {
  return option.key.replace(/\./g, '__')
}

// ── Metadata ────────────────────────────────────────────────────────────────
// Bookkeeping columns of a records row plus the derived Eckenstatus.
// workflow_code only exists on view_records_details; that view carries
// security_invoker = true, so RLS filters it exactly like records itself.
export const METADATA_SOURCE = 'view_records_details'

export const METADATA_COLUMNS = [
  'id',
  'cluster_name',
  'plot_name',
  'created_at',
  'updated_at',
  'schema_name',
  'is_valid',
  'is_plausible',
  'validated_at',
  'is_training',
  // Heisst in der Datenbank und im PowerSync-Schema der App so; die Migration
  // 20250115140818_public.sql fuehrt sie als is_to_be_recorded_by_troop und
  // weicht damit vom Deployment ab.
  'is_to_be_recorded',
  'completed_at_troop',
  'completed_at_state',
  'completed_at_administration',
  'workflow_code'
]

// Columns actually present in the deployed view. Repo migrations and
// deployment have drifted apart before (is_to_be_recorded), and a single
// missing bookkeeping column must not cost the whole archive — so probe once
// with an empty page and drop whatever PostgREST rejects.
let metadataColumnsPromise = null

export function resolveMetadataColumns(supabase) {
  if (!metadataColumnsPromise) {
    metadataColumnsPromise = probeMetadataColumns(supabase).catch(err => {
      metadataColumnsPromise = null
      throw err
    })
  }
  return metadataColumnsPromise
}

// PostgREST reports one missing column per request, hence the loop.
async function probeMetadataColumns(supabase) {
  let columns = [...METADATA_COLUMNS]

  for (let attempt = 0; attempt < METADATA_COLUMNS.length; attempt++) {
    const { error } = await supabase
      .from(METADATA_SOURCE)
      .select(columns.join(', '))
      .limit(1)

    if (!error) return columns

    const missing = missingColumnFrom(error, columns)
    if (!missing) throw error

    console.warn(`${METADATA_SOURCE}.${missing} does not exist — omitted from metadata.csv`)
    columns = columns.filter(c => c !== missing)
  }

  throw new Error(`${METADATA_SOURCE}: no usable metadata columns`)
}

function missingColumnFrom(error, columns) {
  if (error?.code !== '42703') return null

  const text = `${error.message || ''} ${error.details || ''}`
  const name = text.match(/column\s+(?:[\w.]+\.)?"?(\w+)"?\s+does not exist/i)?.[1]

  // id anchors the join to the records row; without it the file is pointless.
  return name && name !== 'id' && columns.includes(name) ? name : null
}

// Codes → Bezeichnungen from lookup.lookup_workflow_status. The table lives in
// the lookup schema only, so it needs .schema('lookup') — same call as the
// Ecken list makes. A failure here costs the label column, not the export.
export async function fetchWorkflowStatusNames(supabase) {
  const { data, error } = await supabase
    .schema('lookup')
    .from('lookup_workflow_status')
    .select('code, name_de')

  if (error) {
    console.warn('lookup_workflow_status unavailable, exporting codes only:', error.message || error)
    return {}
  }

  return Object.fromEntries((data || []).map(row => [row.code, row.name_de]))
}

function buildMetadataCsv(rows, date, statusNames = {}, columns = METADATA_COLUMNS) {
  const headers = [...columns, 'workflow_status', 'download_datetime']

  const mapped = (rows || []).map(row => ({
    ...row,
    workflow_status: row.workflow_code === null || row.workflow_code === undefined
      ? null
      : statusNames[row.workflow_code] ?? null,
    download_datetime: date
  }))

  return buildCsv(mapped, headers)
}

// ── ZIP ─────────────────────────────────────────────────────────────────────
export async function buildRecordsZip(records, options, date = exportTimestamp(), extras = {}) {
  const zip = new JSZip()
  const bom = '﻿' // BOM for Excel compatibility

  for (const option of options) {
    const rows = buildRows(option, records, date)
    const csv = buildCsv(rows, buildHeaders(option))
    zip.file(`${fileNameFor(option)}_${date}.csv`, bom + csv)
  }

  if (extras.metadata) {
    const csv = buildMetadataCsv(extras.metadata, date, extras.workflowStatusNames, extras.metadataColumns)
    zip.file(`metadata_${date}.csv`, bom + csv)
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export function downloadBlob(blob, filename) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

// ── Records ─────────────────────────────────────────────────────────────────
export const EXPORT_RECORD_COLUMNS = 'cluster_name, plot_name, properties'

// Rows for a set of plot_ids — batched, because the `in` filter goes into the
// URL. Used for both records and view_records_details.
async function fetchByPlotIds(supabase, table, columns, plotIds, batchSize) {
  const ids = [...new Set((plotIds || []).filter(id => id !== null && id !== undefined && id !== ''))]
  const rows = []

  for (let i = 0; i < ids.length; i += batchSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in('plot_id', ids.slice(i, i + batchSize))

    if (error) throw error
    rows.push(...(data || []))
  }

  return rows
}

export async function fetchRecordsByPlotIds(supabase, plotIds, { batchSize = 100 } = {}) {
  return fetchByPlotIds(supabase, 'records', EXPORT_RECORD_COLUMNS, plotIds, batchSize)
}

export async function fetchMetadataByPlotIds(supabase, plotIds, { batchSize = 100 } = {}) {
  const columns = await resolveMetadataColumns(supabase)
  const rows = await fetchByPlotIds(supabase, METADATA_SOURCE, columns.join(', '), plotIds, batchSize)
  return { rows, columns }
}
