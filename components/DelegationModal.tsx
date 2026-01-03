'use client';

import { useState } from 'react';
import { createWalletClient, custom, parseUnits, type Address } from 'viem';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';
import { sepolia as chain } from 'viem/chains';

interface DelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberAddress: string;
  memberName?: string;
}

// USDC address on Ethereum Sepolia
const USDC_ADDRESS: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const DELEGATION_MANAGER: Address = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';

export default function DelegationModal({
  isOpen,
  onClose,
  memberAddress,
  memberName,
}: DelegationModalProps) {
  const [amount, setAmount] = useState('');
  const [periodDuration, setPeriodDuration] = useState('');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDelegation = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    if (!amount || !periodDuration || !justification) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const walletClient = createWalletClient({
        transport: custom(window.ethereum),
      }).extend(erc7715ProviderActions());

      const currentTime = Math.floor(Date.now() / 1000);
      // 1 week from now
      const expiry = currentTime + 604800;

      // Parse amount (USDC has 6 decimals)
      const periodAmount = parseUnits(amount, 6);
      // Parse period duration (convert days to seconds if needed)
      const periodDurationSeconds = parseInt(periodDuration) * 86400; // Assuming input is in days

      const grantedPermissions = await walletClient.requestExecutionPermissions([
        {
          chainId: chain.id,
          expiry,
          signer: {
            type: 'account',
            data: {
              // The requested permissions will be granted to the member's smart account
              address: memberAddress as Address,
            },
          },
          permission: {
            type: 'erc20-token-periodic',
            data: {
              tokenAddress: USDC_ADDRESS,
              periodAmount,
              periodDuration: periodDurationSeconds,
              justification,
            },
          },
          isAdjustmentAllowed: true,
        },
      ]);

      console.log('Granted Permissions:', grantedPermissions);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setAmount('');
        setPeriodDuration('');
        setJustification('');
      }, 2000);
    } catch (err: any) {
      console.error('Error requesting delegation:', err);
      setError(err.message || 'Failed to create delegation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError('');
      setSuccess(false);
      setAmount('');
      setPeriodDuration('');
      setJustification('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Delegate USDC
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {memberName && (
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Delegating to: <span className="font-medium">{memberName}</span>
          </p>
        )}

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Member Address: <span className="font-mono text-xs">{memberAddress}</span>
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
            Delegation created successfully!
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Amount per Period (USDC)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.000001"
              min="0"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              placeholder="10.0"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              Amount in USDC that can be transferred per period
            </p>
          </div>

          <div>
            <label
              htmlFor="periodDuration"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Period Duration (Days)
            </label>
            <input
              type="number"
              id="periodDuration"
              value={periodDuration}
              onChange={(e) => setPeriodDuration(e.target.value)}
              min="1"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              placeholder="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              How often this delegation can be used (in days)
            </p>
          </div>

          <div>
            <label
              htmlFor="justification"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Justification
            </label>
            <textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              placeholder="Permission to transfer USDC for family expenses"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              Reason for this delegation
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelegation}
              disabled={loading || !amount || !periodDuration || !justification}
              className="flex-1 rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {loading ? 'Creating Delegation...' : 'Create Delegation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

