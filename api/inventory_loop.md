<script setup>
  import { getCurrentInstance } from 'vue'
  const apikey = getCurrentInstance().appContext.config.globalProperties.$apikey;
  const url = getCurrentInstance().appContext.config.globalProperties.$url;
</script>

# Combining API calls to get larger amounts of data

Here we show conceptually how to get a simple list of some clusters and then use this list to fetch all (or at least many) details of the clusters and possibly also their dependend objects (plots, trees, ...) as structured data trees in a loop. This avoids requesting big data sets at once and therefore hitting limits per call.

This concept can also be applied to other sets of objects such as plots with their trees or similar.
## General approach

### Step 1

The first Step is to get a list of objects (in this case clustername from the cluster-table).

The following example calls the API to retrieve a list of clusternames (the clusters with names lower then "10").

::: code-group

```txt-vue{2} [REQUEST]
curl -X GET "{{ url }}/rest/v1/cluster?select=cluster_name&cluster_name=lt.10"  
    -H "Accept-Profile: inventory_archive" 
    -H "apikey: {{ apikey }}"
```

```JSON [RESPONSE]
[{"cluster_name":1}, 
 {"cluster_name":2}, 
 {"cluster_name":3}, 
 {"cluster_name":4}, 
 {"cluster_name":5}, 
 {"cluster_name":6}, 
 {"cluster_name":7}, 
 {"cluster_name":8}, 
 {"cluster_name":9}]
```
:::

### Step 2

In order to get details for the clusters and their dependend objects (plots, trees, ...) as structured data trees we call the API in a loop over this list with a filter set accordingly and using the "select" statement to define which data of the cluster and its dependen objects to be retrieved.

The following example retrieves a quite complete dataset for cluster "8" including its plots, trees, ...

CAVEAT: In bash there might be a need to escape the "!" (changing it to "\\!"), because "!" might interpreted as a special character in bash.

::: code-group
```txt-vue{2} [REQUEST]
curl -X GET "{{ url }}/rest/v1/cluster?cluster_name=eq.8&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))" -H "Accept: application/vnd.pgrst.object+json" -H "Accept-Profile: inventory_archive" -H "apikey: {{ apikey }}"
```
```JSON [RESPONSE]
[{
  "intkey": "-8-",
  "id": "e4719989-b772-42e0-bae0-a11afb4d564b",
  "cluster_name": 8,
  "topo_map_sheet": 8627,
  "state_responsible": 9,
  "states_affected": [9],
  "grid_density": 8,
  "cluster_status": null,
  "cluster_situation": 1,
  "inspire_grid_cell": "1kmN2690E4343",
  "plot": [{
    "id": "2577ca7f-c465-4f11-b89e-6e3119e90cf7",
    "ffh": 52,
    "tree": [{
      "id": "1191f7f4-f41a-440f-ae49-77b5a1ac728a",
      "dbh": 491,
      "intkey": "-8-1-1-",
      "azimuth": 252,
      "plot_id": "2577ca7f-c465-4f11-b89e-6e3119e90cf7",
      "pruning": 0,
      "distance": 223,
      "tree_age": 129,
      "cave_tree": false,
      "stem_form": 2,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": 31,
      "tree_height": 146,
      "tree_marked": false,
      "tree_number": 1,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 140,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": 185,
      "tree_height_distance": 1532
    }],
    "coast": false,
    "edges": [],
    "sandy": null,
    "intkey": "-8-1-",
    "biotope": 900,
    "deadwood": [],
    "histwald": null,
    "plot_name": 1,
    "stand_age": 129,
    "biosphaere": 0,
    "cluster_id": "e4719989-b772-42e0-bae0-a11afb4d564b",
    "natur_park": 0,
    "usage_type": 10,
    "cluster_name": 8,
    "regeneration": [{
      "id": "8ae96a88-15b3-4aea-9021-c4bac60e9288",
      "intkey": "-8-1-100-0-1-1-0-0-2001-",
      "plot_id": "2577ca7f-c465-4f11-b89e-6e3119e90cf7",
      "browsing": 0,
      "tree_count": 1,
      "damage_peel": 0,
      "tree_species": 100,
      "tree_size_class": 1,
      "protection_individual": false
    }],
    "terrain_form": 32,
    "accessibility": 1,
    "federal_state": 9,
    "forest_office": 9762,
    "forest_status": 5,
    "marker_status": 1,
    "national_park": 0,
    "property_type": 40,
    "terrain_slope": null,
    "land_use_after": null,
    "marker_azimuth": 0,
    "marker_profile": 30,
    "structure_lt4m": [],
    "elevation_level": 5,
    "ffh_forest_type": 0,
    "growth_district": 8204,
    "land_use_before": null,
    "management_type": 1,
    "marker_distance": 0,
    "stand_structure": 1,
    "forest_community": 31,
    "sampling_stratum": 908,
    "terrain_exposure": 90,
    "harvesting_method": 4,
    "fence_regeneration": false,
    "natur_schutzgebiet": 1,
    "vogel_schutzgebiet": 337,
    "harvest_restriction": 3,
    "property_size_class": 6,
    "protected_landscape": true,
    "ffh_forest_type_field": 9140,
    "forest_community_field": 9,
    "biogeographische_region": 3,
    "stand_development_phase": 3,
    "trees_less_4meter_layer": null,
    "stand_layer_regeneration": 4,
    "trees_less_4meter_coverage": null,
    "harvest_restriction_wetness": true,
    "harvest_restriction_low_yield": false,
    "harvest_restriction_scattered": false,
    "trees_greater_4meter_mirrored": 0,
    "harvest_restriction_fragmented": false,
    "harvest_restriction_nature_reserve": false,
    "harvest_restriction_protection_forest": false,
    "trees_greater_4meter_basal_area_factor": 1,
    "harvest_restriction_insufficient_access": true,
    "harvest_restriction_other_internalcause": false,
    "harvest_restriction_recreational_forest": false,
    "harvest_restriction_private_conservation": false
  }, {
    "id": "99cc624f-f845-4045-8928-6d4433158981",
    "ffh": 52,
    "tree": [],
    "coast": false,
    "edges": [],
    "sandy": null,
    "intkey": "-8-2-",
    "biotope": null,
    "deadwood": [],
    "histwald": null,
    "plot_name": 2,
    "stand_age": null,
    "biosphaere": 0,
    "cluster_id": "e4719989-b772-42e0-bae0-a11afb4d564b",
    "natur_park": 0,
    "usage_type": null,
    "cluster_name": 8,
    "regeneration": [],
    "terrain_form": null,
    "accessibility": 5,
    "federal_state": 9,
    "forest_office": 9762,
    "forest_status": 5,
    "marker_status": null,
    "national_park": 0,
    "property_type": 40,
    "terrain_slope": null,
    "land_use_after": null,
    "marker_azimuth": 0,
    "marker_profile": null,
    "structure_lt4m": [],
    "elevation_level": 5,
    "ffh_forest_type": 1,
    "growth_district": 8204,
    "land_use_before": null,
    "management_type": null,
    "marker_distance": 0,
    "stand_structure": null,
    "forest_community": 31,
    "sampling_stratum": 908,
    "terrain_exposure": null,
    "harvesting_method": null,
    "fence_regeneration": null,
    "natur_schutzgebiet": 1,
    "vogel_schutzgebiet": 337,
    "harvest_restriction": null,
    "property_size_class": 6,
    "protected_landscape": true,
    "ffh_forest_type_field": null,
    "forest_community_field": 31,
    "biogeographische_region": 3,
    "stand_development_phase": null,
    "trees_less_4meter_layer": null,
    "stand_layer_regeneration": null,
    "trees_less_4meter_coverage": null,
    "harvest_restriction_wetness": null,
    "harvest_restriction_low_yield": null,
    "harvest_restriction_scattered": null,
    "trees_greater_4meter_mirrored": null,
    "harvest_restriction_fragmented": null,
    "harvest_restriction_nature_reserve": null,
    "harvest_restriction_protection_forest": null,
    "trees_greater_4meter_basal_area_factor": null,
    "harvest_restriction_insufficient_access": null,
    "harvest_restriction_other_internalcause": null,
    "harvest_restriction_recreational_forest": null,
    "harvest_restriction_private_conservation": null
  }, {
    "id": "bb8dae8e-7613-4657-8e4e-9e2ac1c16e2c",
    "ffh": 52,
    "tree": [{
      "id": "a595f26d-3ca1-41d5-82d4-7f5434fee1d4",
      "dbh": 97,
      "intkey": "-8-3-1-",
      "azimuth": 8,
      "plot_id": "bb8dae8e-7613-4657-8e4e-9e2ac1c16e2c",
      "pruning": 0,
      "distance": 208,
      "tree_age": 14,
      "cave_tree": false,
      "stem_form": 1,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": 71,
      "tree_marked": false,
      "tree_number": 1,
      "tree_status": 0,
      "damage_other": true,
      "damage_resin": false,
      "tree_species": 140,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": 220,
      "tree_height_distance": 811
    }],
    "coast": false,
    "edges": [],
    "sandy": null,
    "intkey": "-8-3-",
    "biotope": 900,
    "deadwood": [],
    "histwald": null,
    "plot_name": 3,
    "stand_age": 14,
    "biosphaere": 0,
    "cluster_id": "e4719989-b772-42e0-bae0-a11afb4d564b",
    "natur_park": 0,
    "usage_type": 10,
    "cluster_name": 8,
    "regeneration": [],
    "terrain_form": 32,
    "accessibility": 1,
    "federal_state": 9,
    "forest_office": 9762,
    "forest_status": 5,
    "marker_status": 1,
    "national_park": 0,
    "property_type": 40,
    "terrain_slope": null,
    "land_use_after": 23,
    "marker_azimuth": 0,
    "marker_profile": 30,
    "structure_lt4m": [],
    "elevation_level": 5,
    "ffh_forest_type": 9140,
    "growth_district": 8204,
    "land_use_before": 23,
    "management_type": 1,
    "marker_distance": 0,
    "stand_structure": 1,
    "forest_community": 31,
    "sampling_stratum": 908,
    "terrain_exposure": 120,
    "harvesting_method": 3,
    "fence_regeneration": false,
    "natur_schutzgebiet": 1,
    "vogel_schutzgebiet": 337,
    "harvest_restriction": 0,
    "property_size_class": 6,
    "protected_landscape": true,
    "ffh_forest_type_field": 9140,
    "forest_community_field": 9,
    "biogeographische_region": 3,
    "stand_development_phase": 1,
    "trees_less_4meter_layer": null,
    "stand_layer_regeneration": null,
    "trees_less_4meter_coverage": null,
    "harvest_restriction_wetness": null,
    "harvest_restriction_low_yield": null,
    "harvest_restriction_scattered": null,
    "trees_greater_4meter_mirrored": 0,
    "harvest_restriction_fragmented": null,
    "harvest_restriction_nature_reserve": null,
    "harvest_restriction_protection_forest": null,
    "trees_greater_4meter_basal_area_factor": 1,
    "harvest_restriction_insufficient_access": null,
    "harvest_restriction_other_internalcause": null,
    "harvest_restriction_recreational_forest": null,
    "harvest_restriction_private_conservation": null
  }, {
    "id": "24203a1c-50d3-4d52-a262-c532983a328f",
    "ffh": 52,
    "tree": [{
      "id": "01307a1c-e92e-4b3c-94bc-46356a084da5",
      "dbh": 213,
      "intkey": "-8-4-1-",
      "azimuth": 320,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 271,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 1,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "0b19e7ca-6368-48c4-bfb1-05e19e64eb7a",
      "dbh": 258,
      "intkey": "-8-4-2-",
      "azimuth": 317,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 277,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 110,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 2,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "55d3e6fd-eb70-4564-8a39-73f68f90b21a",
      "dbh": 330,
      "intkey": "-8-4-3-",
      "azimuth": 276,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 279,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 190,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": 133,
      "tree_height": 242,
      "tree_marked": false,
      "tree_number": 3,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": 184,
      "tree_height_distance": 1790
    }, {
      "id": "871d31e8-3b0a-435e-b33d-9c045947335d",
      "dbh": 243,
      "intkey": "-8-4-4-",
      "azimuth": 248,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 460,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 4,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "f7cdd9d3-7dea-4abb-bbf9-95e8fc881733",
      "dbh": 343,
      "intkey": "-8-4-5-",
      "azimuth": 244,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 574,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 180,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 5,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "1383d511-f3e3-43c9-b699-c1277ec960f5",
      "dbh": 348,
      "intkey": "-8-4-6-",
      "azimuth": 240,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 583,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 210,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 6,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "bdeb95cf-7cc5-403a-88a9-570e034ce8ae",
      "dbh": 403,
      "intkey": "-8-4-7-",
      "azimuth": 242,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 641,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 7,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "eb22ff0a-8b2d-4203-b7ce-694c9c99c98c",
      "dbh": 688,
      "intkey": "-8-4-8-",
      "azimuth": 238,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 877,
      "tree_age": 169,
      "cave_tree": false,
      "stem_form": 1,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": 307,
      "tree_marked": false,
      "tree_number": 8,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 10,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": 194,
      "tree_height_distance": 2343
    }, {
      "id": "87215114-e79e-427e-a195-0141e11e5f78",
      "dbh": 411,
      "intkey": "-8-4-9-",
      "azimuth": 234,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 590,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 9,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "352c2456-1156-4c8f-89e6-0f478f299176",
      "dbh": 375,
      "intkey": "-8-4-10-",
      "azimuth": 134,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 674,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 0,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 10,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }, {
      "id": "aebf240f-a086-43cc-9f4c-5dcd50180301",
      "dbh": 357,
      "intkey": "-8-4-11-",
      "azimuth": 128,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 637,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 1,
      "dbh_height": 130,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": 172,
      "tree_marked": false,
      "tree_number": 11,
      "tree_status": 1,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 100,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": false,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": 140,
      "tree_height_distance": 1653
    }, {
      "id": "6d735b0b-24cb-4fc1-a271-28b9e9bd3bbb",
      "dbh": 400,
      "intkey": "-8-4-12-",
      "azimuth": 267,
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "pruning": 0,
      "distance": 943,
      "tree_age": 79,
      "cave_tree": false,
      "stem_form": 1,
      "dbh_height": 170,
      "bark_pocket": null,
      "damage_dead": null,
      "stand_layer": 1,
      "stem_height": null,
      "tree_height": null,
      "tree_marked": false,
      "tree_number": 12,
      "tree_status": 0,
      "damage_other": false,
      "damage_resin": false,
      "tree_species": 10,
      "within_stand": true,
      "damage_beetle": false,
      "damage_fungus": false,
      "stem_breakage": 0,
      "bark_condition": null,
      "biotope_marked": false,
      "damage_logging": true,
      "crown_dead_wood": null,
      "damage_peel_new": false,
      "damage_peel_old": false,
      "tree_top_drought": false,
      "tree_height_azimuth": null,
      "tree_height_distance": null
    }],
    "coast": false,
    "edges": [],
    "sandy": null,
    "intkey": "-8-4-",
    "biotope": 900,
    "deadwood": [{
      "id": "70172a26-2745-40a1-aad9-64f7470c8d88",
      "count": 1,
      "intkey": "B4PR0009P1SH",
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "bark_pocket": false,
      "diameter_top": 28,
      "decomposition": 1,
      "diameter_butt": 43,
      "length_height": 82,
      "dead_wood_type": 13,
      "tree_species_group": 1
    }],
    "histwald": null,
    "plot_name": 4,
    "stand_age": 83,
    "biosphaere": 0,
    "cluster_id": "e4719989-b772-42e0-bae0-a11afb4d564b",
    "natur_park": 0,
    "usage_type": 10,
    "cluster_name": 8,
    "regeneration": [{
      "id": "313c94a6-9bc6-49e7-9924-9e87eb199633",
      "intkey": "-8-4-100-0-1-1-0-0-2001-",
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "browsing": 0,
      "tree_count": 1,
      "damage_peel": 0,
      "tree_species": 100,
      "tree_size_class": 1,
      "protection_individual": false
    }],
    "terrain_form": 32,
    "accessibility": 1,
    "federal_state": 9,
    "forest_office": 9762,
    "forest_status": 5,
    "marker_status": 1,
    "national_park": 0,
    "property_type": 40,
    "terrain_slope": null,
    "land_use_after": null,
    "marker_azimuth": 0,
    "marker_profile": 30,
    "structure_lt4m": [{
      "id": "c1a3e8c5-d52a-449a-a5e9-d89ec67a019c",
      "intkey": "-8-4-100-10-1-",
      "plot_id": "24203a1c-50d3-4d52-a262-c532983a328f",
      "coverage": 10,
      "tree_species": 100,
      "regeneration_type": 1
    }],
    "elevation_level": 5,
    "ffh_forest_type": 9140,
    "growth_district": 8204,
    "land_use_before": null,
    "management_type": 1,
    "marker_distance": 0,
    "stand_structure": 2,
    "forest_community": 31,
    "sampling_stratum": 908,
    "terrain_exposure": 100,
    "harvesting_method": 3,
    "fence_regeneration": false,
    "natur_schutzgebiet": 1,
    "vogel_schutzgebiet": 337,
    "harvest_restriction": 0,
    "property_size_class": 6,
    "protected_landscape": true,
    "ffh_forest_type_field": 9140,
    "forest_community_field": 9,
    "biogeographische_region": 3,
    "stand_development_phase": 3,
    "trees_less_4meter_layer": null,
    "stand_layer_regeneration": 4,
    "trees_less_4meter_coverage": null,
    "harvest_restriction_wetness": null,
    "harvest_restriction_low_yield": null,
    "harvest_restriction_scattered": null,
    "trees_greater_4meter_mirrored": 0,
    "harvest_restriction_fragmented": null,
    "harvest_restriction_nature_reserve": null,
    "harvest_restriction_protection_forest": null,
    "trees_greater_4meter_basal_area_factor": 1,
    "harvest_restriction_insufficient_access": null,
    "harvest_restriction_other_internalcause": null,
    "harvest_restriction_recreational_forest": null,
    "harvest_restriction_private_conservation": null
  }]
}]
```
:::

By looping over the cluster_name list above we can get data for all clusters in the list.
## Examples in different languages

::: code-group

```html-vue [HTML with Javascript]

<!--
This example shows conceptually how to:
- get a list of clusters and 
- retrieve the json tree of the data belonging to thie clusters in the list
  from different related tables (plots, trees, ...)
In order to make it work as simple as possible it combines the javascript
functionality together with some html to allow it to run simply by opening
the file with a web browser.
-->

<!-- The beginning of html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Details Fetcher</title>
</head>
<body>
    <h1>Details Fetcher</h1>
    <div id="status"></div>
    <pre id="result"></pre>

<!-- Here starts the magic ;) -->
    <script>
        // Define the number of items, endpoints, and any necessary headers
        // Number of clusters to fetch (10 might be enough for the example)
        const samples = 10;
        // API base url
        const base_url = "{{ url }}/rest/v1/";
        // API call for the list of clusters
        const list_endpoint = `${base_url}cluster?select=cluster_name&cluster_name=lt.${samples}`;
        // stub for API call for details  
        const detail_endpoint = `${base_url}cluster?cluster_name=eq.`;
        // headers for Auth and database scheme to use
        const headers = {
            'apikey': '{{apikey}}',
            'Accept-Profile': 'inventory_archive'
        };

        // Helper function to call the first endpoint and get the list of clusters
        async function getList() {
            try {
                const response = await fetch(list_endpoint, { headers });
                if (response.ok) {
                    return await response.json();
                } else {
                    throw new Error(`Failed to retrieve the list of items: ${response.status}`);
                }
            } catch (error) {
                throw new Error(`Request failed: ${error.message}`);
            }
        }

        // Helper function to call the second endpoint and get details for a specific cluster
        async function getDetails(itemId) {
            // Build API request for element of cluster list (including dependend data)
            const url = `${detail_endpoint}${itemId}&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))`;
            try {
                const response = await fetch(url, { headers });
                if (response.ok) {
                    return await response.json();
                } else {
                    throw new Error(`Failed to retrieve details for item: ${itemId}`);
                }
            } catch (error) {
                throw new Error(`Request failed: ${error.message}`);
            }
        }

        (async () => {
            try {
                // Note start time (measuring time just to test performance)
                const start_time = new Date();

                // Get the list of clusters (first call)
                const items_list = await getList();
                // Again just to measure times
                const start_time_details = new Date();
                document.getElementById('status').innerHTML +=
                    `<p>Downloadzeit Traktliste: ${((start_time_details - start_time) / 1000).toFixed(2)} sec.</p>`;

                // Initialize an empty array to store the details for the clusters
                const details_list = [];

                // Iterate over the cluster list and collect details
                for (const item of items_list) {
                    const item_id = item.cluster_name;  // Assuming the ID field is 'cluster_name' in your JSON response from first call
                    const item_details = await getDetails(item_id);
                    // Append the details to the list
                    details_list.push(item_details);
                }

                // Again just to measure times
                const start_time_view = new Date();
                document.getElementById('status').innerHTML +=
                    `<p>Downloadzeit Details: ${((start_time_view - start_time_details) / 1000).toFixed(2)} sec.</p>`;

                // Display the details list as JSON with proper indentation and newlines in the result pre
                document.getElementById('result').textContent = JSON.stringify(details_list, null, 2);

                // Print view generation time
                const end_time = new Date();
                document.getElementById('status').innerHTML +=
                    `<p>View generiert in: ${((end_time - start_time_view) / 1000).toFixed(2)} sec.</p>`;
            } catch (error) {
                document.getElementById('status').innerHTML += `<p>Error: ${error.message}</p>`;
            }
        })();
    </script>
<!-- End of the page-->
</body>
</html>
<!-- Have fun! -->

```

```R-vue [Plain R]
# This example in plain R (best run in RStudio) shows conceptually
# how to:
# - get a list of clusters and 
# - retrieve the json tree of the data belonging to the clusters in
#   the list from different related tables (plots, trees, ...)
# - show the retrieved json tree as expandable view

# Install necessary packages if not already installed
if (!require(httr)) install.packages("httr", dependencies=TRUE)
if (!require(jsonlite)) install.packages("jsonlite", dependencies=TRUE)
if (!require(listviewer)) install.packages("listviewer", dependencies=TRUE)

# Load necessary packages
library(httr)
library(jsonlite)
library(listviewer)

# Define the number of items, endpoints and any necessary headers
# Number of clusters to fetch (10 might be enough for the example)
samples <- 10
# API base url
base_url <- "{{ url }}/rest/v1/"
# API call for the list of clusters
list_endpoint <- paste0("cluster?select=cluster_name&cluster_name=lt.",samples)
# stub for API call for details
detail_endpoint <- "cluster?cluster_name=eq."
# headers for Auth and database scheme to use
headers = c(
  'apikey' = '{{apikey}}',
  'Accept-Profile' = 'inventory_archive'
)

# Here starts the magic...
# Helper function to call the first endpoint and get the list of cluster
get_list <- function() {
  response <- GET(paste0(base_url, list_endpoint), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop("Failed to retrieve the list of items")
  }
}

# Helper function to call the second endpoint and get details for a specific cluster
get_details <- function(item_id) {
  response <- GET(paste0(base_url, detail_endpoint, item_id,"&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))"), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop(paste("Failed to retrieve details for item:", item_id))
  }
}

#MAIN
# Note start time
start_time <- Sys.time()

# Get the list of items
items_list <- get_list()

# measuring times just to test performance
start_time_details <- Sys.time()
print(paste("Downloadzeit Traktliste:",round(start_time_details - start_time, 2),"sec."))

# Initialize an empty list to store the details
details_list <- list()

# Iterate over the clusters list and collect details
for (item in items_list) {
  item_id <- item$cluster_name  # Assuming the ID field is 'id' in your JSON response
  item_details <- get_details(item_id)
  # Append the details to the list
  details_list <- append(details_list, item_details)
}

# measuring times just to test performance
start_time_view <- Sys.time()
print(paste("Downloadzeit Details:", round(start_time_view - start_time_details, 2),"sec."))

# Show the result as expandable view
listviewer::jsonedit(details_list)

# measuring times just to test performance
end_time <- Sys.time()
print(paste("View generiert in:",round(end_time - start_time_view, 2),"sec."))
# Have fun!
```

```R-vue [Shiny R]
# This example of a Shiny R app shows conceptually how to:
# - after pressing a button get a list of clusters,
# - let the users select a number of elements from the list and 
# - after pressing a second button retrieve the json tree of the data
#   belonging to the clusters in the selection from different related
#   tables (plots, trees, ...) and
# - show the retrieved json tree as expandable view.
# It basically converts the plain R example into a "shiny UI".
# Hint: In this example we add a second loop in order to fill the list
#       of clusters stepwise (with the use of the "limit" and "offset"
#       functionality of the API). 
# Caveat:
# - Ensure to have necessary packages installed!

# Load necessary packages
library(shiny)
library(httr)
library(jsonlite)
library(listviewer)

# Define the number of items, endpoints, and any necessary headers
samples <- 1000
limitpercall <- 100
startoffset <- 0
base_url <- "{{ url }}/rest/v1/"
#list_endpoint <- paste0("cluster?select=cluster_name&order=cluster_name&limit=",limitpercall,"&offset=",actualoffset)
detail_endpoint <- "cluster?cluster_name=eq." #1&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))"
headers = c(
  'apikey' = '{{apikey}}',
  'Accept-Profile' = 'inventory_archive'
)
# Initialize an empty list to store the results
all_data <- list()

# Here starts the magic...
# Helper function to construct list endpoint with offset
get_list_endpoint <- function(offset) {
  list_endpoint <- paste0("cluster?select=cluster_name&order=cluster_name&limit=",limitpercall,"&offset=",offset)
  print(list_endpoint)
}

# Helper function to call the first endpoint and get a part of the list of clusters (with offset)
get_list_part <- function(offset) {
  #print(paste0(base_url, get_list_endpoint(offset)))
  response <- GET(paste0(base_url, get_list_endpoint(offset)), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop("Failed to retrieve the list of items")
  }
}

# Helper function to iterate over first endpoint and the list of items filled
get_list <- function() {
  print(startoffset)
  #Loop over the get_list function, increasing the offset each time
  for (offset in seq(startoffset, samples - limitpercall, by = limitpercall)) {
    data <- get_list_part(offset)
    if (!is.null(data)) {
      all_data <- c(all_data, data)
      
      print(paste("Fetched data for offset", offset))
    }
  }
  return(all_data)
}

# Helper function to call the second endpoint and get details for a specific item
get_details <- function(item_id) {
  response <- GET(paste0(base_url, detail_endpoint, item_id, "&select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))"), add_headers(headers))
  if (status_code(response) == 200) {
    return(content(response, as = "parsed", type = "application/json"))
  } else {
    stop(paste("Failed to retrieve details for item:", item_id))
  }
}

# Define UI for application
ui <- fluidPage(
  # Add title panel
  titlePanel("BWI API Data Retrieval"),
  
  # Add sidebar layout
  sidebarLayout(
    # Define sidebar panel
    sidebarPanel(
      # Add action button to trigger the lookup
      actionButton("downloadButton", "Download cluster list (<=20000)"),
      # Add multi-select dropdown for item selection
      uiOutput("itemSelector"),
      # Add action button to trigger the download of selected items
      actionButton("downloadSelectedButton", "Download data for selected clusters"),
      # Add verbatim text output for timing information
      verbatimTextOutput("timingOutput")
    ),
    
    # Define main panel
    mainPanel(
      # Add UIOutput to display downloaded data
      uiOutput("dataDisplay")
    )
  )
)

# Define server logic
server <- function(input, output, session) {
  # Initialize reactiveValues
  RV <- reactiveValues(items_list = NULL, selected_items = NULL)
  
  observeEvent(input$downloadButton, {
    # Note start time
    start_time <- Sys.time()
    
    # Get the list of items
    items_list <- get_list()
    
    start_time_details <- Sys.time()
    print(paste("Downloadzeit Traktliste:", round(start_time_details - start_time, 2), "sec."))
    
    # Store the items list in reactiveValues
    RV$items_list <- items_list
    
    # Update the UI with the dropdown for item selection
    output$itemSelector <- renderUI({
     
        selectInput("itemSelector", "Select clusters", choices = sapply(items_list, function(item) item$cluster_name), multiple = TRUE)
    })
    
    output$timingOutput <- renderText({
      paste("Downloadzeit Traktliste:", round(start_time_details - start_time, 2), "sec.")
    })
  })
  
  observeEvent(input$downloadSelectedButton, {
    # Note start time
    start_time <- Sys.time()
    
    # Get selected items
    selected_items <- input$itemSelector
    
    # Initialize an empty list to store the details
    details_list <- list()
    
    start_time_details <- Sys.time()
    print(paste("Downloadzeit Details:", round(start_time_details - start_time, 2), "sec."))
    
    # Iterate over the selected items and collect details
    for (item_id in selected_items) {
      item_details <- get_details(item_id)
      details_list <- append(details_list, item_details)
    }
    
    start_time_view <- Sys.time()
    print(paste("Downloadzeit Details:", round(start_time_view - start_time_details, 2), "sec."))
    
    output$dataDisplay <- renderUI({
      withProgress(message = 'Viewing data, please wait...', value = 0, {
        for (i in 1:10) {
          incProgress(1/10)
          Sys.sleep(0.01)  # simulate time to view data
        }
        # Show the results as expandable view
        tagList(
          jsonedit(details_list),
          p(paste("View generiert in:", round(Sys.time() - start_time_view, 2), "sec."))
        )
      })
    })
    
    output$timingOutput <- renderText({
      paste("Downloadzeit Details:", round(start_time_view - start_time_details, 2), "sec.")
    })
  })
}

display.mode="showcase"
# Run the application
shinyApp(ui = ui, server = server)
```

```python-vue
import pandas as pd
import requests
import time 

class BearerAuth(requests.auth.AuthBase):
    def __init__(self, token, profile):
        self.token = token
        self.profile = profile
    def __call__(self, r):
        r.headers["apikey"] = self.token
        r.headers["Accept-Profile"] = self.profile
        return r
    
class RequestHandler():
    def __init__(self, baseUrl, token=None, profile=None, endPoint=None):
        self.baseUrl = baseUrl
        self.token = token
        self.profile = profile
        self.set_endpoint(endPoint)
    
    def set_endpoint(self, endPoint):
        self.endPoint = endPoint

    def get_response(self):
        if(not self.set_endpoint):
            return
        self.response = requests.get(self.baseUrl+self.endPoint, auth=BearerAuth(self.token, self.profile))
    
    def check_status(self):
        if(self.response.status_code in [200]):
            self._isAuthorized = True
        else:
            self._isAuthorized = False

    def isAuthorized(self):
        self.check_status()
        return self._isAuthorized

    def return_response_dataFrame(self) -> pd.DataFrame:
        """
        """
        if(self.isAuthorized()):
            return pd.DataFrame.from_records(self.response.json())
        else:
            print("Failed to retrieve data")



start = time.time()
maxSamples=10
baseUrl = "{{ url }}/rest/v1/"
authToken = '{{apikey}}'
acctProfile = 'inventory_archive'
listEndPoint = f'cluster?select=cluster_name&cluster_name=lt.{maxSamples}'
detailEndpoint = "cluster?cluster_name=eq."
requestHand = RequestHandler(baseUrl=baseUrl,
                             token=authToken,
                             profile=acctProfile,
                             endPoint=listEndPoint
                             )

requestHand.get_response()
dfClusterList = requestHand.return_response_dataFrame()

print("Downloadzeit Traktliste: ", time.time() - start)

start = time.time()
for cluster in dfClusterList[dfClusterList.keys()[0]].values:
    requestHand.set_endpoint(f'{detailEndpoint}{cluster}&select=*,plot(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))&plot.interval_name=eq.bwi2022')
    requestHand.get_response()
    try:
        dfDetails = pd.concat([dfDetails, requestHand.return_response_dataFrame()])
    except:
        dfDetails = requestHand.return_response_dataFrame()

dfDetails.reset_index(drop=True, inplace=True)
print("Downlodzeit Details: ", time.time() - start)

dfPlots = pd.concat([pd.DataFrame.from_records(df).assign(key=key) for key, df in dfDetails.loc[:,'plot'].items()], ignore_index=True)
dfTrees = pd.concat([pd.DataFrame.from_records(df).assign(key=key) for key, df in dfPlots.loc[:,'tree'].items()], ignore_index=True)

print(dfDetails)
print(20*'-')
print(dfPlots)
print(20*'-')
print(dfTrees)
```

```VB-vue [VB for Excel]
' This example shows conceptually how to:
' - get a list of clusters from the cluster endpoint as json,
' - retrieve the details of this clusters (as json, no dependend tables,
'   but some more columns) in a loop over the cluster list and
' - insert the retrieved json data in an excel sheet,
' Because Excel worksheets are primarily for flat tables, we do not use
' linked data from other tables (like we do in the other language examples).
' Explanations:
' - XMLHTTP Object: The script creates an XMLHTTP object to perform
'   HTTP requests.
' - Headers: The required headers including the API key and Accept-Profile
'   are set.
' - Fetching Data: The script fetches the list of clusters from the first
'   endpoint and then iterates through each item to fetch detailed data
'   from the endpoint as defined.
' - Parsing JSON: The JsonConverter object is used to parse JSON responses.
'   Make sure you have the JsonConverter module in the VBA project.
'   You can get it from https://github.com/VBA-tools/VBA-JSON.
' - Writing to Excel: The script writes the fetched details to the active worksheet,
'   with each item's details starting on a new row.
' Requirements:
' - JsonConverter Module: You need to import the JsonConverter module into
'   your VBA project.
'   You can download it from hte link above and import
'   it into your VBA project (File > Import File...).
' References:
' - Ensure you have the "Microsoft XML, v6.0" reference enabled in your
'   VBA editor (Tools > References > Check "Microsoft XML, v6.0").
' Caveat:
' This code might not work in all versions of MS Excel (or other MS apps) because
' of "reasons":
' 1. Some MS applications on some platforms or security rules might not allow
'    to execute code like macros at all.
' 2. If code excecution is generally possible, some warnings about "active content"
'    or "macro security" might appear.
' 3. Tested in Windows Excel 2021 only.

' Let's start the magic ;)...
Sub ImportDataIntoExcel()
    ' First, we need some declarations (some maybe actually superfluous here, too lazy to fix that ;))
    Dim Http As Object
    Dim json As Object
    Dim Url As String
    Dim base_url As String
    Dim list_endpoint As String
    Dim detail_endpoint As String
    Dim ws As Worksheet
    Dim Headers As String
    Dim lastRow As Long
    Dim samples As Integer
    Dim item_id As String
    Dim itemDetails As Object
    Dim Item As Object
    Dim row As Long
    Dim StartTime
    ' Now we have to set some parameters
    ' The number of clusters (100 should be enought for the example here)
    samples = 100
    ' Base URL of the API
    base_url = "{{ url }}/rest/v1/"
    ' The endpoint to get the list of clusters (samples defines how many)
    list_endpoint = base_url & "cluster?select=cluster_name&cluster_name=lt." & samples
    ' The endpoint's stub to get details
    detail_endpoint = base_url & "cluster?cluster_name=eq."
    ' We measure times just to get an idea of the performance
    StartTime = Time    ' Return current system time.
    ' Create a new XMLHTTP object
    Set Http = CreateObject("MSXML2.XMLHTTP")
    ' Get the list of clusters
    Http.Open "GET", list_endpoint, False
    Http.SetRequestHeader "Accept-Profile", "inventory_archive"
    Http.SetRequestHeader "apikey", "{{apikey}}"
    Http.Send
    If Http.Status = 200 Then
        ' Use JsonConverter to parse the data response
        Set json = JsonConverter.ParseJson(Http.ResponseText)
        ' Set the worksheet
        Set ws = ThisWorkbook.Sheets(1)
        ' Clear the worksheet
        ws.Cells.Clear
                ' We measure times just to get an idea of the performance
                ListEndTime = Time
                ' Time for fetching cluster list
                ListTime = DateDiff("s", StartTime, ListEndTime)
                ' Write timing info to the worksheet
                ws.Cells(2, 1).Value = "Zeit für Traktliste [sec.]"
                ws.Cells(2, 2).Value = ListTime
                ws.Cells(3, 1).Value = "Hole Details..."
        ' Initialize the row to start writing data to the worksheet
        row = 5
        ' Loop through each cluster and fetch details
        For Each Item In json
            item_id = Item("cluster_name")
            ' Get details for the cluster
            Http.Open "GET", detail_endpoint & item_id & "&select=id,cluster_name,state_responsible,topo_map_sheet,grid_density,cluster_status,cluster_situation", False
            Http.SetRequestHeader "Accept-Profile", "inventory_archive"
            Http.SetRequestHeader "apikey", "{{apikey}}"
            Http.Send
            If Http.Status = 200 Then
                ' Again use the JsonConverter to parse data response
                Set itemDetails = JsonConverter.ParseJson(Http.ResponseText)
                ' Just an index for the columns
                i = 1
                ' write column names to the worksheet (repetition actually superfluous here, too lazy to fix that ;))
                For Each Key In itemDetails(1).Keys
                        ws.Cells(4, i).Value = Key
                        i = i + 1
                    Next Key
                ' Write cluster details to the worksheet
                For Each Item2 In itemDetails
                    i = 1
                    For Each Key In itemDetails(1).Keys
                        ws.Cells(row, i).Value = Item2(Key)
                        i = i + 1
                    Next Key
                Next Item2
            End If
        ' Move to the next row for the next cluster
        row = row + 1
        Next Item
    Else
        MsgBox "Failed to retrieve the list of items: " & Http.Status
    End If
    ' We measure times just to get an idea of the performance
    DetailEndTime = Time
        ' Time for fetching details
        ListTime = DateDiff("s", ListEndTime, DetailEndTime)
        ' Write timing info to the worksheet
        ws.Cells(3, 1).Value = "Zeit für Traktliste [sec.]"
        ws.Cells(3, 2).Value = ListTime
End Sub
' Have fun ;)...
```
:::