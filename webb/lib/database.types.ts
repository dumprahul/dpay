export interface Room {
  id: string;
  room_name: string;
  owner_address: string;
  owner_wallet_address: string;
  invite_code: string;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  wallet_address: string;
  joined_at: string;
}

export interface Delegation {
  id: string;
  room_member_id: string;
  wallet_address: string;
  permissions_context: string;
  delegation_manager: string;
  justification: string;
  period_duration: number;
  start_time: number;
  token_address: string;
  created_at: string;
}

