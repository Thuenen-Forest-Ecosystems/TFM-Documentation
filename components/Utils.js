import { Tooltip } from "vuetify/directives";

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
export const workflows = [
    {
        id: 0,
        searchText: 'red',
        tooltip: 'Muss an Trupp oder Dienstleister übergeben werden'
    },
    {
        id: 1,
        searchText: 'yellow',
        tooltip: 'Kann an Bundesinventurleitung übergeben werden'
    },
    {
        id: 4,
        searchText: 'yellow',
        tooltip: 'Kann an Landesinventurleitung übergeben werden'
    },
    {
        id: 2,
        //style: { color: 'white', backgroundColor: 'green', padding: '10px', },
        text: 'In Arbeit von Trupp. (2)',
        searchText: 'green',
        tooltip: 'In Arbeit von Trupp. (Keine Maßnahme nötig)',
    },
    {
        id: 5,
        //style: { color: 'white', backgroundColor: 'green', padding: '10px', },
        text: 'In Arbeit von Trupp. (2)',
        searchText: 'green',
        tooltip: 'abgeschlossen',
    },
    {
        id: 6,
        searchText: 'yellow',
        tooltip: 'Kann geprüft werden.'
    },
    {
        id: 3,
        searchText: 'yellow',
        tooltip: 'Kann an Landesinventurleitung übergeben werden'
    }
];
export function stateByOrganizationType(organizationId, organization_type, record){

    if(organization_type === 'country'){
        if(record.responsible_state === organizationId){
            if(!record.responsible_troop || !record.responsible_provider){
                return workflows.find(w => w.id === 0);
            }else if(record.completed_at_troop){
                return workflows.find(w => w.id === 1);
            }else{
                return workflows.find(w => w.id === 2);
            }
        }
    }else if (organization_type === 'provider'){
        if(record.responsible_provider === organizationId){
            if(!record.responsible_troop){
                return workflows.find(w => w.id === 0);
            }else if(record.completed_at_troop){
                return workflows.find(w => w.id === 3);
            }else{
                return workflows.find(w => w.id === 2);
            }
        }
    }else if (organization_type === 'root'){
        if(record.responsible_administration === organizationId){
            if(!record.responsible_state && !record.completed_at_state){
                return workflows.find(w => w.id === 4);
            }else if(!record.responsible_state && record.completed_at_state){
                return workflows.find(w => w.id === 5);
            }else if(record.responsible_state && !record.completed_at_state){
                return workflows.find(w => w.id === 2);
            }else if(record.responsible_state && record.completed_at_state){
                return workflows.find(w => w.id === 6);
            }
        }
    }
    return {
        style: { color: 'black', backgroundColor: 'gray' },
        text: 'Keine Informationen',
    };
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
let troopSave = [];
export async function getTroopById(supabase, troopId) {
    if(!troopId || !supabase) return null;
    if(troopSave[troopId]) {
        return Promise.resolve(troopSave[troopId]);
    }
    return supabase
        .from('troop')
        .select('*')
        .eq('id', troopId)
        .maybeSingle()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching troop:', error);
                return null;
            }
            troopSave[troopId] = data;
            return data;
        });
}
let companySave = [];
export async function getOrganizationById(supabase, organizationId) {
    if(!organizationId || !supabase) return null;
    if(companySave[organizationId]) {
        return Promise.resolve(companySave[organizationId]);
    }
    return supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching organization:', error);
                return null;
            }
            companySave[organizationId] = data;
            return data;
        });
}

export async function apiRecords(supabase, tableName, organizationId, organizationType) {
    if(!supabase || !tableName || !organizationId || !organizationType) {   
        console.warn('Missing parameters for apiRecords:', { supabase, tableName, organizationId, organizationType });
        return [];
    }
    let companyType = null; //'responsible_state'; // responsible_administration
    let filterRow = null; //'provider_los'; 

    switch (organizationType) {
        case 'root':
            companyType = 'responsible_administration';
            filterRow = 'administration_los';
            break;
        case 'country':
            companyType = 'responsible_state';
            filterRow = 'state_los';
            break;
        case 'provider':
            companyType = 'responsible_provider';
            filterRow = 'provider_los';
            break;
    }

    if (!companyType || !filterRow) {
        console.warn('No company type or filter row defined for organization type:', organizationType);
        return [];
    }

    let allData = [];
    let currentPage = 0;
    const pageSize = 10000; // Choose an appropriate page size

    while (true) {
        const start = currentPage * pageSize;
        const end = start + pageSize - 1;

        const { data, error } = await supabase
            .from(tableName)
            .select(`
                cluster_id,
                cluster_name,
                plot_name,
                plot_id,
                responsible_state,
                responsible_provider,
                responsible_administration,
                responsible_troop,
                is_valid,
                administration_los,
                state_los,
                provider_los,
                troop_los,
                federal_state,
                growth_district,
                forest_status_bwi2022,
                forest_status_ci2017,
                forest_status_ci2012,
                accessibility,
                forest_office,
                property_type,
                ffh_forest_type_field,
                center_location
            `)
            .eq(companyType, organizationId)
            //.is(filterRow, null) // Ensure the filterRow is null
            //.is('troop_los', null) // Ensure troop_los is also null
            .range(start, end) // Use range for pagination
            .order('cluster_id', { ascending: true }); // <<-- deterministic order

        if (error) {
            console.error('Error fetching data:', error);
            return null;
        }

        if (data.length === 0) {
            break; // No more data
        }

        allData = allData.concat(data);
        currentPage++;
    }

    return allData;
    
}
/**
 * Get user permissions for a specific organization.
 * @param {*} supabase 
 * @param {*} organizationId 
 * @returns 
 */
export async function getUsersPermissions(supabase, organizationId) {
    if (!supabase || !organizationId) {
        console.warn('Missing parameters for getUsersPermissions:', { supabase, organizationId });
        return [];
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
        console.error('Error fetching session data:', sessionError);
        return [];
    }

    const userId = sessionData?.session?.user?.id;
    if (!userId) {
        console.warn('No user is currently logged in.');
        return [];
    }
    console.log('Fetching permissions for user:', userId, 'in organization:', organizationId);

    const { data, error } = await supabase
        .from('users_permissions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user permissions:', error);
        return [];
    }

    return data;
}