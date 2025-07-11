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

// Track if PowerSync is already initialized to prevent multiple connections
let isInitializing = false;
let isInitialized = false;

// Only initialize PowerSync in browser AND after page is fully loaded to avoid SSR issues
if (typeof window !== 'undefined') {
  // Add cleanup for page unload to properly close connections
  window.addEventListener('beforeunload', () => {
    if (db && db.disconnectAndClear) {
      console.log('Cleaning up PowerSync connection before page unload');
      db.disconnectAndClear();
    }
  });

  // Delay PowerSync initialization to ensure we're fully in browser context
  powerSyncInitPromise = new Promise((resolve) => {
    // Check if already initializing or initialized
    if (isInitializing || isInitialized) {
      console.log('PowerSync already initializing or initialized, returning existing instance');
      resolve(db);
      return;
    }
    
    isInitializing = true;
    
    setTimeout(async () => {
      try {
        console.log('=== Starting PowerSync initialization ===');
        console.log('Environment:', import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION');
        console.log('Supabase URL:', url);
        console.log('PowerSync URL:', powersyncUrl);
        
        // Add overall timeout for the entire initialization process
        const initTimeout = setTimeout(() => {
          console.error('PowerSync initialization timed out after 30 seconds - possibly too many connections');
          isInitializing = false;
          resolve(null);
        }, 30000);
        
        console.log('Step 1: Importing PowerSync modules...');
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
        console.log('Step 1: ✓ PowerSync modules imported successfully');
        
        console.log('Step 2: Creating schema...');
        const AppSchema = await Promise.race([
          createAppSchema(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Schema creation timeout')), 5000))
        ]);
        console.log('Step 2: ✓ Schema created successfully');
        
        console.log('Step 3: Creating SupabaseConnector class...');
        const SupabaseConnector = await Promise.race([
          createSupabaseConnector(url, apikey, powersyncUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error('SupabaseConnector creation timeout')), 5000))
        ]);
        console.log('Step 3: ✓ SupabaseConnector class created successfully');
        
        console.log('Step 4: Creating PowerSync database instance...');
        // Create database with a unique filename to avoid conflicts
        const dbFilename = `bwi_${Date.now()}.db`;
        
        // Try to create PowerSync database with worker fallback
        try {
          db = new PowerSyncDatabase({
            database: { dbFilename: dbFilename, debugMode: true },
            schema: AppSchema,
            websocketOptions: { 
              reconnect: true, 
              debug: true,
              // Add connection timeout and retry settings
              connectionTimeout: 10000,
              maxRetries: 3
            }
          });
        } catch (workerError) {
          console.warn('Failed to create PowerSync with worker, trying without worker:', workerError);
          // Try alternative configuration without worker if available
          db = new PowerSyncDatabase({
            database: { dbFilename: dbFilename, debugMode: true },
            schema: AppSchema,
            websocketOptions: { 
              reconnect: true, 
              debug: true,
              connectionTimeout: 10000,
              maxRetries: 3
            },
            // Disable worker if causing issues
            flags: {
              enableWebWorker: false
            }
          });
        }
        console.log('Step 4: ✓ PowerSync database instance created with filename:', dbFilename);
        
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
        db.connect(supabaseConnector);
        console.log('Step 7: ✓ PowerSync connected to Supabase');
        
        console.log('Step 8: Initializing PowerSync database (checking connection limits)...');
        await Promise.race([
          db.init(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PowerSync database init timeout - possible connection limit reached')), 20000))
        ]);
        console.log('Step 8: ✓ PowerSync database initialized');
        
        dbState.value = db;
        isInitialized = true;
        isInitializing = false;
        clearTimeout(initTimeout);
        
        console.log('=== PowerSync initialized successfully ===');
        resolve(db);
        return db;
      } catch (error) {
        isInitializing = false;
        console.error('=== PowerSync initialization failed ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        
        // Log connection details for debugging
        console.error('Connection details:');
        console.error('- Supabase URL:', url);
        console.error('- PowerSync URL:', powersyncUrl);
        console.error('- Environment:', import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION');
        
        // Check if it's a connection limit issue
        if (error.message.includes('timeout') || error.message.includes('connection')) {
          console.error('This might be a connection limit issue. Try:');
          console.error('1. Close other browser tabs with this app');
          console.error('2. Wait a few minutes for connections to timeout');
          console.error('3. Clear browser storage: localStorage.clear() and indexedDB databases');
        }
        
        // Test basic connectivity
        try {
          console.log('Testing basic connectivity to PowerSync server...');
          const response = await fetch(powersyncUrl + '/health');
          console.log('Health check response status:', response.status);
        } catch (fetchError) {
          console.error('Health check failed:', fetchError.message);
        }
        
        resolve(null);
      }
    }, 100); // Small delay to ensure we're in browser context
  });
} else {
  // Provide a resolved promise for SSR that doesn't try to import PowerSync
  powerSyncInitPromise = Promise.resolve(null);
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
  