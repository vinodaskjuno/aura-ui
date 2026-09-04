import client from './client'

/** One directory group, attached to one organization role. */
export interface LdapMapping {
  group: string
  orgRoleId: string
}

/**
 * A business function and the menus it grants.
 *
 * `permissions` is the authority. `basedOn` only records which built-in role was
 * cloned to start it — it grants nothing, which is the whole point: the old Role
 * Management screen wrote permissions somewhere the directory never read.
 */
export interface OrgRole {
  id: string
  label: string
  description: string
  basedOn: string
  permissions: string[]
  priority: number
}

/** A built-in role offered as a starting point in the org-role editor. */
export interface RoleTemplate {
  id: string
  label: string
  permissions: string[]
}

export interface LdapConfig {
  enabled: boolean
  orgRoles: OrgRole[]
  mappings: LdapMapping[]
  updatedAt?: string
  updatedBy?: string
  connection: {
    uri: string; baseDn: string; bindDn: string
    userFilter: string; allowInsecure: boolean; bindPasswordSet: boolean
  }
  availableRoles: string[]
  availablePermissions: string[]
  roleTemplates: RoleTemplate[]
}

export interface LdapPreview {
  ok: boolean
  message?: string
  dn?: string
  groupSource?: string
  groups: string[]
  matchedGroups: string[]
  unmatchedGroups?: string[]
  roleId?: string
  roleLabel?: string
  permissions: string[]
  wouldSignIn: boolean
  configuredGroups?: string[]
}

export const getLdapConfig = async (): Promise<LdapConfig> =>
  (await client.get('/auth/ldap/config')).data

export const saveLdapConfig = async (body: {
  enabled: boolean; orgRoles: OrgRole[]; mappings: LdapMapping[]
}): Promise<LdapConfig> => (await client.put('/auth/ldap/config', body)).data

// ── Break-glass accounts ────────────────────────────────────────────────────
// What is left of local user administration. These accounts exist so a wrong bind
// DN cannot lock everyone out — including out of the screen where it is fixed.

export interface LocalAccount {
  userId: string
  username: string
  email?: string
  roleId?: string
  status?: string
  breakGlass?: boolean
  lastLogin?: string | null
}

export const getLocalAccounts = async (): Promise<LocalAccount[]> =>
  (await client.get('/auth/users')).data

export const rotatePassword = async (userId: string, password: string) =>
  (await client.post(`/auth/users/${encodeURIComponent(userId)}/password`,
    { password })).data

export const testLdap = async (): Promise<{ ok: boolean; message: string }> =>
  (await client.post('/auth/ldap/test')).data

/** What access would this person get — answered without their password. */
export const previewLdapUser = async (username: string): Promise<LdapPreview> =>
  (await client.get(`/auth/ldap/preview?username=${encodeURIComponent(username)}`)).data
