<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import JSZip from 'jszip'

const instance = getCurrentInstance()
const supabase = instance.appContext.config.globalProperties.$supabase

const loading = ref(false)
const error = ref(null)
const recordCount = ref(null)
const totalRecords = ref(null)
const schema = ref(null)
const schemaVersion = ref(null)
const cachedRecords = ref(null)  // populated on first download, reused afterwards
const downloadSucceeded = ref(false)  // reveals all buttons after first download
const organizationId = ref(null)  // set from ?organization= URL param

// ── 1. Fetch newest schema ──────────────────────────────────────────────────
const fetchSchema = async () => {
  const { data, error: err } = await supabase
    .from('schemas')
    .select('id, title, version, directory, bucket_schema_file_name')
    .eq('is_visible', true)
    .eq('is_deprecated', false)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (err) {
    console.error('Error fetching schema metadata:', err)
    return
  }

  schemaVersion.value = data

  // Download the full JSON schema from storage
  const versionDir = data.directory || data.title?.toLowerCase().replace(/\s+/g, '')
  const fileName = data.bucket_schema_file_name || 'validation.json'
  const path = `${versionDir}/${fileName}`

  const { data: blob, error: dlErr } = await supabase.storage
    .from('validation')
    .download(path)

  if (dlErr) {
    // fallback: try validation.json directly
    const { data: blob2, error: dlErr2 } = await supabase.storage
      .from('validation')
      .download(`${versionDir}/validation.json`)
    if (dlErr2) {
      console.error('Error downloading schema:', dlErr, dlErr2)
      return
    }
    const txt = await blob2.text()
    schema.value = JSON.parse(txt)
  } else {
    const txt = await blob.text()
    schema.value = JSON.parse(txt)
  }
}

// ── 2. Derive column structure from schema ──────────────────────────────────
// The plot-level schema lives at schema.properties.plot.items (or .plots.items)
const plotSchema = computed(() => {
  if (!schema.value?.properties) return null
  const plots = schema.value.properties.plot || schema.value.properties.plots
  return plots?.items || null
})

// Scalar fields = non-array, non-object → one column each
const scalarFields = computed(() => {
  if (!plotSchema.value?.properties) return []
  return Object.entries(plotSchema.value.properties)
    .filter(([, prop]) => {
      const t = Array.isArray(prop.type) ? prop.type.filter(x => x !== 'null') : [prop.type]
      return !t.includes('array') && !t.includes('object')
    })
    .map(([key, prop]) => ({ key, title: prop.title || key }))
})

// Array sub-tables (tree, deadwood, edges, etc.)
const arrayFields = computed(() => {
  if (!plotSchema.value?.properties) return []
  return Object.entries(plotSchema.value.properties)
    .filter(([, prop]) => {
      const t = Array.isArray(prop.type) ? prop.type.filter(x => x !== 'null') : [prop.type]
      return t.includes('array') && prop.items?.properties
    })
    .map(([key, prop]) => ({
      key,
      title: prop.title || key,
      fields: Object.entries(prop.items.properties)
        .filter(([, p]) => {
          const t2 = Array.isArray(p.type) ? p.type.filter(x => x !== 'null') : [p.type]
          return !t2.includes('array') && !t2.includes('object')
        })
        .map(([k, p]) => ({ key: k, title: p.title || k }))
    }))
})

// All downloadable tables: "plot" (scalar) + each array sub-table
const downloadOptions = computed(() => {
  const opts = []
  if (scalarFields.value.length) {
    opts.push({ key: '_plot', title: 'Eckendaten', fields: scalarFields.value })
  }
  for (const arr of arrayFields.value) {
    if (arr.fields.length) {
      opts.push({ key: arr.key, title: arr.title, fields: arr.fields })
    }
  }
  return opts
})

// ── 3. Fetch records (paginated, RLS-filtered) ─────────────────────────────
const applyOrgFilter = (query) => {
  if (!organizationId.value) return query
  const id = organizationId.value
  return query.or(`responsible_state.eq.${id},responsible_administration.eq.${id},responsible_provider.eq.${id}`)
}

const fetchAllRecords = async (selectColumns) => {
  const pageSize = 1000
  let allData = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error: err } = await applyOrgFilter(
      supabase.from('records').select(selectColumns)
    ).range(from, from + pageSize - 1)

    if (err) throw err
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allData.push(...data)
      from += pageSize
      if (data.length < pageSize) hasMore = false
    }
  }
  return allData
}

// ── 4. Build CSV ────────────────────────────────────────────────────────────
const now = () => new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')

const escapeCsv = (val) => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') val = JSON.stringify(val)
  const str = '' + val
  return `"${str.replace(/"/g, '""')}"`
}

const buildCsv = (rows, headers) => {
  const lines = [headers.join(';')]
  for (const row of rows) {
    lines.push(headers.map(h => escapeCsv(row[h])).join(';'))
  }
  return lines.join('\n')
}

const downloadFile = (csv, filename) => {
  // BOM for Excel compatibility
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

// ── 5. Download handler ─────────────────────────────────────────────────────
const downloadTable = async (option) => {
  loading.value = true
  error.value = null

  try {
    if (!cachedRecords.value) {
      cachedRecords.value = await fetchAllRecords('cluster_name, plot_name, properties')
    }
    const records = cachedRecords.value
    const date = now()
    const rows = buildRows(option, records, date)

    const headers = ['cluster_name', 'plot_name', 'download_datetime', ...option.fields.map(f => f.key)]
    const csv = buildCsv(rows, headers)
    const filename = `${option.key}_${date}.csv`
    downloadFile(csv, filename)
    recordCount.value = rows.length
    downloadSucceeded.value = true

  } catch (e) {
    console.error('Download error:', e)
    error.value = e.message || 'Fehler beim Herunterladen'
  } finally {
    loading.value = false
  }
}

// ── 6. Build rows for one option (shared by single and ZIP download) ─────────
const buildRows = (option, records, date) => {
  const rows = []
  if (option.key === '_plot') {
    for (const rec of records) {
      const props = rec.properties || {}
      const row = { cluster_name: rec.cluster_name, plot_name: rec.plot_name, download_datetime: date }
      for (const f of option.fields) row[f.key] = props[f.key] ?? null
      rows.push(row)
    }
  } else {
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
  }
  return rows
}

// ── 7. Download all tables as ZIP ──────────────────────────────────────────
const downloadZip = async () => {
  loading.value = true
  error.value = null
  try {
    if (!cachedRecords.value) {
      cachedRecords.value = await fetchAllRecords('cluster_name, plot_name, properties')
    }
    const records = cachedRecords.value
    const date = now()
    const zip = new JSZip()
    const bom = '\uFEFF'

    for (const option of downloadOptions.value) {
      const rows = buildRows(option, records, date)
      const headers = ['cluster_name', 'plot_name', 'download_datetime', ...option.fields.map(f => f.key)]
      const csv = buildCsv(rows, headers)
      zip.file(`${option.key}_${date}.csv`, bom + csv)
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `tfm_export_${date}.zip`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    downloadSucceeded.value = true
  } catch (e) {
    console.error('ZIP download error:', e)
    error.value = e.message || 'Fehler beim Erstellen des ZIP-Archivs'
  } finally {
    loading.value = false
  }
}

// ── 0. Fetch total accessible record count ─────────────────────────────────
const fetchTotalCount = async () => {
  const { count, error: err } = await applyOrgFilter(
    supabase.from('records').select('id', { count: 'exact', head: true })
  )
  if (!err) totalRecords.value = count
}

// ── Init ────────────────────────────────────────────────────────────────────
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  organizationId.value = params.get('organization') || null
  fetchSchema()
  fetchTotalCount()
})
</script>

<template>
  <div class="download-section">
    <p v-if="!schema && !loading" style="color: grey;">Schema wird geladen…</p>

    <v-btn
      v-if="downloadOptions.length"
      rounded="xl"
      variant="tonal"
      :color="'primary'"
      :loading="loading"
      :prepend-icon="downloadSucceeded ? 'mdi-folder-zip-outline' : 'mdi-download'"
      @click="downloadZip()"
    >
      {{ downloadSucceeded ? 'ZIP speichern' : totalRecords !== null ? totalRecords.toLocaleString('de-DE') + ' Ecken herunterladen' : 'Ecken herunterladen' }}
    </v-btn>

    <v-chip v-if="error" color="red" class="mt-2" variant="tonal">
      {{ error }}
    </v-chip>
  </div>
</template>

<style scoped>
.download-section {
  margin: 16px 0;
}
.download-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.download-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.field-count {
  font-size: 0.75rem;
  color: grey;
}
.record-count {
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
  margin-bottom: 12px;
}
</style>
