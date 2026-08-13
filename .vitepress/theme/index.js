import { h, watch, ref } from 'vue';
import { useData } from 'vitepress';
import { isDark } from './composables/useGlobalTheme';

import DashboardButton from '../../components/DashboardButton.vue';
import OrganizationButton from '../../components/organizations/OrganizationButton.vue';

import DefaultTheme from 'vitepress/theme';

import './custom.css';

// Server configuration — set via .env / .env.local (see .env.example),
// falls back to the remote production server.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ci.thuenen.de';
const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ1NzkxMjAwLCJleHAiOjE5MDM1NTc2MDB9.hXiYlA_168hHZ6fk3zPgABQUpEcqkYRMzu0A5W5PtYU';
const redirectTo = import.meta.env.VITE_REDIRECT_TO || 'https://thuenen-forest-ecosystems.github.io/TFM-Documentation';
const syncUrl = import.meta.env.VITE_SYNC_URL || `${url}/sync`;

// Create Supabase client - single instance to avoid multiple client warnings
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

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

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
});

// Create a shared reactive isDark ref
const globalIsDark = ref(false);

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  ignoreDeadLinks: [
    '/README.md'  // Ignore dead links in README.md
  ],
  Layout: () => {
    // Get VitePress theme data
    const { isDark: vitePressDark } = useData();

    // Watch for theme changes and update Vuetify and global isDark
    watch(
      () => vitePressDark.value,
      (newIsDark) => {
        isDark.value = newIsDark; // Update our composable's isDark value
        vuetify.theme.change(newIsDark ? 'dark' : 'light');
      },
      { immediate: true }
    );

    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    });
  },
  enhanceApp({ app, router, siteData }) {

    app.use(vuetify);

    // Provide the single Supabase instance globally to prevent multiple client warnings
    // Always provide supabase (either real or mock) to prevent undefined errors
    app.provide('supabase', supabase);
    app.config.globalProperties.$supabase = supabase;

    app.provide('globalIsDark', globalIsDark);
    app.component('DashboardButton', DashboardButton);
    app.component('OrganizationButton', OrganizationButton);

    app.config.globalProperties.$apikey = apikey;
    app.config.globalProperties.$url = url;
    app.config.globalProperties.$syncUrl = syncUrl;
    app.config.globalProperties.$redirectTo = redirectTo;
  },
  setup() {
    // This ensures the theme is correct on initial load
    const { isDark } = useData();
    if (isDark.value) {
      vuetify.theme.change('dark');
    }
    globalIsDark.value = isDark.value;
  }
};
