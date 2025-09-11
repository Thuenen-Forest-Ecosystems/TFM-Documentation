<template>
    <div ref="chartContainer" :style="{ width: '100%', height: '600px' }"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'

const chartContainer = ref(null)
let chartInstance = null

const props = defineProps({
    treesByIntervalBySpecies: {
        type: Object,
        required: true,
        default: () => ({})
    },
    treeSpecies: {
        type: Object,
        required: false,
        default: () => ({})
    }
})

// Process data for ECharts
const chartData = computed(() => {
    const intervals = Object.keys(props.treesByIntervalBySpecies)
    const speciesSet = new Set()
    
    // Collect all unique species
    intervals.forEach(interval => {
        Object.keys(props.treesByIntervalBySpecies[interval] || {}).forEach(species => {
            speciesSet.add(species)
        })
    })
    
    const species = Array.from(speciesSet).sort((a, b) => Number(a) - Number(b))
    
    // Prepare series data
    const seriesData = species.map(speciesCode => {
        const speciesName = props.treeSpecies[speciesCode] || `Species ${speciesCode}`
        return {
            name: speciesName,
            type: 'bar',
            stack: 'total',
            data: intervals.map(interval => {
                const speciesData = props.treesByIntervalBySpecies[interval]?.[speciesCode]
                return speciesData ? speciesData.length : 0
            })
        }
    })
    
    return {
        intervals,
        species,
        seriesData
    }
})

function drawChart() {
    if (!chartContainer.value) return
    
    if (chartInstance) {
        chartInstance.dispose()
    }
    
    chartInstance = echarts.init(chartContainer.value)
    
    const { intervals, species, seriesData } = chartData.value
    
    const option = {
        title: {
            text: 'Tree Count by Interval and Species',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function (params) {
                let result = `<strong>${params[0].axisValue}</strong><br/>`
                let total = 0
                params.forEach(param => {
                    if (param.value > 0) {
                        const speciesCode = species[param.seriesIndex]
                        const speciesName = props.treeSpecies[speciesCode] || `Species ${speciesCode}`
                        result += `${speciesName}: ${param.value}<br/>`
                        total += param.value
                    }
                })
                result += `<strong>Total: ${total}</strong>`
                return result
            }
        },
        legend: {
            type: 'scroll',
            orient: 'horizontal',
            left: 'center',
            top: 40,
            data: seriesData.map(s => s.name)
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: 80,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: intervals,
            axisLabel: {
                interval: 0,
                rotate: 45
            }
        },
        yAxis: {
            type: 'value',
            name: 'Tree Count',
            nameLocation: 'middle',
            nameGap: 50
        },
        series: seriesData,
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
                start: 0,
                end: 100
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                start: 0,
                end: 100,
                bottom: 10
            }
        ],
        color: [
            '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
            '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#8b5cf6',
            '#06b6d4', '#84cc16', '#eab308', '#f97316', '#ef4444',
            '#ec4899', '#8b5a2b', '#6b7280', '#059669', '#7c3aed'
        ]
    }
    
    chartInstance.setOption(option)
}

function handleResize() {
    if (chartInstance) {
        chartInstance.resize()
    }
}

// Watch for data changes
watch(
    () => props.treesByIntervalBySpecies,
    () => {
        drawChart()
    },
    { deep: true }
)

// Watch for species lookup changes
watch(
    () => props.treeSpecies,
    () => {
        drawChart()
    },
    { deep: true }
)

// Lifecycle
onMounted(() => {
    window.addEventListener('resize', handleResize, { passive: true })
    drawChart()
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (chartInstance) {
        chartInstance.dispose()
        chartInstance = null
    }
})
</script>

<style scoped>
div {
    width: 100%;
    height: 100%;
}
</style>