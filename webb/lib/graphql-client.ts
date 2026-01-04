const GRAPHQL_ENDPOINT = 'https://indexer.dev.hyperindex.xyz/7422293/v1/graphql';
const CHAIN_ID = 11155111; // Sepolia

export interface Vault {
  id: string;
  chainId: number;
  address: string;
  totalSpent: string;
  spendCount: number;
  memberCount: number;
  firstSeenAt: string;
  lastActivityAt: string;
  members?: Member[];
  spends?: Spend[];
}

export interface Member {
  id: string;
  chainId: number;
  address: string;
  vault: Vault;
  totalSpent: string;
  spendCount: number;
  firstSeenAt: string;
  lastActiveAt: string;
  spends?: Spend[];
}

export interface Spend {
  id: string;
  chainId: number;
  vault: Vault;
  member: Member;
  token: string | null;
  amount: string | null;
  recipient: string | null;
  budgetLimit: string | null;
  budgetPeriod: string | null;
  expiresAt: string | null;
  timestamp: string;
  txHash: string;
  blockNumber: string;
}

async function graphqlRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL Query:', query);
    console.error('GraphQL Variables:', variables);
    console.error('GraphQL Errors:', result.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Query: Get vault by address
export async function getVaultByAddress(
  chainId: number,
  address: string
): Promise<Vault | null> {
  const query = `
    query GetVault($vaultId: String!) {
      vaults(where: { id: { _eq: $vaultId } }) {
        id
        chainId
        address
        totalSpent
        spendCount
        memberCount
        firstSeenAt
        lastActivityAt
        members {
          id
          chainId
          address
          totalSpent
          spendCount
          firstSeenAt
          lastActiveAt
        }
        spends(order_by: { timestamp: desc }, limit: 50) {
          id
          chainId
          token
          amount
          recipient
          budgetLimit
          budgetPeriod
          expiresAt
          timestamp
          txHash
          blockNumber
          member {
            id
            address
          }
        }
      }
    }
  `;

  const vaultId = `${chainId}-${address.toLowerCase()}`;
  const data = await graphqlRequest<{ vaults: Vault[] }>(query, { vaultId });
  return data.vaults?.[0] || null;
}

// Query: Get member by vault and address
export async function getMemberByAddress(
  chainId: number,
  vaultAddress: string,
  memberAddress: string
): Promise<Member | null> {
  const query = `
    query GetMember($memberId: String!) {
      members(where: { id: { _eq: $memberId } }) {
        id
        chainId
        address
        totalSpent
        spendCount
        firstSeenAt
        lastActiveAt
        vault {
          id
          chainId
          address
          totalSpent
          spendCount
          memberCount
        }
        spends(order_by: { timestamp: desc }, limit: 50) {
          id
          chainId
          token
          amount
          recipient
          budgetLimit
          budgetPeriod
          expiresAt
          timestamp
          txHash
          blockNumber
        }
      }
    }
  `;

  const memberId = `${chainId}-${vaultAddress.toLowerCase()}-${memberAddress.toLowerCase()}`;
  const data = await graphqlRequest<{ members: Member[] }>(query, { memberId });
  return data.members?.[0] || null;
}

// Query: Get recent spends for a vault
export async function getRecentSpends(
  chainId: number,
  vaultAddress: string,
  limit: number = 20
): Promise<Spend[]> {
  const query = `
    query GetRecentSpends($vaultId: String!, $limit: Int!) {
      vaults(where: { id: { _eq: $vaultId } }) {
        spends(order_by: { timestamp: desc }, limit: $limit) {
          id
          chainId
          token
          amount
          recipient
          budgetLimit
          budgetPeriod
          expiresAt
          timestamp
          txHash
          blockNumber
          member {
            id
            address
          }
        }
      }
    }
  `;

  const vaultId = `${chainId}-${vaultAddress.toLowerCase()}`;
  const data = await graphqlRequest<{ vaults: Array<{ spends: Spend[] }> }>(query, {
    vaultId,
    limit,
  });
  return data.vaults?.[0]?.spends || [];
}

// Query: Get member spends
export async function getMemberSpends(
  chainId: number,
  vaultAddress: string,
  memberAddress: string,
  limit: number = 20
): Promise<Spend[]> {
  const query = `
    query GetMemberSpends($memberId: String!, $limit: Int!) {
      members(where: { id: { _eq: $memberId } }) {
        spends(order_by: { timestamp: desc }, limit: $limit) {
          id
          chainId
          token
          amount
          recipient
          budgetLimit
          budgetPeriod
          expiresAt
          timestamp
          txHash
          blockNumber
        }
      }
    }
  `;

  const memberId = `${chainId}-${vaultAddress.toLowerCase()}-${memberAddress.toLowerCase()}`;
  const data = await graphqlRequest<{ members: Array<{ spends: Spend[] }> }>(query, {
    memberId,
    limit,
  });
  return data.members?.[0]?.spends || [];
}

