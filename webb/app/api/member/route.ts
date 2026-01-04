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
    const { vaultAddress, memberAddress } = await request.json();

    if (!vaultAddress || !memberAddress) {
      return NextResponse.json(
        { error: 'vaultAddress and memberAddress are required' },
        { status: 400 }
      );
    }

    // First, verify the member exists in Supabase
    const { data: memberData, error: memberError } = await supabase
      .from('room_members')
      .select(`
        id,
        wallet_address,
        room_id,
        rooms!inner (
          id,
          room_name,
          owner_address,
          owner_wallet_address
        )
      `)
      .eq('wallet_address', memberAddress.toLowerCase())
      .eq('rooms.owner_wallet_address', vaultAddress.toLowerCase())
      .limit(1)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json(
        { error: 'Member not found in this vault', member: null },
        { status: 404 }
      );
    }

    // Query GraphQL for member data
    const memberId = `${CHAIN_ID}-${vaultAddress.toLowerCase()}-${memberAddress.toLowerCase()}`;
    
    const query = `
      query GetMember($memberId: String!) {
        Member_by_pk(id: $memberId) {
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
          spends(limit: 50, order_by: { timestamp: desc }) {
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

    const graphqlData = await graphqlRequest(query, { memberId });
    const member = graphqlData.Member_by_pk || null;

    // Sort spends by timestamp descending if they exist
    if (member && member.spends) {
      member.spends.sort((a: any, b: any) => {
        const timestampA = BigInt(a.timestamp || '0');
        const timestampB = BigInt(b.timestamp || '0');
        return timestampA > timestampB ? -1 : timestampA < timestampB ? 1 : 0;
      });
    }

    // Combine Supabase member data with GraphQL member data
    return NextResponse.json({
      success: true,
      member,
      roomMember: memberData,
    });
  } catch (error: any) {
    console.error('Error fetching member data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch member data' },
      { status: 500 }
    );
  }
}

