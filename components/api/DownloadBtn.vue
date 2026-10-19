<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import {
  buildDownloadOptions,
  buildRecordsZip,
  downloadBlob,
  exportTimestamp,
  fetchNewestSchema,
  fetchWorkflowStatusNames,
  resolveMetadataColumns,
  EXPORT_RECORD_COLUMNS,
  METADATA_SOURCE
} from './recordsExport'

const instance = getCurrentInstance()
const supabase = instance.appContext.config.globalProperties.$supabase

const loading = ref(false)
const error = ref(null)
const totalRecords = ref(null)
const schema = ref(null)
const schemaVersion = ref(null)
const cachedRecords = ref(null)  // populated on first download, reused afterwards
const cachedMetadata = ref(null)  // records bookkeeping columns for metadata.csv
const cachedMetadataColumns = ref(null)  // resolved against the deployed view
const cachedStatusNames = ref(null)  // workflow_code → Bezeichnung
const downloadSucceeded = ref(false)  // reveals all buttons after first download
const organizationId = ref(null)  // set from ?organization= URL param

// ── 1. Fetch newest schema ──────────────────────────────────────────────────
const fetchSchema = async () => {
  const data = await fetchNewestSchema(supabase)
  if (!data) return

  schemaVersion.value = data
  schema.value = data.schema
}

// ── 2. Derive column structure from schema ──────────────────────────────────
// "plot" (scalar fields) + one sub-table per array field (tree, deadwood, …)
const downloadOptions = computed(() => buildDownloadOptions(schema.value))

// ── 3. Fetch records (paginated, RLS-filtered) ─────────────────────────────
const applyOrgFilter = (query) => {
  if (!organizationId.value) return query
  const id = organizationId.value
  return query.or(`responsible_state.eq.${id},responsible_administration.eq.${id},responsible_provider.eq.${id}`)
}

// Ordered by id: range pagination without a stable sort can skip or repeat
// rows between pages.
const fetchAllRows = async (table, selectColumns, orderColumn = 'id') => {
  const pageSize = 1000
  let allData = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error: err } = await applyOrgFilter(
      supabase.from(table).select(selectColumns)
    ).order(orderColumn).range(from, from + pageSize - 1)

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

// ── 4. Download all tables as ZIP ──────────────────────────────────────────
const downloadZip = async () => {
  loading.value = true
  error.value = null
  try {
    if (!cachedRecords.value) {
      cachedRecords.value = await fetchAllRows('records', EXPORT_RECORD_COLUMNS)
    }
    if (!cachedMetadata.value) {
      cachedMetadataColumns.value = await resolveMetadataColumns(supabase)
      cachedMetadata.value = await fetchAllRows(METADATA_SOURCE, cachedMetadataColumns.value.join(', '))
    }
    if (!cachedStatusNames.value) {
      cachedStatusNames.value = await fetchWorkflowStatusNames(supabase)
    }
    const date = exportTimestamp()
    const blob = await buildRecordsZip(cachedRecords.value, downloadOptions.value, date, {
      metadata: cachedMetadata.value,
      metadataColumns: cachedMetadataColumns.value,
      workflowStatusNames: cachedStatusNames.value
    })
    downloadBlob(blob, `tfm_export_${date}.zip`)
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
