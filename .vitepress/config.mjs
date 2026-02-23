import { defineConfig } from 'vitepress'
import vuetify from 'vite-plugin-vuetify'
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "BWI",
  description: "Documentation for accessing Inventory of Forest Ecosystems",
  lang: 'en',
  head: [
    ['link', { rel: 'icon', href: '/TFM-Documentation/thuenen.png' }],
    ["meta", { "name": "og:image", "content": "/TFM-Documentation/bwi_og_image.png" }]

  ],
  ignoreDeadLinks: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/bwi_image.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Verfahren', link: '/process/documents' },
      { text: 'API', link: '/api/getting-started' },
      { component: 'DashboardButton'},
      //{ component: 'OrganizationButton'}
    ],

    sidebar: {
      '/api': [
        {
          items: [
            { text: 'Getting Started', link: '/api/getting-started' },
            { text: 'Data Structure', link: '/api/data-structure' }
          ]
        },
        {
          text: 'API',
          items: [
            { text: 'General', link: '/api/general-api' },
            { text: 'Lookup', link: '/api/lookup' }
          ]
        },
        {
          text: 'Inventory',
          items: [
            { text: 'By Inventory Interval', link: '/api/inventory_interval' },
            { text: 'By Location', link: '/api/inventory_archive' },
            { text: 'Aggregation', link: '/api/inventory_aggregation' },
            { text: 'Loop for bigger datasets', link: '/api/inventory_loop' },
            { text: 'Map application example', link: '/api/map_example' }

          ]
        },
        {
          items: [
            { text: 'Migration', link: '/api/migration' }
          ]
        },
      ],
      '/process': [
        { text: 'Ducuments & Downloads', link: '/process/documents' },
      ],
    
      '/dashboard/': [
        {
          text: 'Dashboard',
          docFooter: {
            prev: false,
            next: false
          },
          items: [
            { text: 'Profile', link: '/dashboard/profile' },
            { text: 'Statistics', link: '/dashboard/statistics' },
            { text: 'Statistics (example)', link: '/dashboard/statistics/index_deprecated' }
          ]
        },
        /*{
          text: 'Inventory',
          items: [
            //{ text: 'Statistics', link: '/dashboard/inventory/stats' },
            { text: 'Inventory (Download)', link: '/dashboard/inventory/download' }
          ]
        }*/
       /*,
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
      copyright: '<a href="https://www.thuenen.de/en/legal-notice-and-data-privacy">Legal notice</a> . <a href="https://www.thuenen.de/en/data-protection-statement">Data Protection Statement</a> . <a href="https://thuenen-forest-ecosystems.github.io/TFM-Documentation/health-check">Health Check</a>'
    }
  },
  base: '/TFM-Documentation/',
  vite: {
    esbuild: {
      drop: ['console', 'debugger'],
    },
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
      },
      minify: 'esbuild',
      /*terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },*/
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
