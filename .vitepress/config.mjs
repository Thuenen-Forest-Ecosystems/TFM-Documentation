import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "TFM -  Documentation",
  description: "Terrestrial Forest Monitoring of location-based natural data.",
  lang: 'en',
  tmp: 'tmp wwwwww',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'API', link: '/general-api' }
    ],

    sidebar: [
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
          { text: 'Aggregation', link: '/inventory_aggregation' }
        ]
      },
      {
        items: [
          { text: 'Migration', link: '/migration' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Thuenen-Forest-Ecosystems/TFM-Server' }
    ]
  },
  base: '/TFM-Documentation/'
})
