import client from './client'

export interface LdapMapping {
  group: string
  roleId: string
  permissions: string[]
  priority: number
}

export interface LdapConfig {
  enabled: boolean
  mappings: LdapMapping[]
  updatedAt?: string
  updatedBy?: string
  connection: {
    uri: string; baseDn: string; bindDn: string
    userFilter: string; allowInsecure: boolean; bindPasswordSet: boolean
  }
  availableRoles: string[]
  availablePermissions: string[]
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
  permissions: string[]
  wouldSignIn: boolean
  configuredGroups?: string[]
}

export const getLdapConfig = async (): Promise<LdapConfig> =>
  (await client.get('/auth/ldap/config')).data

export const saveLdapConfig = async (body: {
  enabled: boolean; mappings: LdapMapping[]
}): Promise<LdapConfig> => (await client.put('/auth/ldap/config', body)).data

export const testLdap = async (): Promise<{ ok: boolean; message: string }> =>
  (await client.post('/auth/ldap/test')).data

/** What access would this person get — answered without their password. */
export const previewLdapUser = async (username: string): Promise<LdapPreview> =>
  (await client.get(`/auth/ldap/preview?username=${encodeURIComponent(username)}`)).data
