import { defineConfig } from 'vitepress'
import vuetify from 'vite-plugin-vuetify'
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "BWI",
  description: "Documentation for accessing Inventory of Forest Ecosystems",
  lang: 'en',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/bwi_image.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'API', link: '/general-api' },
      { component: 'DashboardButton'},
    ],

    sidebar: {
      '/': [
        {
          items: [
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Data Structure', link: '/data-structure' }
          ]
        },
        {
          text: 'API',
          items: [
            { text: 'General', link: '/general-api' },
            { text: 'Lookup', link: '/lookup' }
          ]
        },
        {
          text: 'Inventory',
          items: [
            { text: 'By Inventory Interval', link: '/inventory_interval' },
            { text: 'By Location', link: '/inventory_archive' },
            { text: 'Aggregation', link: '/inventory_aggregation' },
            { text: 'Loop for bigger datasets', link: '/inventory_loop' },
            { text: 'Map application example', link: '/map_example' }

          ]
        },
        {
          items: [
            { text: 'Migration', link: '/migration' }
          ]
        },
      ],
    
      '/dashboard/': [
        {
          text: 'Dashboard',
          items: [
            { text: 'Profile', link: '/dashboard/profile' },
            { text: 'Download', link: '/dashboard/download' }
          ]
        }/*,
        {
          text: 'Internal',
          items: [
            { text: 'Derived', link: '/dashboard/derived' },
            { text: 'Query Example', link: '/dashboard/authenticated' },
          ]
        }*/
      ],
      '/authentication/': []
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Thuenen-Forest-Ecosystems/TFM-Server' }
    ],
    footer: {
      message: 'Service of the <b>Thünen Institute</b>',
      copyright: '<a href="https://www.thuenen.de/en/legal-notice-and-data-privacy">Legal notice</a>  <a href="https://www.thuenen.de/en/data-protection-statement">Data Protection Statement</a>'
    }
  },
  base: '/TFM-Documentation/',
  vite: {
    plugins: [
      vuetify(),
      wasm(),
      topLevelAwait()
    ],
    worker: {
      format: 'es',
      plugins: () => [wasm(), topLevelAwait()]
    },
    // Prevent Vuetify from optimizing imports by default
    ssr: {
      noExternal: ['vuetify'],
      // Make pattern matching more comprehensive - exclude PowerSync only during SSR
      external: ['@powersync/vue', '@powersync/web', '@powersync/common', '@powersync/*', '@journeyapps/*']
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    optimizeDeps: {
      // Only exclude PowerSync during SSR build, but include in client build
      exclude: ['@powersync/web', '@powersync/vue'],
      include: []
    },
    assetsInclude: ['**/*.wgsl', '**/*.wasm'],
    build: {
      // Don't mark PowerSync as external for client build - we need it bundled for GitHub Pages
      rollupOptions: {
        external: [],
      }
    },
    // Special handling for PowerSync workers and WASM files
    server: {
      fs: {
        allow: ['..']
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    },
    define: {
      // Ensure proper environment for PowerSync
      global: 'globalThis',
    }
  }
})
