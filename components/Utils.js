export function getOrganizationDetails(supabase, organization_id) {
    return supabase
        .from('organizations')
        .select('*')
        .eq('id', organization_id)
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching organization details:', error);
                return null;
            }
            return data;
        });
}

export function getClustersAvailable(supabase, organization_id){
    // get parent_organization_id from organization_id
    return supabase
        .from('organizations')
        .select('id, parent_organization_id, is_root')
        .eq('id', organization_id)
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching organization:', error);
                return [];
            }

            // If the organization is a root organization, return all clusters
            if (data.is_root) {
                
                return supabase
                    .schema('inventory_archive')  // Specify the schema
                    .from('cluster')             // Table name (singular if that's correct)
                    .select('*')
                    .then(({ data: clustersData, error: clustersError }) => {
                        if (clustersError) {
                            console.error('Error fetching clusters:', clustersError);
                            return [];
                        }
                        return clustersData;
                    });
            }
            
            // First get cluster permissions
            return supabase
                .from('cluster_permissions')
                .select('*')
                .eq('organization_id', data.id)
                .then(({ data: permissionsData, error: permissionsError }) => {
                    if (permissionsError) {
                        console.error('Error fetching permissions:', permissionsError);
                        return [];
                    }
                    
                    // Then get clusters from inventory_archive schema
                    const clusterIds = permissionsData.map(p => p.cluster_id);
                    if (clusterIds.length === 0) return [];
                    
                    return supabase
                        .schema('inventory_archive')  // Specify the schema
                        .from('cluster')             // Table name (singular if that's correct)
                        .select('*')
                        .in('id', clusterIds)
                        .then(({ data: clustersData, error: clustersError }) => {
                            if (clustersError) {
                                console.error('Error fetching clusters:', clustersError);
                                return [];
                            }
                            
                            // Combine the data if needed
                            return clustersData;
                        });
                });
        });
}