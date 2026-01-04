'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import PaymentModal from '@/components/PaymentModal';
import { getStoredSessionAccount } from '@/lib/session-account';
import { getDelegationsWithDetails } from '@/lib/delegations';

// Dynamically import QR scanner to avoid SSR issues
const QrScanner = dynamic(() => import('qr-scanner'), { ssr: false });

interface PaymentData {
  recipient: string;
  amount: string;
}

export default function WhilePayingPage() {
  const searchParams = useSearchParams();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  // Check if payment data is in URL params
  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const decoded = decodeURIComponent(dataParam);
        const parsed = JSON.parse(decoded) as PaymentData;
        // Handle both old format (with chain/token) and new format (only recipient/amount)
        if (parsed.recipient && parsed.amount) {
          setPaymentData({
            recipient: parsed.recipient,
            amount: parsed.amount,
          });
        } else {
          setError('Invalid payment data in URL');
        }
      } catch (err) {
        setError('Invalid payment data in URL');
      }
    }
  }, [searchParams]);

  const startScanning = async () => {
    if (!videoRef.current) return;

    try {
      setError('');
      setScanning(true);

      // Import QrScanner dynamically
      const QrScanner = (await import('qr-scanner')).default;

      // Create QR scanner instance
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          try {
            const parsed = JSON.parse(result.data) as PaymentData;
            setPaymentData(parsed);
            setScanning(false);
            qrScanner.stop();
            qrScanner.destroy();
            qrScannerRef.current = null;
          } catch (err) {
            setError('Invalid QR code format. Please scan a valid payment QR code.');
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
      setError(err.message || 'Failed to start camera. Please check permissions.');
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
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDelegation, setSelectedDelegation] = useState<any>(null);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);

  // Load delegations when payment data is available
  useEffect(() => {
    const loadDelegations = async () => {
      if (!paymentData) return;

      const sessionAccount = getStoredSessionAccount();
      if (!sessionAccount) return;

      setLoadingDelegations(true);
      try {
        const data = await getDelegationsWithDetails(sessionAccount.smartAccountAddress);
        setDelegations(data || []);
      } catch (err) {
        console.error('Error loading delegations:', err);
      } finally {
        setLoadingDelegations(false);
      }
    };

    loadDelegations();
  }, [paymentData]);

  const handlePay = async () => {
    if (!paymentData) return;

    // Check if user has a session account
    const sessionAccount = getStoredSessionAccount();
    if (!sessionAccount) {
      setError('Please join a room first to create a session account.');
      return;
    }

    // Find a delegation that matches the payment requirements
    // Look for a delegation with the same token and recipient (owner)
    const matchingDelegation = delegations.find((del) => {
      const tokenMatches = del.token_address.toLowerCase() === 
        (paymentData.token === 'USDC' ? '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' : '').toLowerCase();
      const recipientMatches = del.room_members?.rooms?.owner_address?.toLowerCase() === 
        paymentData.recipient.toLowerCase();
      return tokenMatches && recipientMatches;
    });

    if (!matchingDelegation) {
      setError(
        `No delegation found for ${paymentData.token} payments to ${paymentData.recipient.slice(0, 10)}... ` +
        'Please ensure you have a delegation from this recipient.'
      );
      return;
    }

    setSelectedDelegation(matchingDelegation);
    setShowPaymentModal(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 md:p-8">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Scan & Pay
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Scan a payment QR code to view details and pay
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {!paymentData && !scanning && (
            <div className="space-y-4">
              <button
                onClick={startScanning}
                className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Scan QR Code
              </button>
            </div>
          )}

          {scanning && (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
                  style={{ maxHeight: '400px' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white rounded-lg w-64 h-64"></div>
                </div>
              </div>
              <button
                onClick={stopScanning}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Stop Scanning
              </button>
            </div>
          )}

          {paymentData && !scanning && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-6">
                <h2 className="text-xl font-semibold text-black dark:text-white mb-4">
                  Payment Details
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Amount:</span>
                    <span className="font-medium text-black dark:text-white">
                      {paymentData.amount} USDC
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-zinc-600 dark:text-zinc-400">Recipient:</span>
                    <span className="font-mono text-sm text-black dark:text-white text-right break-all">
                      {paymentData.recipient}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentData(null)}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {loading ? 'Processing...' : 'Pay'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedDelegation && paymentData && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedDelegation(null);
          }}
          delegation={selectedDelegation}
          defaultRecipient={paymentData.recipient}
          defaultAmount={paymentData.amount}
        />
      )}
    </div>
  );
}

