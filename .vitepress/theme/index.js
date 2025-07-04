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
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, apikey);


// powersync - Initialize only in browser with dynamic imports
const dbState = ref(null);
let db = null;

// Create a promise that resolves when PowerSync is initialized
let powerSyncInitPromise = null;

if (typeof window !== 'undefined') {
  console.log('Initializing PowerSync in browser environment');
  
  // Use dynamic imports to avoid SSR issues and ESM resolution problems
  powerSyncInitPromise = (async () => {
    try {
      const [
        { PowerSyncDatabase },
        { AppSchema },
        { SupabaseConnector }
      ] = await Promise.all([
        import('@powersync/web'),
        import('./powersync-schema'),
        import('./supabase-connector')
      ]);

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

      const supabaseConnector = new SupabaseConnector(
          url,
          apikey,
          powersyncUrl
      );

      await supabaseConnector.init();
      db.connect(supabaseConnector);
      await db.init();
      
      // Update the reactive state
      dbState.value = db;
      
      console.log('PowerSync initialized successfully');
      return db;
      
    } catch (error) {
      console.error('=== sync initialization failed ===', error);
      throw error;
    }
  })();
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
  