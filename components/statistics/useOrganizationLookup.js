import { ref } from 'vue';

/**
 * Fetches organization items (if the user is an admin) and troop items (where the user is a member).
 * Completely decoupled from the organizations table for troop queries.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<{ orgItems: Array, troopItems: Array, organisationsList: Array }>}
 */
export async function getOrganizationsAndTroops(supabase, userId) {
  if (!supabase || !userId) {
    return { orgItems: [], troopItems: [], organisationsList: [] };
  }

  let orgItems = [];
  let troopItems = [];

  // 1. Fetch organization admin permissions (only for admins to select whole organizations)
  const { data: permData, error: permError } = await supabase
    .from('users_permissions')
    .select("*, organizations(*)")
    .eq('user_id', userId)
    .eq('is_organization_admin', true);

  if (permError) {
    console.error("Org Admin Permissions Fetch Error:", permError);
  } else if (permData) {
    orgItems = permData
      .filter(p => p.organizations && !p.organizations.deleted)
      .map(item => ({
        id: item.organizations.id,
        name: item.organizations.name,
        type: 'org',
        typeLabel: 'Organisation',
        icon: 'mdi-domain',
        color: 'primary'
      }));
  }

  // 2. Fetch troops: Pure troop query, completely decoupled from organizations
  const { data: troopData, error: troopError } = await supabase
    .from('troop')
    .select('id, name, deleted, is_control_troop, user_ids')
    .contains('user_ids', [userId])
    .order('name');

  if (troopError) {
    console.error("Troop Fetch Error:", troopError);
  } else if (troopData) {
    troopItems = troopData
      .filter(t => !t.deleted && Array.isArray(t.user_ids) && t.user_ids.includes(userId))
      .map(t => ({
        id: t.id,
        name: t.name,
        type: 'troop',
        typeLabel: t.is_control_troop ? 'Kontrolltrupp' : 'Trupp',
        icon: t.is_control_troop ? 'mdi-account-check' : 'mdi-account-group',
        color: t.is_control_troop ? 'warning' : 'teal'
      }));
  }

  const organisationsList = [...orgItems, ...troopItems];

  return { orgItems, troopItems, organisationsList };
}

/**
 * Vue Composable for organization and troop selection state.
 */
export function useOrganizationLookup() {
  const organisationsList = ref([]);
  const loading = ref(false);

  async function loadOrganizationsAndTroops(supabase, userId) {
    loading.value = true;
    try {
      const res = await getOrganizationsAndTroops(supabase, userId);
      organisationsList.value = res.organisationsList;
      return res;
    } finally {
      loading.value = false;
    }
  }

  return {
    organisationsList,
    loading,
    loadOrganizationsAndTroops,
    getOrganizationsAndTroops
  };
}

