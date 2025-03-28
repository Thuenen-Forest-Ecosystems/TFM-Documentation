import { defineConfig } from 'vitepress'

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
      { text: 'Login', link: '/dashboard/login' },
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
            { text: 'By Location', link: '/inventory_archive' },
            { text: 'Aggregation', link: '/inventory_aggregation' },
            { text: 'Loop for bigger datasets', link: '/inventory_loop' }

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
          ]
        },
        {
          text: 'Internal',
          items: [
            { text: 'Derived', link: '/dashboard/derived' },
            { text: 'Query Example', link: '/dashboard/authenticated' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Thuenen-Forest-Ecosystems/TFM-Server' }
    ],
    footer: {
      message: 'Service of the <b>Thünen Institute</b>',
      copyright: '<a href="https://www.thuenen.de/en/legal-notice-and-data-privacy">Legal notice</a>  <a href="https://www.thuenen.de/en/data-protection-statement">Data Protection Statement</a>'
    }
  },
  base: '/TFM-Documentation/'
})
