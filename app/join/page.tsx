'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateSessionAccount, getStoredSessionAccount } from '@/lib/session-account';

function JoinForm() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('code');
  
  const [walletAddress, setWalletAddress] = useState('');
  const [smartAccountAddress, setSmartAccountAddress] = useState<`0x${string}` | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [checkingRoom, setCheckingRoom] = useState(!!inviteCode);
  const [initializingAccount, setInitializingAccount] = useState(false);

  // Generate or load session account and create smart account
  const initializeSmartAccount = useCallback(async () => {
    if (initializingAccount) return;
    
    setInitializingAccount(true);
    setLoadingMessage('Setting up your smart account...');

    try {
      const { sessionAccount, smartAccount } = await generateSessionAccount();
      
      setWalletAddress(sessionAccount.address);
      setSmartAccountAddress(smartAccount.address);
      setLoadingMessage(null);
    } catch (err: any) {
      console.error('Error initializing smart account:', err);
      setError(`Failed to set up smart account: ${err.message || 'Unknown error'}`);
      setLoadingMessage(null);
    } finally {
      setInitializingAccount(false);
    }
  }, [initializingAccount]);

  useEffect(() => {
    // Automatically initialize smart account when component mounts
    if (typeof window !== 'undefined') {
      initializeSmartAccount();
    }
  }, [initializeSmartAccount]);

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
    setLoadingMessage('Joining room...');

    if (!smartAccountAddress) {
      setError('Smart account not initialized. Please wait...');
      setLoading(false);
      setLoadingMessage(null);
      return;
    }

    if (!inviteCode) {
      setError('Invalid invite code');
      setLoading(false);
      setLoadingMessage(null);
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

      // Check if smart account address already exists in this room
      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomData.id)
        .eq('wallet_address', smartAccountAddress)
        .single();

      if (existingMember) {
        setError('This wallet address is already a member of this room');
        setLoading(false);
        setLoadingMessage(null);
        return;
      }

      // Add member to room using smart account address
      const { error: memberError } = await supabase
        .from('room_members')
        .insert([
          {
            room_id: roomData.id,
            wallet_address: smartAccountAddress,
          },
        ]);

      if (memberError) {
        throw memberError;
      }

      setSuccess(true);
      setLoadingMessage(null);
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room. Please try again.');
      setLoadingMessage(null);
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
              {smartAccountAddress && (
                <div className="mb-6 space-y-2">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Your Smart Account Address:
                  </p>
                  <p className="font-mono text-sm text-black dark:text-zinc-50 break-all">
                    {smartAccountAddress}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Session EOA: {walletAddress}
                  </p>
                </div>
              )}
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

  if (checkingRoom || initializingAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
        <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
          <div className="text-center">
            <div className="mb-4 text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
              Dpay
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              {loadingMessage || (checkingRoom ? 'Verifying invite code...' : 'Setting up your account...')}
            </p>
            {initializingAccount && (
              <div className="mt-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              </div>
            )}
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
                ? 'Your smart account is ready! Click below to join the room.'
                : 'Enter an invite code or scan the QR code to join a room'}
            </p>
            
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            {smartAccountAddress && (
              <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                <p className="font-medium">Smart Account Ready</p>
                <p className="mt-1 font-mono text-xs break-all">{smartAccountAddress}</p>
              </div>
            )}

            {!inviteCode && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-600 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
                No invite code found. Please scan the QR code or use the invite link.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {smartAccountAddress && (
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4 space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Session Account (EOA)
                  </label>
                  <p className="font-mono text-sm text-zinc-600 dark:text-zinc-400 break-all">
                    {walletAddress}
                  </p>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-2">
                    Smart Account Address
                  </label>
                  <p className="font-mono text-sm text-zinc-600 dark:text-zinc-400 break-all">
                    {smartAccountAddress}
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !inviteCode || !smartAccountAddress}
                className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {loading ? (loadingMessage || 'Joining Room...') : 'Join Room'}
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
