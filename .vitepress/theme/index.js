import DefaultTheme from 'vitepress/theme'
import './custom.css'
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
let url = 'https://ci.thuenen.de';
//url = 'http://127.0.0.1:54321';
    

/** @type {import('vitepress').Theme} */
export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.config.globalProperties.$apikey = apikey
        app.config.globalProperties.$url = url;
    }
}