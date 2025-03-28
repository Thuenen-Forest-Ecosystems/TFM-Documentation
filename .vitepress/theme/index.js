import DefaultTheme from 'vitepress/theme'
import './custom.css'
let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
let url = 'https://ci.thuenen.de';

// Local development
//url = 'http://127.0.0.1:54321';
//apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'; 

/** @type {import('vitepress').Theme} */
export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.config.globalProperties.$apikey = apikey
        app.config.globalProperties.$url = url;
    }
}