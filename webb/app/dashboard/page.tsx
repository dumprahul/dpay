'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import WalletButton from '@/components/WalletButton';
import { getDelegationsWithDetails } from '@/lib/delegations';
import type { Address } from 'viem';
import type { Delegation } from '@/lib/database.types';

interface DelegationWithDetails extends Delegation {
  room_members?: {
    id: string;
    wallet_address: string;
    room_id: string;
    rooms?: {
      id: string;
      room_name: string;
      owner_address: string;
    };
  };
}

export default function Dashboard() {
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [delegations, setDelegations] = useState<DelegationWithDetails[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  const [error, setError] = useState('');

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
      loadDelegations();
    } else {
      setDelegations([]);
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
      setDelegations([]);
    }
  };

  const loadDelegations = async () => {
    if (!walletAddress) return;

    setLoadingDelegations(true);
    setError('');

    try {
      const data = await getDelegationsWithDetails(walletAddress);
      setDelegations(data || []);
    } catch (err: any) {
      console.error('Error loading delegations:', err);
      setError(err.message || 'Failed to load delegations. Please try again.');
    } finally {
      setLoadingDelegations(false);
    }
  };

  const formatPeriodDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
                Please connect your MetaMask wallet to view your delegations
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
      <main className="flex w-full max-w-6xl flex-col px-8 py-16">
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
            <div className="mb-6">
              <h2 className="text-3xl font-semibold text-black dark:text-zinc-50">
                My Delegations
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Connected: <span className="font-mono text-xs">{walletAddress}</span>
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            {loadingDelegations ? (
              <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                Loading delegations...
              </div>
            ) : delegations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                  You don't have any delegations yet.
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  Delegations will appear here once a room owner delegates USDC to you.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {delegations.map((delegation) => (
                  <div
                    key={delegation.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="space-y-4">
                      {/* Room and Owner Info */}
                      {delegation.room_members?.rooms && (
                        <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
                                {delegation.room_members.rooms.room_name}
                              </h3>
                              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                Delegated by: <span className="font-mono text-xs">{formatAddress(delegation.room_members.rooms.owner_address)}</span>
                              </p>
                            </div>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              Active
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Delegation Details */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Period Duration
                          </label>
                          <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">
                            {formatPeriodDuration(delegation.period_duration)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                            {delegation.period_duration.toLocaleString()} seconds
                          </p>
                        </div>

                        <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Start Time
                          </label>
                          <p className="mt-1 text-sm font-medium text-black dark:text-zinc-50">
                            {formatDate(delegation.start_time)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Token Address
                          </label>
                          <p className="mt-1 font-mono text-xs text-black dark:text-zinc-50 break-all">
                            {delegation.token_address}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(delegation.token_address);
                              alert('Token address copied!');
                            }}
                            className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Copy
                          </button>
                        </div>

                        <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Delegation Manager
                          </label>
                          <p className="mt-1 font-mono text-xs text-black dark:text-zinc-50 break-all">
                            {formatAddress(delegation.delegation_manager)}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(delegation.delegation_manager);
                              alert('Delegation manager address copied!');
                            }}
                            className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      {/* Justification */}
                      <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Justification
                        </label>
                        <p className="mt-1 text-sm text-black dark:text-zinc-50">
                          {delegation.justification}
                        </p>
                      </div>

                      {/* Permissions Context */}
                      <div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Permissions Context
                        </label>
                        <p className="mt-1 font-mono text-xs text-black dark:text-zinc-50 break-all">
                          {delegation.permissions_context.slice(0, 100)}...
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(delegation.permissions_context);
                            alert('Permissions context copied!');
                          }}
                          className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Copy Full Context
                        </button>
                      </div>

                      {/* Created At */}
                      <div className="text-xs text-zinc-500 dark:text-zinc-500">
                        Created: {new Date(delegation.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

