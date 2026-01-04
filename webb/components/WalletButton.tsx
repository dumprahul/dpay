'use client';

import { useState, useEffect } from 'react';
import type { Address } from 'viem';

export default function WalletButton() {
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if wallet is already connected
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0] as Address);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0] as Address);
        // Store wallet address in localStorage for persistence
        localStorage.setItem('walletAddress', accounts[0]);
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    localStorage.removeItem('walletAddress');
  };

  const formatAddress = (addr: Address) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
          {formatAddress(address)}
        </span>
        <button
          onClick={disconnectWallet}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={connectWallet}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            Connecting...
          </>
        ) : (
          <>
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22 10.97V13.03C22 13.58 21.56 14.03 21 14.05H19.04C17.96 14.05 16.97 13.26 16.88 12.18C16.82 11.55 17.12 10.96 17.65 10.59L18.36 10.11C19.04 9.62005 19.21 8.66005 18.71 7.98005C18.36 7.55005 17.85 7.33005 17.3 7.33005H15C14.59 7.33005 14.25 6.99005 14.25 6.58005C14.25 6.17005 14.59 5.83005 15 5.83005H17.3C18.41 5.83005 19.42 6.35005 20.05 7.20005C20.85 8.28005 20.8 9.67005 19.94 10.71L19.23 11.19C19.65 11.29 20.02 11.58 20.23 12.01L20.95 13.44C21.24 14.01 21.19 14.66 20.82 15.19C20.23 16.05 19.24 16.51 18.26 16.37L16.75 16.13C16.13 16.01 15.78 15.37 16.05 14.82C16.26 14.41 16.68 14.15 17.13 14.15H21C21.56 14.13 22 13.58 22 13.03V10.97Z"
                fill="currentColor"
              />
              <path
                d="M7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10Z"
                fill="currentColor"
              />
              <path
                d="M13 12C13 10.9 13.9 10 15 10C16.1 10 17 10.9 17 12C17 13.1 16.1 14 15 14C13.9 14 13 13.1 13 12Z"
                fill="currentColor"
              />
              <path
                d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C17.93 1.25 22.75 6.07 22.75 12C22.75 17.93 17.93 22.75 12 22.75ZM12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 6.9 17.1 2.75 12 2.75Z"
                fill="currentColor"
              />
            </svg>
            Connect Wallet
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

