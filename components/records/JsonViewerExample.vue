<script setup>
import { ref } from 'vue';
import JsonViewer from '~/components/records/JsonViewer.vue';

// Example JSON data
const sampleData = ref({
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "plot_name": 42,
    "accessibility": 1,
    "forest_status": 5,
    "trees": [
        {
            "id": "tree-001",
            "species": "oak",
            "diameter": 35.5,
            "height": 28.2,
            "alive": true,
            "measurements": {
                "bark_thickness": 2.1,
                "crown_diameter": 8.5
            }
        },
        {
            "id": "tree-002", 
            "species": "pine",
            "diameter": 28.0,
            "height": 24.1,
            "alive": false,
            "measurements": null
        }
    ],
    "coordinates": {
        "latitude": 52.520008,
        "longitude": 13.404954,
        "elevation": 34
    },
    "metadata": {
        "last_updated": "2024-01-15T10:30:00Z",
        "surveyor": "John Doe",
        "weather": "sunny",
        "tags": ["primary", "accessible", "mature"]
    }
});

// Example JSON Schema that provides meaningful names
const sampleSchema = ref({
    "type": "object",
    "title": "Forest Plot Record",
    "properties": {
        "id": {
            "type": "string",
            "title": "Plot ID",
            "description": "Unique identifier for this forest plot"
        },
        "plot_name": {
            "type": "integer",
            "title": "Plot Number",
            "description": "Sequential plot number in the survey"
        },
        "accessibility": {
            "type": "integer",
            "title": "Accessibility Level",
            "description": "Level of accessibility (1=easy, 2=moderate, 3=difficult)"
        },
        "forest_status": {
            "type": "integer", 
            "title": "Forest Health Status",
            "description": "Overall health rating of the forest plot"
        },
        "trees": {
            "type": "array",
            "title": "Tree Inventory",
            "description": "List of all trees in this plot",
            "items": {
                "type": "object",
                "title": "Individual Tree",
                "properties": {
                    "id": {
                        "type": "string",
                        "title": "Tree ID",
                        "description": "Unique identifier for this tree"
                    },
                    "species": {
                        "type": "string",
                        "title": "Tree Species",
                        "description": "Common name of the tree species"
                    },
                    "diameter": {
                        "type": "number",
                        "title": "Trunk Diameter (cm)",
                        "description": "Diameter at breast height in centimeters"
                    },
                    "height": {
                        "type": "number",
                        "title": "Tree Height (m)",
                        "description": "Total height of the tree in meters"
                    },
                    "alive": {
                        "type": "boolean",
                        "title": "Tree Status",
                        "description": "Whether the tree is alive or dead"
                    },
                    "measurements": {
                        "type": "object",
                        "title": "Additional Measurements",
                        "description": "Extra measurements taken for this tree",
                        "properties": {
                            "bark_thickness": {
                                "type": "number",
                                "title": "Bark Thickness (cm)",
                                "description": "Thickness of bark in centimeters"
                            },
                            "crown_diameter": {
                                "type": "number",
                                "title": "Crown Diameter (m)",
                                "description": "Diameter of the tree crown in meters"
                            }
                        }
                    }
                }
            }
        },
        "coordinates": {
            "type": "object",
            "title": "GPS Coordinates",
            "description": "Geographic location of the plot",
            "properties": {
                "latitude": {
                    "type": "number",
                    "title": "Latitude",
                    "description": "Latitude in decimal degrees"
                },
                "longitude": {
                    "type": "number", 
                    "title": "Longitude",
                    "description": "Longitude in decimal degrees"
                },
                "elevation": {
                    "type": "number",
                    "title": "Elevation (m)",
                    "description": "Elevation above sea level in meters"
                }
            }
        },
        "metadata": {
            "type": "object",
            "title": "Survey Metadata",
            "description": "Additional information about the survey",
            "properties": {
                "last_updated": {
                    "type": "string",
                    "title": "Last Update",
                    "description": "ISO 8601 timestamp of last update"
                },
                "surveyor": {
                    "type": "string",
                    "title": "Surveyor Name",
                    "description": "Name of the person who conducted the survey"
                },
                "weather": {
                    "type": "string",
                    "title": "Weather Conditions",
                    "description": "Weather conditions during the survey"
                },
                "tags": {
                    "type": "array",
                    "title": "Classification Tags",
                    "description": "Tags used to classify this plot",
                    "items": {
                        "type": "string",
                        "title": "Tag",
                        "description": "Individual classification tag"
                    }
                }
            }
        }
    }
});
</script>

<template>
    <div class="pa-4">
        <h2 class="mb-4">JSON Tree Viewer with Schema-Based Labels</h2>
        
        <v-card>
            <v-card-title>
                Forest Plot Data Visualization
            </v-card-title>
            <v-card-text>
                <JsonViewer 
                    :data="sampleData" 
                    :schema="sampleSchema"
                    :max-depth="10"
                />
            </v-card-text>
        </v-card>
        
        <v-card class="mt-6">
            <v-card-title>
                Raw Data (for comparison)
            </v-card-title>
            <v-card-text>
                <pre>{{ JSON.stringify(sampleData, null, 2) }}</pre>
            </v-card-text>
        </v-card>
    </div>
</template>

<style scoped>
pre {
    background: rgba(var(--v-theme-surface-variant), 0.3);
    padding: 16px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
    max-height: 400px;
    overflow-y: auto;
}
</style>
