'use client';

import { useEffect, useState } from 'react';
import { type Member } from '@/lib/graphql-client';
import { formatUnits } from 'viem';

interface MemberAnalyticsProps {
  chainId: number;
  vaultAddress: string;
  memberAddress: string;
  className?: string;
}

export default function MemberAnalytics({
  chainId,
  vaultAddress,
  memberAddress,
  className = '',
}: MemberAnalyticsProps) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemberData();
  }, [vaultAddress, memberAddress]);

  const loadMemberData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vaultAddress,
          memberAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch member data');
      }

      const data = await response.json();
      setMember(data.member);
    } catch (err: any) {
      console.error('Error loading member data:', err);
      setError(err.message || 'Failed to load member data');
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

  if (!member) {
    return (
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No activity data found</p>
      </div>
    );
  }

  const totalSpentUSD = formatUnits(BigInt(member.totalSpent), 6);

  return (
    <div className={`rounded-lg border border-zinc-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-700 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
        Your Spending Analytics
      </h3>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Spent</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            ${parseFloat(totalSpentUSD).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">USDC</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            {member.spendCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Total Spends</p>
        </div>
      </div>

      {member.spends && member.spends.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">
            Recent Transactions
          </h4>
          <div className="space-y-2">
            {member.spends.slice(0, 10).map((spend) => {
              const amount = spend.amount ? formatUnits(BigInt(spend.amount), 6) : '0';
              const date = new Date(Number(spend.timestamp) * 1000);
              
              return (
                <div
                  key={spend.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Paid to
                      </span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {spend.recipient?.slice(0, 10)}...{spend.recipient?.slice(-8)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      {date.toLocaleString()}
                    </p>
                    {spend.budgetLimit && (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                        Budget: ${formatUnits(BigInt(spend.budgetLimit), 6)} / {spend.budgetPeriod ? `${Number(spend.budgetPeriod) / 86400} days` : 'N/A'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      -${parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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

