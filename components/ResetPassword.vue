<script setup>

    import { ref, onMounted, getCurrentInstance, useAttrs } from 'vue'
    
    const instance = getCurrentInstance();
    const supabase = instance.appContext.config.globalProperties.$supabase;
  
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