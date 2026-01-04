'use client';

import { useState } from 'react';
import { createPublicClient, createWalletClient, http, parseUnits, type Address, encodeFunctionData, erc20Abi } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions';
import { sepolia, mainnet, base, optimism } from 'viem/chains';
import { getStoredSessionAccount } from '@/lib/session-account';
import { privateKeyToAccount } from 'viem/accounts';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import { acrossSwap, CHAIN_IDS, USDC_ADDRESSES } from '@/lib/swap';

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
  defaultRecipient?: string;
  defaultAmount?: string;
}

// USDC address on Ethereum Sepolia
const USDC_ADDRESS: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

export default function PaymentModal({
  isOpen,
  onClose,
  delegation,
  defaultRecipient,
  defaultAmount,
}: PaymentModalProps) {
  const [recipientAddress, setRecipientAddress] = useState(defaultRecipient || '');
  const [amount, setAmount] = useState(defaultAmount || '');
  const [destinationChain, setDestinationChain] = useState<number>(CHAIN_IDS.ETH_SEPOLIA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<'delegating' | 'swapping' | 'complete'>('delegating');

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
    setStep('delegating');

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
      console.log('Smart Account:', sessionAccount.smartAccountAddress);
      console.log('Delegator:', delegator);
      console.log('Destination Chain:', destinationChain);

      // Create account from private key stored in localStorage
      const signerAccount = privateKeyToAccount(sessionAccount.privateKey);
      const eoaAddress = signerAccount.address;

      // Pimlico RPC URL (for sending transactions - bundler endpoint)
      const pimlicoRpcUrl = 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
      
      // Standard RPC URL for reading chain data
      const standardRpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';

      // Create public client for Sepolia
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(standardRpcUrl),
      });

      // Recreate the Smart Account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [signerAccount.address, [], [], []],
        deploySalt: '0x',
        signer: { account: signerAccount },
      });

      if (smartAccount.address.toLowerCase() !== sessionAccount.smartAccountAddress.toLowerCase()) {
        throw new Error('Smart Account address mismatch. Please rejoin the room to regenerate your session account.');
      }

      // Create bundler client
      const bundlerClient = createBundlerClient({
        client: publicClient,
        transport: http(pimlicoRpcUrl),
        paymaster: true,
      }).extend(erc7710BundlerActions());

      const permissionsContext = delegation.permissions_context as `0x${string}`;
      const delegationManager = delegator;

      // Get gas prices from Pimlico
      let maxFeePerGas: bigint;
      let maxPriorityFeePerGas: bigint;
      
      try {
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
          maxFeePerGas = BigInt(gasPriceData.result.maxFeePerGas);
          maxPriorityFeePerGas = BigInt(gasPriceData.result.maxPriorityFeePerGas);
        } else {
          throw new Error('Failed to get gas prices from Pimlico');
        }
      } catch (err: any) {
        console.warn('Failed to get gas prices from Pimlico, using fallback:', err);
        maxFeePerGas = BigInt(2000000000);
        maxPriorityFeePerGas = BigInt(1000000000);
      }

      // Check if destination is ETH Sepolia
      if (destinationChain === CHAIN_IDS.ETH_SEPOLIA) {
        // Direct transfer from smart account to recipient (no swap, no EOA delegation needed)
        console.log('=== Direct Transfer (ETH Sepolia - No Swap Needed) ===');
        const directCalldata = encodeFunctionData({
          abi: erc20Abi,
          args: [recipientAddress as Address, parseUnits(amount, 6)],
          functionName: 'transfer',
        });

        const directUserOpHash = await bundlerClient.sendUserOperationWithDelegation({
          publicClient,
          account: smartAccount,
          calls: [
            {
              to: delegation.token_address as Address,
              data: directCalldata,
              permissionsContext,
              delegationManager,
            },
          ],
          maxFeePerGas,
          maxPriorityFeePerGas,
        });

        const directReceipt = await bundlerClient.waitForUserOperationReceipt({
          hash: directUserOpHash,
        });

        console.log('=== Direct Transfer Complete ===');
        setTxHash(directReceipt.receipt.transactionHash);
        setSuccess(true);
        setStep('complete');
      } else {
        // For other chains: First delegate to EOA, then swap
        // STEP 1: Delegate amount from smart account to EOA
        console.log('=== Step 1: Delegating from Smart Account to EOA ===');
        const delegateCalldata = encodeFunctionData({
          abi: erc20Abi,
          args: [eoaAddress as Address, parseUnits(amount, 6)],
          functionName: 'transfer',
        });

        const delegateUserOpHash = await bundlerClient.sendUserOperationWithDelegation({
          publicClient,
          account: smartAccount,
          calls: [
            {
              to: delegation.token_address as Address,
              data: delegateCalldata,
              permissionsContext,
              delegationManager,
            },
          ],
          maxFeePerGas,
          maxPriorityFeePerGas,
        });

        const delegateReceipt = await bundlerClient.waitForUserOperationReceipt({
          hash: delegateUserOpHash,
        });

        console.log('=== Delegation to EOA Complete ===');
        console.log('Transaction Hash:', delegateReceipt.receipt.transactionHash);

        // STEP 2: Perform swap from EOA to recipient on destination chain
        // Perform swap from EOA to recipient on destination chain
        console.log('=== Step 2: Performing Swap ===');
        setStep('swapping');

        // Get the appropriate chain object
        let destinationChainObj;
        let destinationRpcUrl;
        
        switch (destinationChain) {
          case CHAIN_IDS.ETH_MAINNET:
            destinationChainObj = mainnet;
            destinationRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            break;
          case CHAIN_IDS.BASE_MAINNET:
            destinationChainObj = base;
            destinationRpcUrl = 'https://base-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            break;
          case CHAIN_IDS.OPTIMISM_MAINNET:
            destinationChainObj = optimism;
            destinationRpcUrl = 'https://opt-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            break;
          default:
            throw new Error('Unsupported destination chain');
        }

        // Get token addresses
        const originToken = USDC_ADDRESSES[CHAIN_IDS.ETH_SEPOLIA];
        const destinationToken = USDC_ADDRESSES[destinationChain];
        
        if (!destinationToken) {
          throw new Error(`Could not find USDC address for destination chain ${destinationChain}`);
        }

        // Create wallet and public clients for Sepolia (origin)
        const originWalletClient = createWalletClient({
          account: signerAccount,
          chain: sepolia,
          transport: http(standardRpcUrl),
        });

        const originPublicClient = createPublicClient({
          chain: sepolia,
          transport: http(standardRpcUrl),
        });

        // Perform swap
        const swapTxHash = await acrossSwap(
          originWalletClient,
          originPublicClient,
          {
            amount,
            inputToken: originToken,
            outputToken: destinationToken,
            originChainId: CHAIN_IDS.ETH_SEPOLIA,
            destinationChainId: destinationChain,
            depositor: eoaAddress,
            recipient: recipientAddress as Address,
          }
        );

        // Wait for swap transaction
        await originPublicClient.waitForTransactionReceipt({ hash: swapTxHash });

        console.log('=== Swap Complete ===');
        setTxHash(swapTxHash);
        setSuccess(true);
        setStep('complete');
      }
    } catch (err: any) {
      console.error('Error executing payment:', err);
      setError(err.message || 'Failed to execute payment. Please try again.');
      setStep('delegating');
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

            <div>
              <label
                htmlFor="destinationChain"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Destination Chain
              </label>
              <select
                id="destinationChain"
                value={destinationChain}
                onChange={(e) => setDestinationChain(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                disabled={loading}
              >
                <option value={CHAIN_IDS.ETH_SEPOLIA}>Ethereum Sepolia</option>
                <option value={CHAIN_IDS.ETH_MAINNET}>Ethereum Mainnet</option>
                <option value={CHAIN_IDS.BASE_MAINNET}>Base Mainnet</option>
                <option value={CHAIN_IDS.OPTIMISM_MAINNET}>Optimism Mainnet</option>
              </select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {destinationChain === CHAIN_IDS.ETH_SEPOLIA 
                  ? 'Direct transfer (no swap needed)' 
                  : 'Will perform cross-chain swap'}
              </p>
            </div>

            {loading && (
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {destinationChain === CHAIN_IDS.ETH_SEPOLIA 
                    ? 'Sending payment directly...'
                    : step === 'delegating' 
                      ? 'Step 1/2: Delegating funds to your wallet...'
                      : 'Step 2/2: Performing cross-chain swap...'}
                </p>
              </div>
            )}

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

