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
    console.log('waitForDb called, checking database state...');
    
    // If database is already ready, return it immediately
    if (dbState?.value) {
      console.log('Database already ready');
      return dbState.value;
    }
    
    // If we have a promise, wait for it
    if (dbPromise) {
      console.log('Database promise found, waiting for initialization...');
      try {
        const result = await dbPromise;
        console.log('Database promise resolved:', result ? 'success' : 'failed');
        return result;
      } catch (error) {
        console.error('Database promise rejected:', error);
        throw error;
      }
    }
    
    // If no promise is available, it might be a timing issue
    // Try to get the promise from global properties as fallback
    console.log('No database promise found in injection, checking for timing issues...');
    
    // Try to trigger initialization manually if available
    if (typeof window !== 'undefined' && window.triggerPowerSyncInit) {
      console.log('Attempting to trigger PowerSync initialization manually');
      try {
        const manualPromise = window.triggerPowerSyncInit();
        if (manualPromise) {
          const result = await manualPromise;
          console.log('Manual PowerSync initialization result:', result ? 'success' : 'failed');
          return result;
        }
      } catch (error) {
        console.error('Manual PowerSync initialization failed:', error);
      }
    }
    
    // Wait a bit and check again - this handles race conditions on page refresh
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if the promise is now available
    const dbPromiseRetry = inject('dbPromise', null);
    if (dbPromiseRetry) {
      console.log('Database promise found on retry, waiting...');
      try {
        const result = await dbPromiseRetry;
        console.log('Database promise resolved on retry:', result ? 'success' : 'failed');
        return result;
      } catch (error) {
        console.error('Database promise rejected on retry:', error);
        throw error;
      }
    }
    
    console.error('Database not available - no promise found');
    throw new Error('Database not available - PowerSync may not be initialized');
  }
  
  return {
    db,
    isDbReady,
    waitForDb
  }
}
