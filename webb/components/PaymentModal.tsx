'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, parseUnits, type Address, encodeFunctionData, erc20Abi } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions';
import { sepolia, mainnet, base, optimism, arbitrum } from 'viem/chains';
import { getStoredSessionAccount } from '@/lib/session-account';
import { privateKeyToAccount } from 'viem/accounts';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import { acrossSwap, CHAIN_IDS, getTokenAddress, getChainsForNetwork, getOriginChainsForNetwork, getChainName, type NetworkType, type TokenType } from '@/lib/swap';

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

export default function PaymentModal({
  isOpen,
  onClose,
  delegation,
  defaultRecipient,
  defaultAmount,
}: PaymentModalProps) {
  const [recipientAddress, setRecipientAddress] = useState(defaultRecipient || '');
  const [amount, setAmount] = useState(defaultAmount || '');
  const [network, setNetwork] = useState<NetworkType>('testnet');
  const [token, setToken] = useState<TokenType>('USDC');
  const [originChain, setOriginChain] = useState<number>(CHAIN_IDS.ETH_SEPOLIA);
  const [destinationChain, setDestinationChain] = useState<number>(CHAIN_IDS.ETH_SEPOLIA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<'delegating' | 'swapping' | 'complete'>('delegating');
  
  // Update state when default values change (pre-fill from scanned QR code)
  useEffect(() => {
    if (defaultRecipient) setRecipientAddress(defaultRecipient);
    if (defaultAmount) setAmount(defaultAmount);
  }, [defaultRecipient, defaultAmount]);

  // Update origin and destination chains when network changes
  useEffect(() => {
    const availableOriginChains = getOriginChainsForNetwork(network);
    const availableDestinationChains = getChainsForNetwork(network);
    
    if (availableOriginChains.length > 0 && !availableOriginChains.includes(originChain)) {
      setOriginChain(availableOriginChains[0]);
    }
    
    if (availableDestinationChains.length > 0 && !availableDestinationChains.includes(destinationChain)) {
      setDestinationChain(availableDestinationChains[0]);
    }
  }, [network, originChain, destinationChain]);

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

      // Get origin chain object based on selected origin chain
      let originChainObj;
      switch (originChain) {
        case CHAIN_IDS.ETH_SEPOLIA:
          originChainObj = sepolia;
          break;
        case CHAIN_IDS.ETH_MAINNET:
          originChainObj = mainnet;
          break;
        case CHAIN_IDS.BASE_SEPOLIA:
        case CHAIN_IDS.BASE_MAINNET:
          originChainObj = base;
          break;
        case CHAIN_IDS.ARBITRUM_SEPOLIA:
        case CHAIN_IDS.ARBITRUM_MAINNET:
          originChainObj = arbitrum;
          break;
        default:
          originChainObj = network === 'testnet' ? sepolia : mainnet;
      }
      
      const originChainId = originChain;
      
      // Get RPC URLs based on origin chain
      let pimlicoRpcUrl: string;
      let standardRpcUrl: string;
      
      switch (originChainId) {
        case CHAIN_IDS.ETH_SEPOLIA:
          pimlicoRpcUrl = 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
          break;
        case CHAIN_IDS.ETH_MAINNET:
          pimlicoRpcUrl = 'https://api.pimlico.io/v2/1/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
          break;
        case CHAIN_IDS.BASE_SEPOLIA:
          pimlicoRpcUrl = 'https://api.pimlico.io/v2/84532/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = 'https://base-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
          break;
        case CHAIN_IDS.BASE_MAINNET:
          pimlicoRpcUrl = 'https://api.pimlico.io/v2/8453/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = 'https://base.drpc.org';
          break;
        case CHAIN_IDS.ARBITRUM_SEPOLIA:
          pimlicoRpcUrl = 'https://api.pimlico.io/v2/421614/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = 'https://arb-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
          break;
        case CHAIN_IDS.ARBITRUM_MAINNET:
          pimlicoRpcUrl = 'https://api.pimlico.io/v2/42161/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = 'https://arb-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
          break;
        default:
          pimlicoRpcUrl = network === 'testnet' 
            ? 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh'
            : 'https://api.pimlico.io/v2/1/rpc?apikey=pim_VNHD6e2J4JXxm3S1aPN4Sh';
          standardRpcUrl = network === 'testnet'
            ? 'https://eth-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX'
            : 'https://eth-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
      }

      // Validate RPC URLs
      if (!standardRpcUrl || !pimlicoRpcUrl) {
        throw new Error(`RPC URLs not configured for ${getChainName(originChainId)}`);
      }

      console.log('RPC Configuration:', {
        originChain: getChainName(originChainId),
        standardRpcUrl,
        pimlicoRpcUrl,
      });

      // Create public client with proper error handling
      // Use a simpler transport configuration to avoid response parsing issues
      const publicClient = createPublicClient({
        chain: originChainObj,
        transport: http(standardRpcUrl),
      }) as any; // Type assertion to bypass viem type incompatibility
      
      console.log('Public client created for:', {
        chain: originChainObj.name,
        chainId: originChainObj.id,
        rpcUrl: standardRpcUrl,
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

      // Create bundler client with proper error handling
      // Note: Pimlico bundler supports limited chains (mainly Ethereum Sepolia and Mainnet)
      // For other chains, we may need alternative bundlers
      console.log('Creating bundler client...');
      let bundlerClient;
      
      // Check if Pimlico supports this chain
      const pimlicoSupportedChains = [
        CHAIN_IDS.ETH_SEPOLIA,
        CHAIN_IDS.ETH_MAINNET,
        // Add other supported chains as needed
      ];
      
      if (!pimlicoSupportedChains.includes(originChainId as any)) {
        throw new Error(
          `Pimlico bundler does not support ${getChainName(originChainId)}. ` +
          `Please use Ethereum Sepolia or Ethereum Mainnet as the origin chain.`
        );
      }
      
      try {
        // Create bundler transport with proper error handling
        const bundlerTransport = http(pimlicoRpcUrl, {
          retryCount: 2,
          retryDelay: 500,
        });
        
        bundlerClient = createBundlerClient({
          client: publicClient,
          transport: bundlerTransport,
          paymaster: true,
        }).extend(erc7710BundlerActions());
        
        console.log('Bundler client created successfully');
      } catch (bundlerError: any) {
        console.error('Error creating bundler client:', bundlerError);
        console.error('Full error:', JSON.stringify(bundlerError, null, 2));
        throw new Error(
          `Failed to create bundler client for ${getChainName(originChainId)}. ` +
          `Error: ${bundlerError.message || 'Unknown error'}. ` +
          `Please ensure Pimlico supports this chain and check the RPC URL.`
        );
      }

      const permissionsContext = delegation.permissions_context as `0x${string}`;
      const delegationManager = delegator;

      // Get gas prices from Pimlico using direct fetch to avoid viem response parsing issues
      let maxFeePerGas: bigint;
      let maxPriorityFeePerGas: bigint;
      
      try {
        console.log('Fetching gas prices from Pimlico...');
        console.log('Pimlico RPC URL:', pimlicoRpcUrl);
        
        // Use direct fetch to avoid viem's response parsing that might cause "Invalid response structure"
        const gasPriceResponse = await fetch(pimlicoRpcUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pimlico_getUserOperationGasPrice',
            params: [],
          }),
        });
        
        if (!gasPriceResponse.ok) {
          const errorText = await gasPriceResponse.text();
          throw new Error(`HTTP ${gasPriceResponse.status}: ${errorText}`);
        }
        
        const gasPriceData = await gasPriceResponse.json();
        console.log('Raw gas price response:', JSON.stringify(gasPriceData, null, 2));
        
        if (gasPriceData.error) {
          throw new Error(`Pimlico RPC error: ${JSON.stringify(gasPriceData.error)}`);
        }
        
        if (!gasPriceData.result) {
          throw new Error('No result in gas price response');
        }
        
        const result = gasPriceData.result;
        const maxFee = result.maxFeePerGas;
        const maxPriority = result.maxPriorityFeePerGas;
        
        if (!maxFee || !maxPriority) {
          throw new Error('Missing gas price fields in response');
        }
        
        // Convert to BigInt - handle both string and number formats
        maxFeePerGas = typeof maxFee === 'string' 
          ? (maxFee.startsWith('0x') ? BigInt(maxFee) : BigInt(`0x${maxFee}`))
          : BigInt(maxFee);
        maxPriorityFeePerGas = typeof maxPriority === 'string'
          ? (maxPriority.startsWith('0x') ? BigInt(maxPriority) : BigInt(`0x${maxPriority}`))
          : BigInt(maxPriority);
          
        console.log('Gas prices fetched successfully:', {
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        });
      } catch (err: any) {
        console.error('Failed to get gas prices from Pimlico:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
        });
        console.warn('Using fallback gas prices');
        // Use fallback gas prices - these should work for most cases
        maxFeePerGas = BigInt(2000000000);
        maxPriorityFeePerGas = BigInt(1000000000);
      }

      // Get token address based on selected token and chain
      const tokenAddress = getTokenAddress(destinationChain, token);
      if (!tokenAddress) {
        throw new Error(`Token ${token} not available on selected chain`);
      }

      // Check if destination is the same as origin
      if (destinationChain === originChainId) {
        // Direct transfer from smart account to recipient (no swap, no EOA delegation needed)
        console.log('=== Direct Transfer (Same Chain - No Swap Needed) ===');
        const directCalldata = encodeFunctionData({
          abi: erc20Abi,
          args: [recipientAddress as Address, parseUnits(amount, 6)],
          functionName: 'transfer',
        });

        console.log('Sending direct transfer user operation...');
        console.log('User operation params:', {
          to: tokenAddress,
          dataLength: directCalldata.length,
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        });
        
        // Test bundler connection first
        try {
          console.log('Testing bundler connection...');
          await bundlerClient.request({
            method: 'eth_chainId',
            params: [],
          } as any);
          console.log('Bundler connection verified');
        } catch (testError: any) {
          console.warn('Bundler connection test failed, but continuing:', testError);
        }
        
        let directUserOpHash;
        try {
          directUserOpHash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient: publicClient as any, // Type assertion to bypass viem type incompatibility
            account: smartAccount,
            calls: [
              {
                to: tokenAddress,
                data: directCalldata,
                permissionsContext,
                delegationManager,
              },
            ],
            maxFeePerGas,
            maxPriorityFeePerGas,
          });
        } catch (opError: any) {
          console.error('Error sending user operation:', opError);
          console.error('Error details:', {
            message: opError.message,
            shortMessage: opError.shortMessage,
            name: opError.name,
            stack: opError.stack,
            cause: opError.cause,
            data: opError.data,
          });
          
          // Check if it's an RPC error
          if (opError.message?.includes('Invalid response structure') || 
              opError.shortMessage?.includes('Invalid response structure') ||
              opError.message?.includes('InternalRpcError')) {
            throw new Error(
              `RPC Error: Invalid response structure from bundler. ` +
              `This usually means the bundler endpoint is not responding correctly. ` +
              `Please check: 1) The Pimlico RPC URL is correct, 2) The bundler supports this chain, ` +
              `3) Your API key is valid. Error: ${opError.message || opError.shortMessage}`
            );
          }
          
          throw new Error(
            `Failed to send user operation: ${opError.message || opError.shortMessage || 'Unknown error'}. ` +
            `Please check the bundler endpoint and try again.`
          );
        }

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
        console.log('=== Cross-Chain Payment Flow Initiated ===');
        console.log('Payment will be executed in 2 steps:');
        console.log('  1. Delegate tokens from Smart Account to EOA');
        console.log('  2. Perform cross-chain swap from EOA to recipient');
        console.log('');
        console.log('=== Step 1: Delegating from Smart Account to EOA ===');
        console.log('Delegation Details:', {
          from: smartAccount.address,
          to: eoaAddress,
          amount: `${amount} ${token}`,
          tokenAddress: delegation.token_address,
        });
        
        const delegateCalldata = encodeFunctionData({
          abi: erc20Abi,
          args: [eoaAddress as Address, parseUnits(amount, 6)],
          functionName: 'transfer',
        });
        
        console.log('Delegation calldata encoded:', delegateCalldata.slice(0, 20) + '...');

        console.log('Sending delegation user operation...');
        const delegateUserOpHash = await bundlerClient.sendUserOperationWithDelegation({
          publicClient: publicClient as any, // Type assertion to bypass viem type incompatibility
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

        console.log('Delegation user operation submitted:', delegateUserOpHash);
        console.log('Waiting for delegation transaction confirmation...');

        const delegateReceipt = await bundlerClient.waitForUserOperationReceipt({
          hash: delegateUserOpHash,
        });

        console.log('=== Step 1 Complete: Delegation to EOA Successful ===');
        console.log('Delegation Receipt:', {
          userOpHash: delegateUserOpHash,
          transactionHash: delegateReceipt.receipt.transactionHash,
          blockNumber: delegateReceipt.receipt.blockNumber.toString(),
          status: delegateReceipt.receipt.status,
        });
        console.log(`Tokens have been delegated to EOA: ${eoaAddress}`);
        console.log('');

        // STEP 2: Perform swap from EOA to recipient on destination chain
        console.log('=== Step 2: Performing Cross-Chain Swap ===');
        console.log('Swap Parameters:', {
          amount,
          token,
          originChainId,
          destinationChain,
          depositor: eoaAddress,
          recipient: recipientAddress,
        });
        setStep('swapping');

        // Get the appropriate chain object and RPC URL
        let destinationChainObj;
        let destinationRpcUrl;
        let destinationChainName: string;
        
        switch (destinationChain) {
          case CHAIN_IDS.ETH_MAINNET:
            destinationChainObj = mainnet;
            destinationRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            destinationChainName = 'Ethereum Mainnet';
            break;
          case CHAIN_IDS.BASE_MAINNET:
            destinationChainObj = base;
            destinationRpcUrl = 'https://base.drpc.org';
            destinationChainName = 'Base Mainnet';
            break;
          case CHAIN_IDS.OPTIMISM_MAINNET:
            destinationChainObj = optimism;
            destinationRpcUrl = 'https://opt-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            destinationChainName = 'Optimism Mainnet';
            break;
          case CHAIN_IDS.BASE_SEPOLIA:
            destinationChainObj = base;
            destinationRpcUrl = 'https://base-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            destinationChainName = 'Base Sepolia';
            break;
          case CHAIN_IDS.OPTIMISM_SEPOLIA:
            destinationChainObj = optimism;
            destinationRpcUrl = 'https://opt-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            destinationChainName = 'Optimism Sepolia';
            break;
          case CHAIN_IDS.ARBITRUM_SEPOLIA:
            destinationChainObj = arbitrum;
            destinationRpcUrl = 'https://arb-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            destinationChainName = 'Arbitrum Sepolia';
            break;
          case CHAIN_IDS.ARBITRUM_MAINNET:
            destinationChainObj = arbitrum;
            destinationRpcUrl = 'https://arb-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX';
            destinationChainName = 'Arbitrum Mainnet';
            break;
          default:
            throw new Error('Unsupported destination chain');
        }

        console.log('=== Chain Configuration ===');
        console.log('Origin Chain:', {
          id: originChainId,
          name: network === 'testnet' ? 'Ethereum Sepolia' : 'Ethereum Mainnet',
          rpcUrl: standardRpcUrl,
        });
        console.log('Destination Chain:', {
          id: destinationChain,
          name: destinationChainName,
          rpcUrl: destinationRpcUrl,
        });

        // Get token addresses based on selected token
        console.log('=== Resolving Token Addresses ===');
        const originToken = getTokenAddress(originChainId, token);
        const destinationToken = getTokenAddress(destinationChain, token);
        
        console.log('Token Addresses:', {
          token,
          originToken: originToken || 'NOT FOUND',
          destinationToken: destinationToken || 'NOT FOUND',
        });
        
        if (!originToken || !destinationToken) {
          throw new Error(`Could not find ${token} address for selected chains`);
        }

        // Create wallet and public clients for origin chain
        console.log('=== Creating Wallet and Public Clients ===');
        console.log('EOA Address:', eoaAddress);
        console.log('Origin Chain RPC:', standardRpcUrl);
        
        const originWalletClient = createWalletClient({
          account: signerAccount,
          chain: originChainObj,
          transport: http(standardRpcUrl, {
            retryCount: 3,
            retryDelay: 1000,
          }),
        });

        const originPublicClient = createPublicClient({
          chain: originChainObj,
          transport: http(standardRpcUrl, {
            retryCount: 3,
            retryDelay: 1000,
          }),
        }) as any; // Type assertion to bypass viem type incompatibility
        
        console.log('Clients created successfully');

        console.log('Clients created successfully');

        // Perform swap
        console.log('=== Initiating Across Protocol Swap ===');
        console.log('Swap Details:', {
          amount: `${amount} ${token}`,
          fromChain: `${network === 'testnet' ? 'Ethereum Sepolia' : 'Ethereum Mainnet'} (${originChainId})`,
          toChain: `${destinationChainName} (${destinationChain})`,
          inputToken: originToken,
          outputToken: destinationToken,
          depositor: eoaAddress,
          recipient: recipientAddress,
        });
        
        const swapTxHash = await acrossSwap(
          originWalletClient,
          originPublicClient as any, // Type assertion to bypass viem type incompatibility
          {
            amount,
            inputToken: originToken,
            outputToken: destinationToken,
            originChainId: originChainId,
            destinationChainId: destinationChain,
            depositor: eoaAddress,
            recipient: recipientAddress as Address,
          }
        );

        console.log('=== Swap Transaction Submitted ===');
        console.log('Transaction Hash:', swapTxHash);
        console.log('Waiting for transaction confirmation...');

        // Wait for swap transaction
        const swapReceipt = await originPublicClient.waitForTransactionReceipt({ hash: swapTxHash });

        console.log('=== Swap Transaction Confirmed ===');
        console.log('Transaction Receipt:', {
          hash: swapReceipt.transactionHash,
          blockNumber: swapReceipt.blockNumber.toString(),
          status: swapReceipt.status,
          gasUsed: swapReceipt.gasUsed.toString(),
        });
        console.log('=== Cross-Chain Swap Complete ===');
        console.log(`Successfully swapped ${amount} ${token} from ${getChainName(originChainId)} to ${destinationChainName}`);
        console.log('Recipient will receive tokens on:', destinationChainName);
        
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
                htmlFor="network"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Network
              </label>
              <select
                id="network"
                value={network}
                onChange={(e) => setNetwork(e.target.value as NetworkType)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                disabled={loading}
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Token
              </label>
              <select
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value as TokenType)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                disabled={loading}
              >
                <option value="USDC">USDC</option>
                <option value="USDT">USDT</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="originChain"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Origin Chain
              </label>
              <select
                id="originChain"
                value={originChain}
                onChange={(e) => setOriginChain(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                disabled={loading}
              >
                {getOriginChainsForNetwork(network).map((id) => (
                  <option key={id} value={id}>
                    {getChainName(id)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                Select the blockchain where the delegation is located
              </p>
            </div>

            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Amount ({token})
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
                Amount in {token} to transfer
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
                {network === 'testnet' ? (
                  <>
                    <option value={CHAIN_IDS.ETH_SEPOLIA}>Ethereum Sepolia</option>
                    <option value={CHAIN_IDS.BASE_SEPOLIA}>Base Sepolia</option>
                    <option value={CHAIN_IDS.OPTIMISM_SEPOLIA}>Optimism Sepolia</option>
                    <option value={CHAIN_IDS.ARBITRUM_SEPOLIA}>Arbitrum Sepolia</option>
                  </>
                ) : (
                  <>
                    <option value={CHAIN_IDS.ETH_MAINNET}>Ethereum Mainnet</option>
                    <option value={CHAIN_IDS.BASE_MAINNET}>Base Mainnet</option>
                    <option value={CHAIN_IDS.OPTIMISM_MAINNET}>Optimism Mainnet</option>
                    <option value={CHAIN_IDS.ARBITRUM_MAINNET}>Arbitrum Mainnet</option>
                  </>
                )}
              </select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {originChain === destinationChain
                  ? 'Direct transfer (no swap needed)' 
                  : `Will perform cross-chain swap from ${getChainName(originChain)} to ${getChainName(destinationChain)}`}
              </p>
            </div>

            {loading && (
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {originChain === destinationChain
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

