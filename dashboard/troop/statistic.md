<script setup>
    import TroopDetails from '../../components/organizations/TroopDetails.vue'
    import { useRoute } from 'vitepress'
    const route = useRoute()
    const troopId = route?.params?.troopId ?? ''
</script>

<TroopDetails
    :troop_id="troopId"
/>
