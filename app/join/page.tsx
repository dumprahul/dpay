'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function JoinForm() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('code');
  
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [checkingRoom, setCheckingRoom] = useState(!!inviteCode);

  useEffect(() => {
    const checkRoom = async () => {
      if (!inviteCode) {
        setCheckingRoom(false);
        return;
      }

      try {
        const { data, error: roomError } = await supabase
          .from('rooms')
          .select('room_name, id')
          .eq('invite_code', inviteCode)
          .single();

        if (roomError || !data) {
          setError('Invalid invite code. Please check the QR code or link.');
          setCheckingRoom(false);
          return;
        }

        setRoomName(data.room_name);
        setCheckingRoom(false);
      } catch (err: any) {
        console.error('Error checking room:', err);
        setError('Failed to verify invite code. Please try again.');
        setCheckingRoom(false);
      }
    };

    checkRoom();
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!walletAddress.trim()) {
      setError('Please enter your wallet address');
      setLoading(false);
      return;
    }

    if (!inviteCode) {
      setError('Invalid invite code');
      setLoading(false);
      return;
    }

    try {
      // First, get the room ID
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('invite_code', inviteCode)
        .single();

      if (roomError || !roomData) {
        throw new Error('Room not found');
      }

      // Check if wallet address already exists in this room
      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomData.id)
        .eq('wallet_address', walletAddress.trim())
        .single();

      if (existingMember) {
        setError('This wallet address is already a member of this room');
        setLoading(false);
        return;
      }

      // Add member to room
      const { error: memberError } = await supabase
        .from('room_members')
        .insert([
          {
            room_id: roomData.id,
            wallet_address: walletAddress.trim(),
          },
        ]);

      if (memberError) {
        throw memberError;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
          <div className="w-full space-y-8">
            <div className="text-center">
              <Link
                href="/"
                className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50"
              >
                Dpay
              </Link>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-3xl font-semibold text-black dark:text-zinc-50">
                Successfully Joined!
              </h2>
              <p className="mb-6 text-zinc-600 dark:text-zinc-400">
                You have successfully joined <span className="font-semibold">{roomName}</span>
              </p>
              <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                Your wallet address: <span className="font-mono text-black dark:text-zinc-50">{walletAddress}</span>
              </p>
              <Link
                href="/"
                className="block w-full rounded-lg bg-black px-4 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (checkingRoom) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
          <div className="text-center">
            <div className="mb-4 text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
              Dpay
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">Verifying invite code...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
        <div className="w-full space-y-8">
          <div className="text-center">
            <Link
              href="/"
              className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50"
            >
              Dpay
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-3xl font-semibold text-black dark:text-zinc-50">
              Join Room
            </h2>
            {roomName && (
              <p className="mb-2 text-lg font-medium text-black dark:text-zinc-50">
                Room: {roomName}
              </p>
            )}
            <p className="mb-8 text-zinc-600 dark:text-zinc-400">
              {inviteCode 
                ? 'Enter your wallet address to join this room'
                : 'Enter an invite code or scan the QR code to join a room'}
            </p>
            
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            {!inviteCode && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-600 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
                No invite code found. Please scan the QR code or use the invite link.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!inviteCode && (
                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Invite Code (if you have it)
                  </label>
                  <input
                    type="text"
                    id="inviteCode"
                    className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                    placeholder="Enter invite code"
                    readOnly
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                    Please use the QR code or invite link provided by the room owner
                  </p>
                </div>
              )}
              <div>
                <label
                  htmlFor="walletAddress"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Your Wallet Address
                </label>
                <input
                  type="text"
                  id="walletAddress"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                  placeholder="0x..."
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !inviteCode}
                className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {loading ? 'Joining Room...' : 'Join Room'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Want to create a room?{' '}
              <Link
                href="/register"
                className="font-medium text-black underline dark:text-white"
              >
                Create here
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Join() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
          <div className="text-center">
            <div className="mb-4 text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
              Dpay
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </main>
      </div>
    }>
      <JoinForm />
    </Suspense>
  );
}
