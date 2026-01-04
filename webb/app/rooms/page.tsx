'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import WalletButton from '@/components/WalletButton';
import DelegationModal from '@/components/DelegationModal';
import type { Address } from 'viem';

interface RoomMember {
  id: string;
  wallet_address: string;
  joined_at: string;
}

interface Room {
  id: string;
  room_name: string;
  owner_address: string;
  invite_code: string;
  created_at: string;
  members?: RoomMember[];
}

export default function Rooms() {
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState('');
  const [delegationModal, setDelegationModal] = useState<{
    isOpen: boolean;
    memberAddress: string;
  }>({
    isOpen: false,
    memberAddress: '',
  });

  useEffect(() => {
    checkWalletConnection();
    
    // Listen for wallet account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      loadRooms(walletAddress);
    }
  }, [walletAddress]);

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
      setRooms([]);
    }
  };

  const loadRooms = async (address: Address) => {
    setLoadingRooms(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('rooms')
        .select('id, room_name, owner_address, invite_code, created_at')
        .eq('owner_wallet_address', address.toLowerCase())
        .order('created_at', { ascending: false });

      if (dbError) {
        throw dbError;
      }

      if (!data || data.length === 0) {
        setRooms([]);
        return;
      }

      // Fetch members for all rooms
      const roomIds = data.map((room) => room.id);
      const { data: membersData, error: membersError } = await supabase
        .from('room_members')
        .select('id, room_id, wallet_address, joined_at')
        .in('room_id', roomIds)
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.error('Error loading members:', membersError);
      }

      // Combine rooms with their members
      const roomsWithMembers: Room[] = data.map((room) => ({
        ...room,
        members: membersData?.filter((member) => member.room_id === room.id) || [],
      }));

      setRooms(roomsWithMembers);
    } catch (err: any) {
      console.error('Error loading rooms:', err);
      setError(err.message || 'Failed to load rooms. Please try again.');
    } finally {
      setLoadingRooms(false);
    }
  };

  const copyInviteLink = (code: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/join?code=${code}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied to clipboard!');
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
        <main className="flex w-full max-w-4xl flex-col items-center justify-center px-8 py-16">
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
                Please connect your MetaMask wallet to view your rooms
              </p>
              <div className="flex justify-center">
                <WalletButton />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="flex w-full max-w-4xl flex-col px-8 py-16">
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-black dark:text-zinc-50">
                  My Rooms
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Connected: <span className="font-mono text-xs">{walletAddress}</span>
                </p>
              </div>
              <Link
                href="/register"
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Create New Room
              </Link>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            {loadingRooms ? (
              <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                Loading rooms...
              </div>
            ) : rooms.length === 0 ? (
              <div className="py-8 text-center">
                <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                  You haven't created any rooms yet.
                </p>
                <Link
                  href="/register"
                  className="inline-block rounded-lg bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  Create Your First Room
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-black dark:text-zinc-50">
                            {room.room_name}
                          </h3>
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                            {room.members?.length || 0} {room.members?.length === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                          Owner: <span className="font-mono text-xs">{room.owner_address}</span>
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                          Created: {new Date(room.created_at).toLocaleDateString()}
                        </p>
                        <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-500">
                          Invite Code: {room.invite_code}
                        </p>

                        {/* Room Members Section */}
                        {room.members && room.members.length > 0 && (
                          <div className="mt-4 rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                            <h4 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">
                              Room Members ({room.members.length})
                            </h4>
                            <div className="space-y-2">
                              {room.members.map((member, index) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-xs font-medium text-zinc-700 dark:bg-zinc-600 dark:text-zinc-300">
                                        {index + 1}
                                      </span>
                                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                        {member.wallet_address}
                                      </span>
                                    </div>
                                    <p className="ml-8 mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                                      Joined: {new Date(member.joined_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setDelegationModal({
                                          isOpen: true,
                                          memberAddress: member.wallet_address,
                                        });
                                      }}
                                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                                      title="Delegate USDC to this member"
                                    >
                                      Delegate
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(member.wallet_address);
                                        alert('Wallet address copied!');
                                      }}
                                      className="ml-2 rounded px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                      title="Copy wallet address"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!room.members || room.members.length === 0) && (
                          <div className="mt-4 rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              No members have joined this room yet. Share the invite link to get started!
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => copyInviteLink(room.invite_code)}
                        className="ml-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        Copy Invite Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <DelegationModal
        isOpen={delegationModal.isOpen}
        onClose={() =>
          setDelegationModal({ isOpen: false, memberAddress: '' })
        }
        memberAddress={delegationModal.memberAddress}
      />
    </div>
  );
}
