import { ref } from 'vue'

// Create a shared reactive isDark ref
export const isDark = ref(false)

// You can also add theme utility functions here
export function useGlobalTheme() {
  return {
    isDark,
    toggleDark: () => {
      isDark.value = !isDark.value
    }
  }
}