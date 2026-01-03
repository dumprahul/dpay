# Dpay Setup Guide

## Prerequisites

1. A Supabase account and project
2. Node.js installed

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. In your Supabase project, go to the SQL Editor
3. Run the SQL script from `supabase-schema.sql` to create the necessary tables
4. Go to Settings > API to get your project URL and anon key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the values with your actual Supabase project URL and anon key.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### For Room Owners (Register Page)

1. Navigate to `/register`
2. Enter a room name (e.g., "Family Room")
3. Enter your ENS address or wallet address (e.g., "0x..." or "name.eth")
4. Click "Create Room"
5. A QR code will be generated with an invite link
6. Share the QR code with family members

### For Family Members (Join Page)

1. Scan the QR code or use the invite link
2. The invite code will be automatically detected
3. Enter your wallet address
4. Click "Join Room"
5. Your wallet address will be saved to the room in Supabase

## Database Schema

- **rooms**: Stores room information (name, owner address, invite code)
- **room_members**: Stores member wallet addresses linked to rooms

See `supabase-schema.sql` for the complete schema.

