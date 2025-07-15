import { h, watch, ref } from 'vue'
import { useData } from 'vitepress'
import { isDark } from './composables/useGlobalTheme'

import DashboardButton from '../../components/DashboardButton.vue'
import OrganizationButton from '../../components/organizations/OrganizationButton.vue'


import DefaultTheme from 'vitepress/theme'
import './custom.css'

let url = 'https://ci.thuenen.de';
let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU';
let redirectTo = 'https://thuenen-forest-ecosystems.github.io/TFM-Documentation';
let powersyncUrl = 'https://ci.thuenen.de';


// Local development
if(import.meta.env.DEV) {
  //  url = 'http://127.0.0.1:54321';
  //  apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  //  redirectTo = 'http://localhost:5173/TFM-Documentation';
  //  powersyncUrl = 'http://127.0.0.1:8181';
}

// Create Supabase client - single instance to avoid multiple client warnings
// For GitHub Pages deployment, we need to provide a mock during SSR and real client in browser

let supabase = null;

// Create a mock Supabase client for SSR that prevents errors
const createMockSupabase = () => ({
  auth: {
    signInWithPassword: () => Promise.resolve({ user: null, session: null, error: null }),
    signUp: () => Promise.resolve({ data: null, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ data: null, error: null }),
    updateUser: () => Promise.resolve({ data: null, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: null } })
  }
});

if (typeof window !== 'undefined') {
  // Only import and create real Supabase client in the browser
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(url, apikey);
} else {
  // Provide mock Supabase for SSR
  supabase = createMockSupabase();
}


// Only initialize PowerSync in browser with dynamic imports
// For GitHub Pages deployment, completely avoid PowerSync during SSR
const dbState = ref(null);
let db = null;
let powerSyncInitPromise = null;

// Only initialize PowerSync in browser AND after page is fully loaded to avoid SSR issues
if (typeof window !== 'undefined') {
  // Add cleanup for page unload to properly close connections
  window.addEventListener('beforeunload', () => {
    if (db && db.disconnect) {
      db.disconnect();
    }
  });

  // Delay PowerSync initialization to ensure we're fully in browser context
  powerSyncInitPromise = (async () => {
    try {
      console.log('=== Starting initialization ===');
      
      // Add overall timeout for the entire initialization process
      const initTimeout = setTimeout(() => {
        console.error('Initialization timed out after 30 seconds');
      }, 30000);
      
      const [
        { PowerSyncDatabase },
        { createAppSchema },
        { createSupabaseConnector }
      ] = await Promise.race([
        Promise.all([
          import('@powersync/web'),
          import('./powersync-schema'),
          import('./supabase-connector')
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Module import timeout')), 5000))
      ]);
      
      const AppSchema = await Promise.race([
        createAppSchema(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Schema creation timeout')), 5000))
      ]);
      
      const SupabaseConnector = await Promise.race([
        createSupabaseConnector(url, apikey, powersyncUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SupabaseConnector creation timeout')), 5000))
      ]);
      
      // Create database with consistent filename for data persistence
      const dbFilename = `bwi.db`;
      
      // Always create a fresh database instance (PowerSync handles existing DB file internally)
      try {
        db = new PowerSyncDatabase({
          database: { 
            dbFilename: dbFilename, 
            debugMode: true
          },
          schema: AppSchema,
          flags: {
            // Enable all flags that help with stability
            enableMultiTabs: false, // Disable multi-tab support for more predictable behavior
            enableWebWorker: true    // Keep worker enabled by default
          }
        });
      } catch (dbError) {
        console.warn('database creation failed:', dbError.message);
        // Try with more conservative settings
        try {
          db = new PowerSyncDatabase({
            database: { 
              dbFilename: dbFilename, 
              debugMode: true
            },
            schema: AppSchema,
            flags: {
              enableMultiTabs: false,
              enableWebWorker: false
            }
          });
          console.log('Step 4: ✓ PowerSync database created (fallback mode)');
        } catch (fallbackError) {
          console.error('Failed to create PowerSync database even in fallback mode:', fallbackError);
          throw fallbackError;
        }
      }
      
      console.log('Step 5: Creating Supabase connector instance...');
      const supabaseConnector = new SupabaseConnector(
        url,
        apikey,
        powersyncUrl
      );
      console.log('Step 5: ✓ Supabase connector instance created');
      
      console.log('Step 6: Initializing Supabase connector...');
      await Promise.race([
        supabaseConnector.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase connector init timeout')), 10000))
      ]);
      console.log('Step 6: ✓ Supabase connector initialized');
      
      console.log('Step 7: Connecting PowerSync to Supabase...');
      await db.connect(supabaseConnector);
      console.log('Step 7: ✓ PowerSync connected to Supabase');
      
      console.log('Step 8: Initializing PowerSync database (connecting to existing data if available)...');
      await Promise.race([
        db.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database init timeout')), 30000))
      ]);
      console.log('Step 8: ✓ PowerSync database initialized');
      
      // Add a small delay to ensure the database is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the database is in a good state
      try {
        console.log('Step 9: Verifying database connectivity...');
        // Try a simple operation to ensure the database is working
        await db.execute('SELECT 1 as test');
        console.log('Step 9: ✓ Database connectivity verified');
      } catch (verifyError) {
        console.warn('Database verification failed (this might be normal):', verifyError.message);
        // Don't fail the initialization for this - the database might still work fine
      }
      
      dbState.value = db;
      clearTimeout(initTimeout);
      
      return db;
    } catch (error) {
      console.error('=== Initialization failed ===');
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      
      // Clean up failed instance but DO NOT clear the database file
      if (db) {
        try {
          // Only disconnect, don't clear the database file
          if (db.disconnect) {
            await db.disconnect();
            console.log('instance disconnected');
          }
        } catch (cleanupError) {
          console.warn('Error during cleanup:', cleanupError.message);
        }
        db = null;
        dbState.value = null;
      }
      
      return null;
    }
  })();
} else {
  // Provide a resolved promise for SSR that doesn't try to import PowerSync
  powerSyncInitPromise = Promise.resolve(null);
}

// Global functions for manual PowerSync debugging (only in browser)
if (typeof window !== 'undefined') {
  window.triggerPowerSyncInit = () => {
    console.log('Manual PowerSync initialization triggered');
    return powerSyncInitPromise;
  };
  
  // Global function to check PowerSync state
  window.checkPowerSyncState = () => {
    console.log('PowerSync state check:');
    console.log('- db instance:', db);
    console.log('- dbState.value:', dbState.value);
    return {
      db,
      dbState: dbState.value
    };
  };
}

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            primary: '#8bb63a',
            secondary: '#10B981',
            accent: '#8256D0',
            error: '#E74C3C',
            info: '#3498DB',
            warning: '#F39C12',
            success: '#2ECC71'
          }
        },
        dark: {
          dark: true,
          colors: {
            primary: '#8bb63a',
            secondary: '#10B981',
            accent: '#9D7AFF',
            error: '#FF5252',
            info: '#4FC1E9',
            warning: '#FFB74D',
            success: '#5BD778'
          }
        }
      }
    }
})

// Create a shared reactive isDark ref
const globalIsDark = ref(false)

/** @type {import('vitepress').Theme} */
export default {
    extends: DefaultTheme,
    Layout: () => {
      // Get VitePress theme data
      const { isDark: vitePressDark } = useData()
  
      // Watch for theme changes and update Vuetify and global isDark
      watch(
        () => vitePressDark.value,
        (newIsDark) => {
          vuetify.theme.global.name.value = newIsDark ? 'dark' : 'light'
          isDark.value = newIsDark // Update our composable's isDark value
        },
        { immediate: true }
      )
  
      return h(DefaultTheme.Layout, null, {
        // https://vitepress.dev/guide/extending-default-theme#layout-slots
      })
    },
    enhanceApp({ app, router, siteData }) {
      app.use(vuetify)

      // Provide the single Supabase instance globally to prevent multiple client warnings
      // Always provide supabase (either real or mock) to prevent undefined errors
      app.provide('supabase', supabase);
      app.config.globalProperties.$supabase = supabase;

      // Provide reactive database state and initialization promise
      app.provide('db', dbState);
      app.provide('dbPromise', powerSyncInitPromise);
      app.config.globalProperties.$db = dbState;
      app.config.globalProperties.$dbPromise = powerSyncInitPromise;

      app.provide('globalIsDark', globalIsDark);
      app.component('DashboardButton', DashboardButton)
      app.component('OrganizationButton', OrganizationButton)

      app.config.globalProperties.$apikey = apikey
      app.config.globalProperties.$url = url;
      app.config.globalProperties.$redirectTo = redirectTo;
    },
    setup() {
      // This ensures the theme is correct on initial load
      const { isDark } = useData()
      if (isDark.value) {
        vuetify.theme.global.name.value = 'dark'
      }
      globalIsDark.value = isDark.value
    }
  }
