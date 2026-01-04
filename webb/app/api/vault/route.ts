import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GRAPHQL_ENDPOINT = 'https://indexer.dev.hyperindex.xyz/4d64de1/v1/graphql';
const CHAIN_ID = 11155111; // Sepolia

async function graphqlRequest(query: string, variables?: Record<string, any>) {
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

export async function POST(request: NextRequest) {
  try {
    const { ownerAddress } = await request.json();

    if (!ownerAddress) {
      return NextResponse.json(
        { error: 'ownerAddress is required' },
        { status: 400 }
      );
    }

    // First, fetch room data from Supabase to verify the vault exists
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_name, owner_address, owner_wallet_address')
      .eq('owner_wallet_address', ownerAddress.toLowerCase())
      .limit(1)
      .single();

    if (roomError || !roomData) {
      return NextResponse.json(
        { error: 'Room not found for this owner address', vault: null },
        { status: 404 }
      );
    }

    // Query GraphQL for vault data
    const vaultId = `${CHAIN_ID}-${ownerAddress.toLowerCase()}`;
    
    const query = `
      query GetVault($vaultId: String!) {
        Vault_by_pk(id: $vaultId) {
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
          spends(limit: 50) {
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

    const graphqlData = await graphqlRequest(query, { vaultId });
    const vault = graphqlData.Vault_by_pk || null;

    // Sort spends by timestamp descending if they exist
    if (vault && vault.spends) {
      vault.spends.sort((a: any, b: any) => {
        const timestampA = BigInt(a.timestamp || '0');
        const timestampB = BigInt(b.timestamp || '0');
        return timestampA > timestampB ? -1 : timestampA < timestampB ? 1 : 0;
      });
    }

    // Combine Supabase room data with GraphQL vault data
    return NextResponse.json({
      success: true,
      vault,
      room: roomData,
    });
  } catch (error: any) {
    console.error('Error fetching vault data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vault data' },
      { status: 500 }
    );
  }
}

