import DefaultTheme from 'vitepress/theme'
import Full from './Full.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('full', Full)
  }
}