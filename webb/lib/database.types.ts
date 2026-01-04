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

