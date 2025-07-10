import { inject, computed } from 'vue'

export function useDatabase() {
  const dbState = inject('db')
  const dbPromise = inject('dbPromise')
  
  // Reactive computed that returns the database when it's ready
  const db = computed(() => dbState?.value)
  
  // Check if database is initialized
  const isDbReady = computed(() => dbState?.value !== null)
  
  // Wait for database to be ready
  const waitForDb = async () => {
    if (dbState?.value) {
      return dbState.value
    }
    
    if (dbPromise) {
      try {
        return await dbPromise
      } catch (error) {
        console.error('Failed to initialize database:', error)
        throw error
      }
    }else{
      console.log('powerSyncDB not ready');
    }
    
    throw new Error('Database not available')
  }
  
  return {
    db,
    isDbReady,
    waitForDb
  }
}
