


<script setup>
    import LoginForm from '../components/LoginForm.vue';
    import Credentials from '../components/Credentials.vue';
    import { ref, onMounted, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js';
    import OrganizationsAdmins from '../components/organizations/OrganizationsAdmins.vue';
    import { withBase } from 'vitepress'
    import Firewall from '../components/Firewall.vue';
    import Support from '../components/Support.vue';

    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;

    const data = ref({});
    const access_token = ref('');
    const jwtPayload = ref({});
    const is_admin = ref(false);
    const state_responsible = ref(null);
    const troop_id = ref(null);
    const state_responsible_name = ref(null);

    const isActive = ref(false);

    const user = ref({});
    const users_profile = ref({});
    const organization = ref({});

    const organizationsAccess = ref([]);

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
    async function _getUsersProfile(userId){
        await supabase.from('users_profile').select().eq('id', userId).single().then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            users_profile.value = data;
            //_getOrganizationById(data.organization_id);
        });
    }
    async function _getOrganizations(userId){
        
        await supabase.from('users_permissions').select("*, organizations(*)").eq('user_id', userId).then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            // only if organization is not deleted
            data = data.filter(permission => !permission.organizations.deleted);
            organizationsAccess.value = data;
            console.log('Organizations Access:', organizationsAccess.value);
        });

    }

    onMounted(async () => {
        const { data, error } = await supabase.auth.getSession()
        if (data.session) {
            user.value = data.session.user;
            _getUsersProfile(data.session.user.id);
            _getOrganizations(data.session.user.id);
        }
    });

    const _toChangeEmail = () => {
        window.location.href = './change-email';
    };
    const _toChangePassword = () => {
        window.location.href = './reset-password';
    };
    const _toOrganization = (organization_id) => {
        window.location.href = withBase('/dashboard/organizations?organization=' + organization_id);
    };

</script>
<v-app class="bg-transparent">
<Firewall>

# Profil

<v-card variant="tonal" class="my-4">
    <v-list>
        <v-list-item>
            <template v-slot:prepend>
                <v-avatar >
                    <v-icon>mdi-account</v-icon>
                </v-avatar>
            </template>
            <v-list-item-title>{{user['email']}}</v-list-item-title>
            <v-list-item-subtitle>{{users_profile['id']}}</v-list-item-subtitle>
        </v-list-item>
    </v-list>
    <v-list>
        <v-list-item @click="_toChangeEmail">
            <v-list-item-title>E-Mailadresse ändern</v-list-item-title>
            <v-list-item-subtitle></v-list-item-subtitle>
            <template v-slot:append>
                <v-btn
                    v-if="users_profile['is_organization_admin']"
                    icon="mdi-chevron-right"
                    variant="text"
                ></v-btn>
            </template>
        </v-list-item>
        <v-list-item  @click="_toChangePassword">
            <v-list-item-title>Passwort ändern</v-list-item-title>
            <v-list-item-subtitle></v-list-item-subtitle>
            <template v-slot:append>
                <v-btn
                    v-if="users_profile['is_organization_admin']"
                    icon="mdi-chevron-right"
                    variant="text"
                ></v-btn>
            </template>
        </v-list-item>
    </v-list>
</v-card>

## Inventuren
<v-card variant="tonal" title="Kohlenstoffinventur 2027">
    <v-list>
        <v-list-item v-for="permission in organizationsAccess" :key="permission.id" @click="_toOrganization(permission.organizations.id)">
            <v-list-item-title>{{ permission.organizations.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ permission.organizations.description }}</v-list-item-subtitle>
        </v-list-item>
    </v-list>
</v-card>
<LoginForm/>

<Support/>

</Firewall>
</v-app>