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
export function workflowFromRecord(record){
    if(!record) return null;
    if(record.responsible_troop){
        const options = {
            title: 'Bearbeitung durch Trupp',
            code: 1,
            isTroop: true,
            responsibleId: record.responsible_troop,
            settable: 'completed_at_troop',
            actions: [
                
            ]
        };
        if(!record.completed_at_troop){
            options.actions.push({
                label: 'Mark as completed',
                value: 'mark_completed',
                disable: (organizationId, troop, user_id) => troop.user_ids ? !troop.user_ids.includes(user_id) : true,
                visible: (record) => record.completed_at_troop ? false : true,
            });
        }

        return options;
    }else if(record.responsible_provider){
        return {
            title: 'Bearbeitung durch Dienstleister',
            code: 2,
            responsibleId: record.responsible_provider
        };
    }else if(record.responsible_state){
        return {
            title: 'Bearbeitung durch Landesinventurleitung',
            code: 0,
            responsibleId: record.responsible_state,
            settable: 'completed_at_state'
        };
    }else if(record.responsible_administration){
        return {
            title: 'Bearbeitung durch Bundesinventurleitung',
            code: 0,
            responsibleId: record.responsible_administration,
            settable: 'completed_at_administration'
        };
    }
    console.log(record);
    
    return {
        title: 'No Workflow defined',
        code: 0
    };
}
export function toDoFromRecord(record){
    if(!record) return null;
    console.log('RECORD:', record);

    if(record.responsible_troop){
        if(!record.completed_at_troop){
            return {
                text: 'Troop: Mark plot as completed'
            };
        }
    }else if(record.responsible_provider){
        
        if(!record.completed_at_provider && record.completed_at_troop){
            return {
                text: 'Mark plot as completed and unassign Troop'
            };
        }else if(!record.completed_at_troop){
            return {
                text: 'Weisen den Plot einem Trupp zu'
            };
        }else{
            return {
                text: 'Warte, bis Trupp die Aufgabe abgeschlossen hat'
            };
        }
    }else if(record.responsible_state){
        if(!record.completed_at_state && record.completed_at_provider){
            return {
                text: 'State: Als abgeschlossen markieren'
            };
        }else if(!record.responsible_provider){
            return {
                text: 'Weisen den Plot einem Dienstleister zu'
            };
        }else {
            return {
                text: 'Warte, bis Provider die Aufgabe abgeschlossen hat'
            };
        }
    }else if(record.responsible_administration){
        if(!record.completed_at_administration && record.completed_at_state){
            return {
                text: 'Administration: Mark plot as completed and unassign State'
            };
        }else if(!record.responsible_state){
            return {
                text: 'Weisen den Plot einer Landesinventurleitung zu'
            };
        }else{
            return {
                text: 'Warte, bis State die Aufgabe abgeschlossen hat'
            };
        }
    }
    return {
        text: 'Nothing to do'
    }
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