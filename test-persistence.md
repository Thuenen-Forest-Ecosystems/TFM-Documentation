# Database Persistence Test

This page tests PowerSync database persistence across page refreshes.

<div id="test-results" style="background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 8px; font-family: monospace;"></div>

<div style="margin: 20px 0;">
  <button id="create-test-data" style="padding: 10px 20px; margin-right: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Create Test Data</button>
  <button id="read-test-data" style="padding: 10px 20px; margin-right: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Read Test Data</button>
  <button id="refresh-page" style="padding: 10px 20px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">Refresh Page</button>
</div>

<script setup>
import { inject, onMounted } from 'vue'
import { useDatabase } from '../.vitepress/theme/composables/useDatabase'

const { waitForDb } = useDatabase()

onMounted(async () => {
  const resultsContainer = document.getElementById('test-results')
  
  const log = (message) => {
    resultsContainer.textContent += `${new Date().toISOString()}: ${message}\n`
    console.log(message)
  }
  
  log('Persistence test page loaded')
  
  // Create test data
  document.getElementById('create-test-data').addEventListener('click', async () => {
    try {
      log('Creating test data...')
      const db = await waitForDb()
      
      if (!db) {
        log('ERROR: Database not available')
        return
      }
      
      // Create a simple test table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS test_persistence (
          id INTEGER PRIMARY KEY,
          message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // Insert test data
      const testMessage = `Test data created at ${new Date().toISOString()}`
      await db.execute(
        'INSERT INTO test_persistence (message) VALUES (?)',
        [testMessage]
      )
      
      log('✓ Test data created successfully')
      log(`Inserted: ${testMessage}`)
      
    } catch (error) {
      log(`ERROR creating test data: ${error.message}`)
    }
  })
  
  // Read test data
  document.getElementById('read-test-data').addEventListener('click', async () => {
    try {
      log('Reading test data...')
      const db = await waitForDb()
      
      if (!db) {
        log('ERROR: Database not available')
        return
      }
      
      const results = await db.execute('SELECT * FROM test_persistence ORDER BY created_at DESC LIMIT 10')
      
      if (results.length === 0) {
        log('No test data found. Create some first!')
      } else {
        log(`✓ Found ${results.length} test records:`)
        results.forEach((row, index) => {
          log(`  ${index + 1}. ID: ${row.id}, Message: ${row.message}, Created: ${row.created_at}`)
        })
      }
      
    } catch (error) {
      log(`ERROR reading test data: ${error.message}`)
    }
  })
  
  // Refresh page
  document.getElementById('refresh-page').addEventListener('click', () => {
    window.location.reload()
  })
  
  // Auto-check for existing data on page load
  try {
    log('Checking for existing test data...')
    const db = await waitForDb()
    
    if (db) {
      const results = await db.execute('SELECT COUNT(*) as count FROM test_persistence')
      if (results[0] && results[0].count > 0) {
        log(`✓ Found ${results[0].count} existing test records in database`)
        log('Database persistence is working!')
      } else {
        log('No existing test data found')
      }
    }
  } catch (error) {
    if (error.message.includes('no such table')) {
      log('Test table does not exist yet - create some test data first')
    } else {
      log(`ERROR checking existing data: ${error.message}`)
    }
  }
})
</script>
