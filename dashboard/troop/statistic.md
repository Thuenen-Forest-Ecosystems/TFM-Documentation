<script setup>
    import TroopDetails from '../../components/organizations/TroopDetails.vue'
    const route = useRoute()
    const troopId = route.params.troopId
</script>

<TroopDetails
    :troop_id="troopId"
/>
