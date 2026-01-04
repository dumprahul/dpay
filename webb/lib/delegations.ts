import { supabase } from './supabase';

/**
 * Get all delegations for a specific wallet address
 */
export async function getDelegationsByWalletAddress(walletAddress: string) {
  const { data, error } = await supabase
    .from('delegations')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get delegations for a room member
 */
export async function getDelegationsByRoomMember(roomMemberId: string) {
  const { data, error } = await supabase
    .from('delegations')
    .select('*')
    .eq('room_member_id', roomMemberId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get delegations with room and member information
 */
export async function getDelegationsWithDetails(walletAddress: string) {
  const { data, error } = await supabase
    .from('delegations')
    .select(`
      *,
      room_members (
        id,
        wallet_address,
        room_id,
        rooms (
          id,
          room_name,
          owner_address
        )
      )
    `)
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

