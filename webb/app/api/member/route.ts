import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GRAPHQL_ENDPOINT = 'https://indexer.dev.hyperindex.xyz/7422293/v1/graphql';
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
    // Check both owner_address and owner_wallet_address to handle both cases
    // Try owner_wallet_address first (preferred), then fallback to owner_address
    let memberData = null;
    let memberError = null;
    
    // Try with owner_wallet_address first
    const { data: data1, error: error1 } = await supabase
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
      .maybeSingle();

    if (data1 && !error1) {
      memberData = data1;
    } else {
      // Fallback to owner_address
      const { data: data2, error: error2 } = await supabase
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
        .eq('rooms.owner_address', vaultAddress.toLowerCase())
        .limit(1)
        .maybeSingle();
      
      memberData = data2;
      memberError = error2;
    }

    if (memberError || !memberData) {
      // Don't log as error - member might not have any spending activity yet
      // Return success with null member so frontend can handle gracefully
      return NextResponse.json(
        { success: true, member: null, roomMember: null },
        { status: 200 }
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

    let member = null;
    try {
      const graphqlData = await graphqlRequest(query, { memberId });
      member = graphqlData.Member_by_pk || null;

      // Sort spends by timestamp descending if they exist
      if (member && member.spends) {
        member.spends.sort((a: any, b: any) => {
          const timestampA = BigInt(a.timestamp || '0');
          const timestampB = BigInt(b.timestamp || '0');
          return timestampA > timestampB ? -1 : timestampA < timestampB ? 1 : 0;
        });
      }
    } catch (graphqlError: any) {
      // If GraphQL query fails or member not found in indexer, that's okay
      // Member might not have any spending activity yet
      console.log('Member not found in indexer (no spending activity yet):', memberId);
      member = null;
    }

    // Return success even if member is null (no spending activity yet)
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

