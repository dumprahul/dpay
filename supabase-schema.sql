-- Dpay Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create room_members table
CREATE TABLE IF NOT EXISTS room_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(room_id, wallet_address)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_wallet_address ON room_members(wallet_address);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- Create policies for rooms table
-- Allow anyone to read rooms (needed for invite code verification)
CREATE POLICY "Allow public read access to rooms" ON rooms
  FOR SELECT USING (true);

-- Allow anyone to insert rooms (for room creation)
CREATE POLICY "Allow public insert access to rooms" ON rooms
  FOR INSERT WITH CHECK (true);

-- Create policies for room_members table
-- Allow anyone to read room members
CREATE POLICY "Allow public read access to room_members" ON room_members
  FOR SELECT USING (true);

-- Allow anyone to insert room members (for joining rooms)
CREATE POLICY "Allow public insert access to room_members" ON room_members
  FOR INSERT WITH CHECK (true);

