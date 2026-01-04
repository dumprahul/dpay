'use client';

import { useState } from 'react';
import { createPublicClient, http, parseUnits, type Address, encodeFunctionData, erc20Abi } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions';
import { sepolia as chain } from 'viem/chains';
import { getStoredSessionAccount } from '@/lib/session-account';
import { privateKeyToAccount } from 'viem/accounts';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  delegation: {
    id: string;
    permissions_context: string;
    delegation_manager: string;
    token_address: string;
    period_duration: number;
    room_members?: {
      rooms?: {
        owner_address: string;
      };
    };
  };
}

// USDC address on Ethereum Sepolia
const USDC_ADDRESS: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

export default function PaymentModal({
  isOpen,
  onClose,
  delegation,
}: PaymentModalProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayment = async () => {
    if (!recipientAddress.trim() || !amount.trim()) {
      setError('Please fill in all fields');
      return;
    }

    // Validate recipient address
    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      setError('Please enter a valid wallet address');
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get session account from localStorage
      const sessionAccount = getStoredSessionAccount();
      if (!sessionAccount) {
        throw new Error('Session account not found. Please join a room first.');
      }

      // Get the delegator (delegation_manager) address
      const delegator = delegation.delegation_manager as Address;
      
      console.log('=== Session Account Details ===');
      console.log('Session EOA:', sessionAccount.address);
      console.log('Smart Account (sessionAccount):', sessionAccount.smartAccountAddress);
      console.log('Delegator (delegation_manager):', delegator);

      // Create account from private key stored in localStorage
      // This account will be used to sign the transaction
      const signerAccount = privateKeyToAccount(sessionAccount.privateKey);
      console.log('Signer Account (from private key):', signerAccount.address);
      console.log('Using private key from localStorage for signing - NO MetaMask needed');

      // Pimlico RPC URL (for sending transactions - bundler endpoint)
      const pimlicoRpcUrl = 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
      
      // Standard RPC URL for reading chain data (nonce, gas price, etc.)
      // Pimlico is a bundler and doesn't support standard RPC methods like eth_getTransactionCount
      // So we use Alchemy for reading chain data
      const standardRpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';

      // Create public client for reading chain data (nonce, gas price, etc.)
      // Use standard RPC endpoint (Alchemy) for these operations
      const publicClient = createPublicClient({
        chain,
        transport: http(standardRpcUrl),
      });

      // Recreate the Smart Account from the stored session account data
      // The Smart Account was already created when the member joined the room
      // We just need to recreate the smart account object using the same parameters
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [signerAccount.address, [], [], []],
        deploySalt: '0x',
        signer: { account: signerAccount },
      });

      console.log('Smart Account recreated:', smartAccount.address);
      console.log('Smart Account matches stored:', smartAccount.address.toLowerCase() === sessionAccount.smartAccountAddress.toLowerCase());
      
      // Verify the smart account address matches what's stored
      if (smartAccount.address.toLowerCase() !== sessionAccount.smartAccountAddress.toLowerCase()) {
        throw new Error('Smart Account address mismatch. Please rejoin the room to regenerate your session account.');
      }

      // Create bundler client for ERC-7710 delegation transactions
      // Using Pimlico bundler endpoint with paymaster support
      const bundlerClient = createBundlerClient({
        client: publicClient,
        transport: http(pimlicoRpcUrl),
        paymaster: true, // Allows you to use the same Bundler Client as paymaster
      }).extend(erc7710BundlerActions());

      // Encode ERC20 transfer function call
      // USDC on Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
      const calldata = encodeFunctionData({
        abi: erc20Abi,
        args: [recipientAddress as Address, parseUnits(amount, 6)], // USDC has 6 decimals
        functionName: 'transfer',
      });

      console.log('=== Sending Transaction with Delegation ===');
      console.log('Token Address (USDC Sepolia):', delegation.token_address);
      console.log('Recipient:', recipientAddress);
      console.log('Amount:', amount, 'USDC');
      console.log('Calldata:', calldata);
      console.log('Session Account (Smart Account):', sessionAccount.smartAccountAddress);
      console.log('Delegation Manager:', delegator);
      console.log('Permissions Context length:', delegation.permissions_context.length);

      // Prepare parameters for sendUserOperationWithDelegation
      // These properties must be extracted from the permission response (stored in database)
      const permissionsContext = delegation.permissions_context as `0x${string}`;
      const delegationManager = delegator;

      // Get gas prices for the user operation from Pimlico
      // Pimlico requires using their gas price estimation method
      console.log('=== Getting Gas Prices from Pimlico ===');
      let maxFeePerGas: bigint;
      let maxPriorityFeePerGas: bigint;
      
      try {
        // Use Pimlico's gas price estimation
        const gasPriceResponse = await fetch(pimlicoRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pimlico_getUserOperationGasPrice',
            params: [],
          }),
        });
        
        const gasPriceData = await gasPriceResponse.json();
        
        if (gasPriceData.result) {
          // Pimlico returns gas prices in wei
          maxFeePerGas = BigInt(gasPriceData.result.maxFeePerGas);
          maxPriorityFeePerGas = BigInt(gasPriceData.result.maxPriorityFeePerGas);
          console.log('Pimlico Gas Prices:', {
            maxFeePerGas: maxFeePerGas.toString(),
            maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
          });
        } else {
          throw new Error('Failed to get gas prices from Pimlico');
        }
      } catch (err: any) {
        console.warn('Failed to get gas prices from Pimlico, using fallback:', err);
        // Fallback: use a higher gas price to ensure it's accepted
        // The error said minimum is 1100009, so use at least that
        maxFeePerGas = BigInt(2000000000); // 2 gwei (higher than minimum)
        maxPriorityFeePerGas = BigInt(1000000000); // 1 gwei
      }

      console.log('=== sendUserOperationWithDelegation Parameters ===');
      console.log('Smart Account:', smartAccount.address);
      console.log('to (Token Address):', delegation.token_address);
      console.log('data (Calldata):', calldata);
      console.log('data length:', calldata.length);
      console.log('permissionsContext length:', permissionsContext.length);
      console.log('permissionsContext (first 200 chars):', permissionsContext.slice(0, 200) + '...');
      console.log('delegationManager:', delegationManager);
      console.log('maxFeePerGas:', maxFeePerGas.toString());
      console.log('maxPriorityFeePerGas:', maxPriorityFeePerGas.toString());

      // Send user operation with delegation using bundler client
      // Calls without permissionsContext and delegationManager will be executed as a normal user operation
      console.log('=== Sending User Operation with Delegation ===');
      console.log('The transaction will be signed with the private key from localStorage');
      console.log('and sent as a user operation through the Pimlico bundler');
      
      const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({
        publicClient,
        account: smartAccount, // Smart Account that has the delegated permissions
        calls: [
          {
            to: delegation.token_address as Address,
            data: calldata,
            permissionsContext,
            delegationManager,
          },
        ],
        // Appropriate values must be used for fee-per-gas
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      console.log('=== User Operation Submitted ===');
      console.log('User Operation Hash:', userOperationHash);
      console.log('Waiting for user operation to be included in a transaction...');

      // Wait for the user operation to be included in a transaction
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
      });

      console.log('=== User Operation Receipt Received ===');
      console.log('Transaction Hash:', receipt.receipt.transactionHash);
      console.log('Block Number:', receipt.receipt.blockNumber);

      // Get the transaction hash from the receipt
      const transactionHash = receipt.receipt.transactionHash;

      console.log('=== Transaction Successful ===');
      console.log('Transaction Hash:', transactionHash);
      console.log('View on Etherscan:', `https://sepolia.etherscan.io/tx/${transactionHash}`);
      
      setTxHash(transactionHash);
      setSuccess(true);
    } catch (err: any) {
      console.error('Error executing payment:', err);
      setError(err.message || 'Failed to execute payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError('');
      setSuccess(false);
      setRecipientAddress('');
      setAmount('');
      setTxHash(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Pay with Delegation
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
            <p className="font-medium">Payment executed successfully!</p>
            {txHash && (
              <div className="mt-2 space-y-1">
                <p className="font-mono text-xs break-all">
                  Transaction Hash: {txHash}
                </p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline hover:text-green-700 dark:hover:text-green-300"
                >
                  View on Etherscan →
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(txHash);
                    alert('Transaction hash copied!');
                  }}
                  className="ml-2 text-xs underline hover:text-green-700 dark:hover:text-green-300"
                >
                  Copy Hash
                </button>
              </div>
            )}
          </div>
        )}

        {!success ? (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="recipient"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Recipient Wallet Address
              </label>
              <input
                type="text"
                id="recipient"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                placeholder="0x..."
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Amount (USDC)
              </label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.000001"
                min="0"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                placeholder="1.0"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                Amount in USDC to transfer
              </p>
            </div>

            <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Delegation Details
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Period: {Math.floor(delegation.period_duration / 86400)} day(s)
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Token: {delegation.token_address.slice(0, 10)}...
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
                onClick={handlePayment}
                disabled={loading || !recipientAddress || !amount}
                className="flex-1 rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {loading ? 'Processing...' : 'Pay'}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4">
            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

