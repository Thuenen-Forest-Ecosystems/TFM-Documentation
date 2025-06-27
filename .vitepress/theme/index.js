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
let powersyncUrl = 'https://ci.thuenen.de/sync';

// Local development
if(import.meta.env.DEV) {
 //   url = 'http://127.0.0.1:54321';
 //   apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
 //   redirectTo = 'http://localhost:5173/TFM-Documentation';
 //   powersyncUrl = 'http://127.0.0.1:8181';
}

// Create Supabase client - single instance to avoid multiple client warnings
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, apikey);

// powersync - Initialize only in browser
let db = null;
let supabaseConnector = null;
// powersync - Initialize only in browser
if (typeof window !== 'undefined') {
  console.log('Initializing PowerSync in browser environment');

  const { PowerSyncDatabase } = await import('@powersync/web');
  const { AppSchema } = await import('./powersync-schema');
  const { SupabaseConnector } = await import('./supabase-connector');

  console.log('PowerSyncDatabase');

  db = new PowerSyncDatabase({
    database: { 
      dbFilename: 'bwi.db',
      debugMode: true
    },
    schema: AppSchema,
    websocketOptions: {
      reconnect: true, // Enable automatic reconnection
      debug: true      // Enable debug logs
    }
  });

  console.log('Connecting PowerSync to Supabase', SupabaseConnector);

  supabaseConnector = new SupabaseConnector(
      url,
      apikey,
      powersyncUrl
  );

  db.connect(supabaseConnector).catch(error => {
    console.error('Failed to connect to WebSocket:', error);
  });

  db.init().then(() => {
    db.registerListener({
          statusChanged: (status) => {
              console.log('SyncStatus statusChanged', status);
          }
      });
    }).catch(error => {
      console.error('Failed to initialize PowerSync:', error);
    });
}

/*

// Powersync - Initialize only in browser
let db = null;
let powerSyncPlugin = null;
let powerSyncInitialized = false;

// Create a promise that resolves when PowerSync is initialized
let powerSyncInitPromise = null;

if (typeof window !== 'undefined') {
  // Dynamic imports to avoid SSR issues
  powerSyncInitPromise = Promise.all([
    import('@powersync/web'),
    //import('@powersync/vue'),
    import('./powersync-schema'),
    import('./supabase-connector')
  ]).then(async ([
    { PowerSyncDatabase },
    { createPowerSyncPlugin },
    { AppSchema },
    { SupabaseConnector }
  ]) => {
    db = new PowerSyncDatabase({
      database: { 
        dbFilename: 'bwi.db',
        debugMode: true
      },
      schema: AppSchema
    });
    console.log('Connecting PowerSync to Supabase', SupabaseConnector);
    const supabaseConnector = new SupabaseConnector(
        url,
        apikey,
        powersyncUrl
    );
    
    db.connect(supabaseConnector);
    powerSyncPlugin = createPowerSyncPlugin({database: db});
    
    // Initialize db here, inside the browser check
    await db.init();
    powerSyncInitialized = true;
    console.log('Powersync initialized with Supabase connector', db);

    db.registerListener({
        statusChanged: (status) => {
            console.log('SyncStatus statusChanged', status);
        }
    });
    
    return { db, powerSyncPlugin };
  }).catch(error => {
    console.error('Failed to initialize PowerSync:', error);
    throw error;
  });
}*/

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
      app.provide('supabase', supabase);
      app.config.globalProperties.$supabase = supabase;
      
      // Only use PowerSync on client-side
      /*if (typeof window !== 'undefined' && powerSyncInitPromise) {
        // Wait for PowerSync to be properly initialized before using it
        powerSyncInitPromise.then(({ db: initializedDb, powerSyncPlugin: initializedPlugin }) => {
          if (initializedPlugin && initializedDb) {
            app.use(initializedPlugin);
            app.provide('powerSyncDB', initializedDb);
            console.log('PowerSync plugin successfully added to Vue app');
          }
        }).catch(error => {
          console.error('Failed to initialize PowerSync in Vue app:', error);
        });
      }*/
      
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
  