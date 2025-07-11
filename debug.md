# PowerSync Debug Page

<div id="debug-logs" style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; font-family: monospace; white-space: pre-wrap; max-height: 500px; overflow-y: auto;"></div>

<div style="margin: 20px 0;">
  <button id="clear-storage" style="padding: 10px 20px; margin-right: 10px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear All Storage & Reload</button>
  <button id="force-reconnect" style="padding: 10px 20px; background: #44ff44; color: black; border: none; border-radius: 4px; cursor: pointer;">Force Reconnect</button>
</div>

<script setup>
import { ref, onMounted, inject } from 'vue'

const debugLogs = ref([])

onMounted(async () => {
  const debugContainer = document.getElementById('debug-logs')
  
  // Add clear storage functionality
  document.getElementById('clear-storage').addEventListener('click', () => {
    if (confirm('This will clear all local storage and IndexedDB data, then reload the page. Continue?')) {
      // Clear localStorage
      localStorage.clear()
      
      // Clear sessionStorage
      sessionStorage.clear()
      
      // Clear IndexedDB databases
      if ('indexedDB' in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name) {
              const deleteReq = indexedDB.deleteDatabase(db.name)
              deleteReq.onsuccess = () => console.log(`Deleted database: ${db.name}`)
              deleteReq.onerror = () => console.error(`Failed to delete database: ${db.name}`)
            }
          })
        }).catch(err => console.error('Failed to list databases:', err))
      }
      
      // Reload page after short delay
      setTimeout(() => window.location.reload(), 1000)
    }
  })
  
  // Add force reconnect functionality
  document.getElementById('force-reconnect').addEventListener('click', async () => {
    const db = inject('db')
    if (db && db.value) {
      try {
        console.log('Forcing PowerSync reconnection...')
        await db.value.disconnectAndClear()
        window.location.reload()
      } catch (error) {
        console.error('Failed to disconnect:', error)
        window.location.reload()
      }
    } else {
      window.location.reload()
    }
  })
  
  // Override console.log, console.error to capture PowerSync logs
  const originalLog = console.log
  const originalError = console.error
  
  console.log = (...args) => {
    originalLog(...args)
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ')
    debugContainer.textContent += `[LOG] ${new Date().toISOString()}: ${message}\n`
    debugContainer.scrollTop = debugContainer.scrollHeight
  }
  
  console.error = (...args) => {
    originalError(...args)
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ')
    debugContainer.textContent += `[ERROR] ${new Date().toISOString()}: ${message}\n`
    debugContainer.scrollTop = debugContainer.scrollHeight
  }
  
  // Check for existing databases
  if ('indexedDB' in window) {
    try {
      const databases = await indexedDB.databases()
      debugContainer.textContent += `[INFO] ${new Date().toISOString()}: Found ${databases.length} IndexedDB databases\n`
      databases.forEach(db => {
        debugContainer.textContent += `[INFO] ${new Date().toISOString()}: - Database: ${db.name} (version: ${db.version})\n`
      })
    } catch (error) {
      debugContainer.textContent += `[ERROR] ${new Date().toISOString()}: Failed to list databases: ${error.message}\n`
    }
  }
  
  // Try to get the PowerSync promise and wait for it
  const dbPromise = inject('dbPromise')
  if (dbPromise) {
    debugContainer.textContent += `[INFO] ${new Date().toISOString()}: PowerSync promise found, waiting for initialization...\n`
    
    try {
      const result = await dbPromise
      if (result) {
        debugContainer.textContent += `[SUCCESS] ${new Date().toISOString()}: PowerSync initialized successfully!\n`
      } else {
        debugContainer.textContent += `[FAILED] ${new Date().toISOString()}: PowerSync initialization returned null\n`
      }
    } catch (error) {
      debugContainer.textContent += `[ERROR] ${new Date().toISOString()}: PowerSync initialization failed: ${error.message}\n`
    }
  } else {
    debugContainer.textContent += `[ERROR] ${new Date().toISOString()}: No PowerSync promise found\n`
  }
})
</script>
