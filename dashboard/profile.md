<script setup>
    import LoginForm from '../components/LoginForm.vue';
    import Credentials from '../components/Credentials.vue';
    import { ref, onMounted, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js';

    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;

    const supabase = createClient(url, apikey);

    const data = ref({});
    const access_token = ref('');
    const jwtPayload = ref({});
    const is_admin = ref(false);
    const state_responsible = ref(null);
    const troop_id = ref(null);
    const state_responsible_name = ref(null);

    function parseJwt (token) {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    };

    async function _getStateResponsibleName(stateCode){
        await supabase.schema('lookup').from('lookup_state').select('name_de, name_en').eq('code', stateCode).single().then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            state_responsible_name.value = data.name_de;
        });
    }

    onMounted(async () => {
        const { data, error } = await supabase.auth.getSession()
        if (data.session) {
            console.log(data.session);
            access_token.value = data.session.access_token;
            jwtPayload.value = parseJwt(data.session.access_token);
            console.log(jwtPayload.value.is_admin);
            is_admin.value = jwtPayload.value.is_admin;
            state_responsible.value = jwtPayload.value.state_responsible;
            troop_id.value = jwtPayload.value.troop_id;
            _getStateResponsibleName(state_responsible.value);
        }
    });

</script>

<LoginForm>

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

## Supervisor

The state you are responsible for:

```txt-vue
{{state_responsible_name || state_responsible}}
```

## Troop

Your are part of the troop with the id:

```txt-vue
{{troop_id}}
```




   
</LoginForm>