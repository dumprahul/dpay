'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStoredSessionAccount } from '@/lib/session-account';
import { getDelegationsWithDetails } from '@/lib/delegations';
import PaymentModal from '@/components/PaymentModal';
import MemberAnalytics from '@/components/MemberAnalytics';
import type { Delegation } from '@/lib/database.types';
import type QrScannerType from 'qr-scanner';

const CHAIN_ID = 11155111; // Sepolia

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
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [sessionAccountAddress, setSessionAccountAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [delegations, setDelegations] = useState<DelegationWithDetails[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  const [error, setError] = useState('');
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    delegation: DelegationWithDetails | null;
  }>({
    isOpen: false,
    delegation: null,
  });
  const [scanModal, setScanModal] = useState<{
    isOpen: boolean;
    delegation: DelegationWithDetails | null;
  }>({
    isOpen: false,
    delegation: null,
  });
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedPaymentData, setScannedPaymentData] = useState<{
    amount: string;
    recipient: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScannerType | null>(null);

  useEffect(() => {
    loadSessionAccount();
  }, []);

  useEffect(() => {
    if (smartAccountAddress) {
      loadDelegations();
    } else {
      setDelegations([]);
    }
  }, [smartAccountAddress]);

  // Cleanup QR scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      }
    };
  }, []);

  const loadSessionAccount = () => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    try {
      const sessionAccount = getStoredSessionAccount();
      if (sessionAccount) {
        setSmartAccountAddress(sessionAccount.smartAccountAddress);
        setSessionAccountAddress(sessionAccount.address);
      }
    } catch (err) {
      console.error('Error loading session account:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDelegations = async () => {
    if (!smartAccountAddress) return;

    setLoadingDelegations(true);
    setError('');

    try {
      const data = await getDelegationsWithDetails(smartAccountAddress);
      setDelegations(data || []);
    } catch (err: any) {
      console.error('Error loading delegations:', err);
      setError(err.message || 'Failed to load delegations. Please try again.');
    } finally {
      setLoadingDelegations(false);
    }
  };

  const handleScanAndPay = (delegation: DelegationWithDetails) => {
    // Open the scan modal first
    setScanModal({ isOpen: true, delegation });
    setScanning(false);
    setScanError('');
    setScannedPaymentData(null);
  };

  const startScanning = async (delegation: DelegationWithDetails) => {
    if (!videoRef.current) {
      setScanError('Video element not available');
      return;
    }

    try {
      setScanError('');
      setScanning(true);

      // Import QrScanner dynamically
      const QrScanner = (await import('qr-scanner')).default;

      // Create QR scanner instance
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          try {
            const parsed = JSON.parse(result.data) as {
              recipient: string;
              amount: string;
            };
            
            // Validate the parsed data has required fields
            if (!parsed.recipient || !parsed.amount) {
              setScanError('Invalid QR code format. Missing recipient or amount.');
              qrScanner.stop();
              return;
            }

            // Validate recipient address format
            if (!parsed.recipient.startsWith('0x') || parsed.recipient.length !== 42) {
              setScanError('Invalid recipient address format in QR code.');
              qrScanner.stop();
              return;
            }

            // Validate amount
            if (isNaN(parseFloat(parsed.amount)) || parseFloat(parsed.amount) <= 0) {
              setScanError('Invalid amount in QR code.');
              qrScanner.stop();
              return;
            }

            setScannedPaymentData(parsed);
            setScanning(false);
            qrScanner.stop();
            qrScanner.destroy();
            qrScannerRef.current = null;
            
            // Close scan modal and automatically open payment modal with scanned data
            // The payment will be executed automatically
            setScanModal({ isOpen: false, delegation: null });
            setPaymentModal({
              isOpen: true,
              delegation: delegation,
            });
          } catch (err) {
            setScanError('Invalid QR code format. Please scan a valid payment QR code.');
            qrScanner.stop();
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      qrScannerRef.current = qrScanner;
      await qrScanner.start();
    } catch (err: any) {
      console.error('Error starting QR scanner:', err);
      setScanError(err.message || 'Failed to start camera. Please check permissions.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setScanning(false);
    setScanModal({ isOpen: false, delegation: null });
    setScanError('');
    setScannedPaymentData(null);
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

  if (!smartAccountAddress) {
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
                No Session Account Found
              </h2>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                You need to join a room first to create your session account and smart account.
              </p>
              <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-500">
                When you join a room, a smart account will be automatically created for you. 
                Once you receive delegations, they will appear here.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/join"
                  className="rounded-lg bg-black px-6 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  Join a Room
                </Link>
                <Link
                  href="/"
                  className="rounded-lg border border-zinc-300 bg-white px-6 py-3 text-center font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
      <main className="flex w-full max-w-6xl flex-col px-8 py-16">
        <div className="w-full space-y-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50"
            >
              Dpay
            </Link>
            <Link
              href="/join"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Join Room
            </Link>
          </div>

          {/* Member Analytics - Show spending data from indexer */}
          {delegations.length > 0 && delegations[0]?.room_members?.rooms?.owner_address && (
            <MemberAnalytics
              chainId={CHAIN_ID}
              vaultAddress={delegations[0].room_members.rooms.owner_address}
              memberAddress={smartAccountAddress}
            />
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6">
              <h2 className="text-3xl font-semibold text-black dark:text-zinc-50">
                My Delegations
              </h2>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Smart Account: <span className="font-mono text-xs">{formatAddress(smartAccountAddress)}</span>
                </p>
                {sessionAccountAddress && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Session EOA: <span className="font-mono">{formatAddress(sessionAccountAddress)}</span>
                  </p>
                )}
              </div>
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

                      {/* Pay Buttons */}
                      <div className="pt-4 flex gap-3">
                        <button
                          onClick={() => {
                            setPaymentModal({
                              isOpen: true,
                              delegation: delegation,
                            });
                          }}
                          className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                        >
                          Pay
                        </button>
                        <button
                          onClick={() => handleScanAndPay(delegation)}
                          className="flex-1 rounded-lg border border-green-600 bg-white px-4 py-3 font-medium text-green-600 transition-colors hover:bg-green-50 dark:border-green-500 dark:bg-zinc-800 dark:text-green-400 dark:hover:bg-zinc-700"
                        >
                          Scan & Pay
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {paymentModal.delegation && (
        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => {
            setPaymentModal({ isOpen: false, delegation: null });
            setScannedPaymentData(null);
          }}
          delegation={paymentModal.delegation}
          defaultRecipient={scannedPaymentData?.recipient}
          defaultAmount={scannedPaymentData?.amount}
        />
      )}

      {/* Scan Modal */}
      {scanModal.isOpen && scanModal.delegation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                Scan QR Code
              </h2>
              <button
                onClick={stopScanning}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            {scanError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {scanError}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ minHeight: '300px', maxHeight: '400px' }}
                  playsInline
                />
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white rounded-lg w-64 h-64 shadow-lg"></div>
                  </div>
                )}
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    <p className="text-white">Camera not started</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {!scanning ? (
                  <button
                    onClick={() => {
                      if (scanModal.delegation) {
                        startScanning(scanModal.delegation);
                      }
                    }}
                    className="flex-1 rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    Start Camera
                  </button>
                ) : (
                  <button
                    onClick={stopScanning}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Stop Scanning
                  </button>
                )}
                <button
                  onClick={stopScanning}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

