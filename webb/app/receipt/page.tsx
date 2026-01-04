'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentData {
  chain: string;
  token: string;
  amount: string;
  recipient: string;
}

export default function ReceiptPage() {
  const [chain, setChain] = useState('sepolia');
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleGenerateQR = () => {
    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!recipient.trim() || !recipient.startsWith('0x') || recipient.length !== 42) {
      setError('Please enter a valid wallet address');
      return;
    }

    setError('');

    // Create payment data object
    const paymentData: PaymentData = {
      chain,
      token,
      amount,
      recipient: recipient.trim(),
    };

    // Encode as JSON string for QR code
    const encodedData = JSON.stringify(paymentData);
    setQrData(encodedData);
  };

  const handleCopyLink = () => {
    if (!qrData) return;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/whilepaying?data=${encodeURIComponent(qrData)}`;
    
    navigator.clipboard.writeText(link);
    alert('Payment link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 md:p-8">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Create Payment Receipt
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Generate a QR code for customers to scan and pay
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Chain Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Chain
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              >
                <option value="sepolia">Sepolia (Testnet)</option>
                <option value="ethereum">Ethereum (Mainnet)</option>
                <option value="polygon">Polygon</option>
                <option value="base">Base</option>
              </select>
            </div>

            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Token
              </label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              >
                <option value="USDC">USDC</option>
                <option value="USDT">USDT</option>
                <option value="DAI">DAI</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.000001"
                min="0"
                placeholder="10.0"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              />
            </div>

            {/* Recipient Wallet Address */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Your Wallet Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              />
            </div>

            {/* Generate QR Button */}
            <button
              onClick={handleGenerateQR}
              className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Generate QR Code
            </button>

            {/* QR Code Display */}
            {qrData && (
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-semibold text-black dark:text-white mb-4">
                  Payment QR Code
                </h2>
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <QRCodeSVG value={qrData} size={256} level="H" />
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white underline"
                  >
                    Copy Payment Link
                  </button>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 text-center max-w-md">
                    <p className="font-medium mb-1">Payment Details:</p>
                    <p>Chain: {chain}</p>
                    <p>Token: {token}</p>
                    <p>Amount: {amount}</p>
                    <p className="font-mono break-all">Recipient: {recipient}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

