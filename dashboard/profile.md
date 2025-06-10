<script setup>
    import LoginForm from '../components/LoginForm.vue';
    import Credentials from '../components/Credentials.vue';
    import { ref, onMounted, getCurrentInstance } from 'vue';
    import { createClient } from '@supabase/supabase-js';
    import OrganizationsAdmins from '../components/organizations/OrganizationsAdmins.vue';


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

    const isActive = ref(false);

    const user = ref({});
    const users_profile = ref({});
    const organization = ref({});

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
    /// NEU
    const _organizationMembers = ref([]);
    async function _getOrganizationMembers(orgnaization_id){
        if (!orgnaization_id) {
            return;
        }
        await supabase.from('users_profile').select().eq('organization_id', orgnaization_id).then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            _organizationMembers.value = data;
        });
    }

    async function _getOrganizationById(organizationId){

        await supabase.from('organizations').select().eq('id', organizationId).single().then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            organization.value = data;
            _getOrganizationMembers(organizationId);
        });
    }
    async function _getUsersProfile(userId){
        await supabase.from('users_profile').select().eq('id', userId).single().then(({ data, error }) => {
            if (error) {
                console.error(error);
                return;
            }
            users_profile.value = data;
            _getOrganizationById(data.organization_id);
        });
    }

    onMounted(async () => {
        const { data, error } = await supabase.auth.getSession()
        if (data.session) {
            user.value = data.session.user;
            _getUsersProfile(data.session.user.id);
            /*
            console.log(data.session);
            access_token.value = data.session.access_token;
            jwtPayload.value = parseJwt(data.session.access_token);
            console.log(jwtPayload.value.is_admin);
            is_admin.value = jwtPayload.value.is_admin;
            state_responsible.value = jwtPayload.value.state_responsible;
            troop_id.value = jwtPayload.value.troop_id;
            _getStateResponsibleName(state_responsible.value);*/
        }
    });

    const _toChangeEmail = () => {
        window.location.href = './change-email';
    };
    const _toChangePassword = () => {
        window.location.href = './reset-password';
    };

</script>

# Profile

<v-card class="my-4">
    <v-list>
        <v-list-item>
            <template v-slot:prepend>
                <v-avatar >
                    <v-icon>mdi-account</v-icon>
                </v-avatar>
            </template>
            <v-list-item-title>{{user['email']}}</v-list-item-title>
            <v-list-item-subtitle>{{organization['name'] || ''}}</v-list-item-subtitle>

<template v-slot:append>
<v-tooltip text="Organization Admin">
<template v-slot:activator="{ props }">
<v-icon
    v-if="users_profile['is_organization_admin']"
    icon="mdi-shield-crown"
    variant="text"
    v-bind="props"
></v-icon>
</template>
</v-tooltip>
</template>

</v-list-item>
</v-list>
</v-card>


<v-list>
<v-list-subheader>Account</v-list-subheader>

<v-list-item @click="_toChangeEmail">
    <v-list-item-title>E-Mailadresse ändern</v-list-item-title>
    <v-list-item-subtitle></v-list-item-subtitle>
    <template v-slot:append>
        <v-btn
            v-if="users_profile['is_organization_admin']"
            icon="mdi-chevron-right"
            variant="text"
            v-bind="props"
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
            v-bind="props"
        ></v-btn>
    </template>
</v-list-item>
</v-list>

<LoginForm/>