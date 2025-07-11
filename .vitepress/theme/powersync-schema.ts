// Avoid static imports - only import PowerSync modules dynamically when needed

export const listOfLookupTables = [
  'lookup_browsing',
  'lookup_cluster_situation',
  'lookup_cluster_status',
  'lookup_dead_wood_type',
  'lookup_decomposition',
  'lookup_edge_status',
  'lookup_edge_type',
  'lookup_elevation_level',
  'lookup_exploration_instruction',
  'lookup_ffh_forest_type',
  'lookup_forest_community',
  'lookup_forest_office',
  'lookup_forest_status',
  'lookup_gnss_quality',
  'lookup_grid_density',
  'lookup_growth_district',
  'lookup_harvesting_method',
  'lookup_land_use',
  'lookup_management_type',
  'lookup_marker_profile',
  'lookup_marker_status',
  'lookup_property_size_class',
  'lookup_property_type',
  'lookup_pruning',
  'lookup_sampling_stratum',
  'lookup_stand_development_phase',
  'lookup_stand_layer',
  'lookup_stand_structure',
  'lookup_state',
  'lookup_stem_breakage',
  'lookup_stem_form',
  'lookup_terrain',
  'lookup_terrain_form',
  'lookup_tree_size_class',
  //'lookup_tree_species',
  'lookup_tree_species_group',
  'lookup_tree_status',
  'lookup_trees_less_4meter_layer',
  'lookup_trees_less_4meter_mirrored',
  'lookup_trees_less_4meter_origin',
  'lookup_usage_type',
  'lookup_natur_schutzgebiet',
  'lookup_vogel_schutzgebiet',
  'lookup_natur_park',
  'lookup_national_park',
  'lookup_ffh',
  'lookup_biosphaere',
  'lookup_biogeographische_region',
  'lookup_basal_area_factor',
  'lookup_biotope',
  'lookup_harvest_restriction',
  'lookup_accessibility'
];

// Create the schema dynamically to avoid static imports
export async function createAppSchema() {
  // Dynamic import to avoid SSR issues
  const { column, Schema, Table } = await import('@powersync/web');

  const lookupTemplate = {
      name_de: column.text,
      name_en: column.text,
      interval: column.text,
      sort: column.integer,
      code: column.text
  };

  const lookupTable = listOfLookupTables.reduce((acc, tableName) => {
      acc[tableName] = new Table(lookupTemplate);
      return acc;
  }, {});

  const records = new Table({
      plot_id: column.text,
      plot_name: column.integer,
      created_at: column.text,
      cluster_id: column.text,
      cluster_name: column.integer,
      responsible_administration: column.text,
      responsible_state: column.text,
      responsible_provider: column.text,
      responsible_troop: column.text,
      is_valid: column.integer,
      schema_id: column.text,
      previous_properties: column.text
  });
  /*const cluster = new Table({
      cluster_name: column.text,
      state_responsible: column.text,
      states_affected: column.text,
      cluster_status: column.text,
      cluster_situation: column.text
  });*/
  const schemas = new Table({
      interval_name: column.text
  });
  const organizations = new Table({
      name: column.text,
      type: column.text
  });
  const troop = new Table({
      name: column.text
  });
  const users_profile = new Table({
      organization_id: column.text
  });
  const organizations_lose = new Table({
      cluster_ids: column.text,
      record_ids: column.text,
      name: column.text
  });

  const AppSchema = new Schema({
      schemas,
      records,
      organizations,
      troop,
      users_profile,
      organizations_lose,
      //cluster,
      ...lookupTable
  });

  return AppSchema;
}

// For TypeScript type inference - we'll need to make this async too
export type Database = any; // Simplified for now, can be improved with conditional types