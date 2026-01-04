'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import WalletButton from '@/components/WalletButton';
import type { Address } from 'viem';

export default function Register() {
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomName, setRoomName] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    // Check for existing wallet connection
    checkWalletConnection();
    
    // Listen for wallet account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem('walletAddress');
      if (stored) {
        setWalletAddress(stored as Address);
      } else {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0] as Address);
          localStorage.setItem('walletAddress', accounts[0]);
        }
      }
    } catch (err) {
      console.error('Error checking wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts && accounts.length > 0) {
      setWalletAddress(accounts[0] as Address);
      localStorage.setItem('walletAddress', accounts[0]);
    } else {
      setWalletAddress(null);
      localStorage.removeItem('walletAddress');
    }
  };

  const generateInviteCode = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    }
    return Math.random().toString(36).substring(2, 18);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!roomName.trim() || !ownerAddress.trim()) {
      setError('Please fill in all fields');
      setSubmitting(false);
      return;
    }

    if (!walletAddress) {
      setError('Please connect your wallet first');
      setSubmitting(false);
      return;
    }

    try {
      const code = generateInviteCode();
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${baseUrl}/join?code=${code}`;

      // Save room to Supabase with wallet address
      const { data, error: dbError } = await supabase
        .from('rooms')
        .insert([
          {
            room_name: roomName.trim(),
            owner_address: ownerAddress.trim(),
            owner_wallet_address: walletAddress,
            invite_code: code,
          },
        ])
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      setInviteCode(code);
      setInviteLink(link);
      setSuccess(true);
    } catch (err: any) {
      console.error('Error creating room:', err);
      setError(err.message || 'Failed to create room. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
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
    );
  }

  if (!walletAddress) {
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
                Connect Wallet Required
              </h2>
              <p className="mb-8 text-zinc-600 dark:text-zinc-400">
                Please connect your MetaMask wallet to create a room
              </p>
              <div className="flex justify-center">
                <WalletButton />
              </div>
              <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                Want to join a room?{' '}
                <Link
                  href="/join"
                  className="font-medium text-black underline dark:text-white"
                >
                  Join here
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
                Room Created Successfully!
              </h2>
              <p className="mb-6 text-zinc-600 dark:text-zinc-400">
                Share this QR code with your family members to join the room
              </p>
              
              <div className="mb-6 flex flex-col items-center gap-4">
                <div className="rounded-lg border-2 border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <QRCodeSVG value={inviteLink} size={256} />
                </div>
                <div className="w-full space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Invite Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteLink}
                      className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                      }}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Room Name
                  </label>
                  <p className="text-lg font-semibold text-black dark:text-zinc-50">
                    {roomName}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Link
                  href="/rooms"
                  className="flex-1 rounded-lg bg-black px-4 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  View My Rooms
                </Link>
                <Link
                  href="/"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-center font-medium text-black transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
        <div className="w-full space-y-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50"
            >
              Dpay
            </Link>
            <WalletButton />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-3xl font-semibold text-black dark:text-zinc-50">
              Create Room
            </h2>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              Connected: <span className="font-mono text-xs">{walletAddress}</span>
            </p>
            <p className="mb-8 text-zinc-600 dark:text-zinc-400">
              Create a room and invite your family members to join
            </p>
            
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="roomName"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Room Name
                </label>
                <input
                  type="text"
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                  placeholder="Family Room"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="ownerAddress"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Owner's ENS Address / Wallet Address
                </label>
                <input
                  type="text"
                  id="ownerAddress"
                  value={ownerAddress}
                  onChange={(e) => setOwnerAddress(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                  placeholder="0x... or name.eth"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {submitting ? 'Creating Room...' : 'Create Room'}
              </button>
            </form>
            <div className="mt-6 flex items-center justify-between text-sm">
              <Link
                href="/rooms"
                className="font-medium text-black underline dark:text-white"
              >
                View My Rooms
              </Link>
              <p className="text-zinc-600 dark:text-zinc-400">
                Want to join a room?{' '}
                <Link
                  href="/join"
                  className="font-medium text-black underline dark:text-white"
                >
                  Join here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
