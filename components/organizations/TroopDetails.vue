<script setup>
const props = defineProps({
	troop_id: {
		type: String,
		default: ''
	}
});
</script>

<template>
	<section class="troop-details">
		<h2>Troop Details</h2>
		<p v-if="props.troop_id">Selected troop: {{ props.troop_id }}</p>
		<p v-else>No troop selected.</p>
	</section>
</template>

<style scoped>
.troop-details {
	padding: 1rem;
}
</style>
