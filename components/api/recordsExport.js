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

function isScalar(prop) {
  const types = Array.isArray(prop.type) ? prop.type.filter(x => x !== 'null') : [prop.type]
  return !types.includes('array') && !types.includes('object')
}

function isTable(prop) {
  const types = Array.isArray(prop.type) ? prop.type.filter(x => x !== 'null') : [prop.type]
  return types.includes('array') && !!prop.items?.properties
}

// All downloadable tables: "plot" (scalar fields) + each array sub-table
export function buildDownloadOptions(schema) {
  const plotSchema = getPlotSchema(schema)
  if (!plotSchema?.properties) return []

  const options = []

  const scalarFields = Object.entries(plotSchema.properties)
    .filter(([, prop]) => isScalar(prop))
    .map(([key, prop]) => ({ key, title: prop.title || key }))

  if (scalarFields.length) {
    options.push({ key: '_plot', title: 'Eckendaten', fields: scalarFields })
  }

  for (const [key, prop] of Object.entries(plotSchema.properties)) {
    if (!isTable(prop)) continue
    const fields = Object.entries(prop.items.properties)
      .filter(([, p]) => isScalar(p))
      .map(([k, p]) => ({ key: k, title: p.title || k }))
    if (fields.length) {
      options.push({ key, title: prop.title || key, fields })
    }
  }

  return options
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
  return ['cluster_name', 'plot_name', 'download_datetime', ...option.fields.map(f => f.key)]
}

// One row per record for "_plot", one row per array item for sub-tables.
function buildRows(option, records, date) {
  const rows = []

  if (option.key === '_plot') {
    for (const rec of records) {
      const props = rec.properties || {}
      const row = { cluster_name: rec.cluster_name, plot_name: rec.plot_name, download_datetime: date }
      for (const f of option.fields) row[f.key] = props[f.key] ?? null
      rows.push(row)
    }
    return rows
  }

  for (const rec of records) {
    const props = rec.properties || {}
    const items = props[option.key]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const row = { cluster_name: rec.cluster_name, plot_name: rec.plot_name, download_datetime: date }
      for (const f of option.fields) row[f.key] = item[f.key] ?? null
      rows.push(row)
    }
  }
  return rows
}

// ── ZIP ─────────────────────────────────────────────────────────────────────
export async function buildRecordsZip(records, options, date = exportTimestamp()) {
  const zip = new JSZip()
  const bom = '\uFEFF' // BOM for Excel compatibility

  for (const option of options) {
    const rows = buildRows(option, records, date)
    const csv = buildCsv(rows, buildHeaders(option))
    zip.file(`${option.key}_${date}.csv`, bom + csv)
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

// Records for a set of plot_ids — batched, because the `in` filter goes into the URL.
export async function fetchRecordsByPlotIds(supabase, plotIds, { batchSize = 100 } = {}) {
  const ids = [...new Set((plotIds || []).filter(id => id !== null && id !== undefined && id !== ''))]
  const records = []

  for (let i = 0; i < ids.length; i += batchSize) {
    const { data, error } = await supabase
      .from('records')
      .select(EXPORT_RECORD_COLUMNS)
      .in('plot_id', ids.slice(i, i + batchSize))

    if (error) throw error
    records.push(...(data || []))
  }

  return records
}
