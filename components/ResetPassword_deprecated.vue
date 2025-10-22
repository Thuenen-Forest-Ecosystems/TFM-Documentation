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

# Passwort ändern

Bitte geben Sie Ihr neues Passwort ein, das Sie festlegen möchten.

<template>
    <v-text-field
    hint="Geben Sie Ihr Passwort ein, um auf diese Website zuzugreifen"
    label="Passwort"
    persistent-hint
    type="input"
    ></v-text-field>
    <v-btn @click="_resetPassword" color="primary">
        Passwort zurücksetzen
    </v-btn>
</template>