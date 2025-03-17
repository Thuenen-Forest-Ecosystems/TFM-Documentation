<script setup>
    import LoginForm from '../components/LoginForm.vue';
    import Credentials from '../components/Credentials.vue';
    const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0';
    import { ref, onMounted } from 'vue';
    import { createClient } from '@supabase/supabase-js';

    let url = 'https://ci.thuenen.de/';
    //url = 'http://127.0.0.1:54321';
    const supabase = createClient(url, apikey);

    const data = ref({});
    const access_token = ref('');
    const jwtPayload = ref({});
    const is_admin = ref(false);
    const state_responsible = ref(null);
    const troop_id = ref(null);

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    };

    onMounted(async () => {
        const { data, error } = await supabase.auth.getSession()
        if (data) {
            access_token.value = data.session.access_token;
            jwtPayload.value = parseJwt(data.session.access_token);
            console.log(jwtPayload.value.is_admin);
            is_admin.value = jwtPayload.value.is_admin;
            state_responsible.value = jwtPayload.value.state_responsible;
            troop_id.value = jwtPayload.value.troop_id;

        }
    });

</script>
# Profile

This page contains the profile data related to your account.

## Access Token

Your personal access token is required to access the API. It is a long string of characters that you should keep secret. You can use it to access the API from your own scripts or applications. The token changes every time you log in.

```txt-vue
{{access_token}}
```

## Admin

Admins can access, change and delete derived data.

```txt-vue
{{is_admin}}
```

## Troop

Your are part of the troop with the id:

```txt-vue
{{troop_id}}
```

<LoginForm>
   
</LoginForm>