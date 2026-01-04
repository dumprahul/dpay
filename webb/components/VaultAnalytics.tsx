'use client';

import { useEffect, useState } from 'react';
import { type Vault } from '@/lib/graphql-client';
import { formatUnits } from 'viem';

interface VaultAnalyticsProps {
  chainId: number;
  vaultAddress: string;
  className?: string;
}

export default function VaultAnalytics({
  chainId,
  vaultAddress,
  className = '',
}: VaultAnalyticsProps) {
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVaultData();
  }, [vaultAddress]);

  const loadVaultData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerAddress: vaultAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch vault data');
      }

      const data = await response.json();
      setVault(data.vault);
    } catch (err: any) {
      console.error('Error loading vault data:', err);
      setError(err.message || 'Failed to load vault data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-zinc-200 rounded dark:bg-zinc-700"></div>
          <div className="h-8 w-24 bg-zinc-200 rounded dark:bg-zinc-700"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20 ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No vault data found</p>
      </div>
    );
  }

  const totalSpentUSD = formatUnits(BigInt(vault.totalSpent), 6); // USDC has 6 decimals

  return (
    <div className={`rounded-lg border border-zinc-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-700 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
        Vault Analytics
      </h3>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Spent</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            ${parseFloat(totalSpentUSD).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">USDC</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Transactions</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            {vault.spendCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Spends</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active Members</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            {vault.memberCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Members</p>
        </div>
      </div>

      {vault.spends && vault.spends.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">
            Recent Activity
          </h4>
          <div className="space-y-2">
            {vault.spends.slice(0, 5).map((spend) => {
              const amount = spend.amount ? formatUnits(BigInt(spend.amount), 6) : '0';
              const date = new Date(Number(spend.timestamp) * 1000);
              
              return (
                <div
                  key={spend.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {spend.member?.address.slice(0, 10)}...
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-500">
                        →
                      </span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {spend.recipient?.slice(0, 10)}...
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      {date.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-black dark:text-zinc-50">
                      ${parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${spend.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View TX
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

