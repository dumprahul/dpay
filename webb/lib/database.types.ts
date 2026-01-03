export interface Room {
  id: string;
  room_name: string;
  owner_address: string;
  user_email: string;
  invite_code: string;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  wallet_address: string;
  joined_at: string;
}

