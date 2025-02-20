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
      { text: 'API', link: '/markdown-examples' }
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
          { text: 'Lookup', link: '/lookup' },
          { text: 'Inventory', link: '/inventory_archive' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation' }
    ]
  },
  base: '/TFM-Documentation/'
})
