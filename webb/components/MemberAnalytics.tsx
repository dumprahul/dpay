'use client';

import { useEffect, useState } from 'react';
import { type Member } from '@/lib/graphql-client';
import { formatUnits } from 'viem';

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
}

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
        // If member not found, don't show as error - just set member to null
        if (errorData.error?.includes('Member not found') || response.status === 404) {
          setMember(null);
          setError(null);
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch member data');
      }

      const data = await response.json();
      setMember(data.member);
    } catch (err: any) {
      console.error('Error loading member data:', err);
      // Only show error if it's not a "not found" error
      if (!err.message?.includes('Member not found')) {
        setError(err.message || 'Failed to load member data');
      } else {
        setMember(null);
        setError(null);
      }
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
      <div className={`rounded-lg border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-6 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-700 ${className}`}>
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
            Spending Analytics
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No spending activity recorded yet
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Analytics will appear here once you make your first payment using a delegation
          </p>
        </div>
      </div>
    );
  }

  const totalSpentUSD = formatUnits(BigInt(member.totalSpent), 6);
  
  // Calculate additional analytics
  const averageSpend = member.spendCount > 0 
    ? parseFloat(totalSpentUSD) / member.spendCount 
    : 0;
  
  const largestSpend = member.spends && member.spends.length > 0
    ? Math.max(...member.spends.map(s => s.amount ? parseFloat(formatUnits(BigInt(s.amount), 6)) : 0))
    : 0;
  
  const firstSeenDate = member.firstSeenAt 
    ? new Date(Number(member.firstSeenAt) * 1000)
    : null;
  
  const lastActiveDate = member.lastActiveAt
    ? new Date(Number(member.lastActiveAt) * 1000)
    : null;
  
  // Calculate days active
  const daysActive = firstSeenDate && lastActiveDate
    ? Math.ceil((lastActiveDate.getTime() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Calculate average daily spend
  const avgDailySpend = daysActive > 0
    ? parseFloat(totalSpentUSD) / daysActive
    : 0;
  
  // Get most frequent recipient
  const recipientCounts: Record<string, number> = {};
  member.spends?.forEach(spend => {
    if (spend.recipient) {
      recipientCounts[spend.recipient] = (recipientCounts[spend.recipient] || 0) + 1;
    }
  });
  const mostFrequentRecipient = Object.entries(recipientCounts).sort((a, b) => b[1] - a[1])[0];
  
  // Calculate spending by time period (last 7, 30, 90 days)
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
  
  const spendLast7Days = member.spends?.filter(s => {
    const timestamp = Number(s.timestamp) * 1000;
    return timestamp >= sevenDaysAgo;
  }).reduce((sum, s) => sum + (s.amount ? parseFloat(formatUnits(BigInt(s.amount), 6)) : 0), 0) || 0;
  
  const spendLast30Days = member.spends?.filter(s => {
    const timestamp = Number(s.timestamp) * 1000;
    return timestamp >= thirtyDaysAgo;
  }).reduce((sum, s) => sum + (s.amount ? parseFloat(formatUnits(BigInt(s.amount), 6)) : 0), 0) || 0;
  
  const spendLast90Days = member.spends?.filter(s => {
    const timestamp = Number(s.timestamp) * 1000;
    return timestamp >= ninetyDaysAgo;
  }).reduce((sum, s) => sum + (s.amount ? parseFloat(formatUnits(BigInt(s.amount), 6)) : 0), 0) || 0;

  return (
    <div className={`rounded-lg border border-zinc-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-700 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
        Your Spending Analytics
      </h3>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
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

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Average Transaction</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            ${averageSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Per Transaction</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Largest Transaction</p>
          <p className="mt-1 text-2xl font-bold text-black dark:text-zinc-50">
            ${largestSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Single Payment</p>
        </div>
      </div>

      {/* Activity Period Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Last 7 Days</p>
          <p className="mt-1 text-xl font-bold text-black dark:text-zinc-50">
            ${spendLast7Days.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Recent Activity</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Last 30 Days</p>
          <p className="mt-1 text-xl font-bold text-black dark:text-zinc-50">
            ${spendLast30Days.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Monthly Spend</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Average Daily</p>
          <p className="mt-1 text-xl font-bold text-black dark:text-zinc-50">
            ${avgDailySpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Per Day</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Days Active</p>
          <p className="mt-1 text-xl font-bold text-black dark:text-zinc-50">
            {daysActive}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            {firstSeenDate ? `Since ${firstSeenDate.toLocaleDateString()}` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Member Info & Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Member Information</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">First Seen:</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {firstSeenDate ? firstSeenDate.toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Last Active:</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {lastActiveDate ? lastActiveDate.toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Member Address:</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                {member.address.slice(0, 8)}...{member.address.slice(-6)}
              </span>
            </div>
          </div>
        </div>

        {mostFrequentRecipient && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Most Frequent Recipient</p>
            <div className="space-y-1">
              <p className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                {mostFrequentRecipient[0].slice(0, 12)}...{mostFrequentRecipient[0].slice(-10)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                {mostFrequentRecipient[1]} transaction{mostFrequentRecipient[1] !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {member.spends && member.spends.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-black dark:text-zinc-50">
              Recent Transactions
            </h4>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {Math.min(member.spends.length, 10)} of {member.spends.length}
            </span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {member.spends.slice(0, 10).map((spend) => {
              const amount = spend.amount ? formatUnits(BigInt(spend.amount), 6) : '0';
              const date = new Date(Number(spend.timestamp) * 1000);
              const timeAgo = getTimeAgo(date);
              
              return (
                <div
                  key={spend.id}
                  className="flex items-start justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Paid to
                      </span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {spend.recipient || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                      <span>{date.toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{date.toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{timeAgo}</span>
                    </div>
                    {spend.budgetLimit && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">Budget:</span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          ${formatUnits(BigInt(spend.budgetLimit), 6)}
                        </span>
                        {spend.budgetPeriod && (
                          <>
                            <span className="text-xs text-zinc-500 dark:text-zinc-500">/</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-500">
                              {Math.floor(Number(spend.budgetPeriod) / 86400)} days
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {spend.token && (
                      <div className="mt-1">
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">Token: </span>
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {spend.token.slice(0, 8)}...{spend.token.slice(-6)}
                        </span>
                      </div>
                    )}
                    {spend.blockNumber && (
                      <div className="mt-1">
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">Block: </span>
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {spend.blockNumber}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      -${parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${spend.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View TX →
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

