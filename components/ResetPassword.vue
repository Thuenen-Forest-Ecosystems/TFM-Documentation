<script setup>

    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    import { createClient } from '@supabase/supabase-js'
    
    const instance = getCurrentInstance();
    const apikey = instance.appContext.config.globalProperties.$apikey;
    const url = instance.appContext.config.globalProperties.$url;
  
    const _resetPassword = () => {
        // Logic to reset the password
        console.log('Resetting password...');
        const { data, error } = await supabase.auth.updateUser({
            password: new_password
        })
    };
</script>

# Reset Password

Please enter a new password you would like to set.

<template>
    <v-text-field
    hint="Enter your password to access this website"
    label="Password"
    persistent-hint
    type="input"
    ></v-text-field>
    <v-btn @click="_resetPassword" color="primary">
        Reset Password
    </v-btn>
</template>