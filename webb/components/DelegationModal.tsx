'use client';

import { useState, useEffect } from 'react';
import { createWalletClient, custom, parseUnits, type Address } from 'viem';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';
import { sepolia, mainnet, base, arbitrum } from 'viem/chains';
import { supabase } from '@/lib/supabase';
import { CHAIN_IDS, getTokenAddress, getOriginChainsForNetwork, getChainName, type NetworkType, type TokenType } from '@/lib/swap';
import { ensureNetwork, checkNetwork } from '@/lib/network-switch';

interface DelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberAddress: string;
  memberName?: string;
  roomMemberId?: string;
  roomId?: string;
}

const DELEGATION_MANAGER: Address = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';

export default function DelegationModal({
  isOpen,
  onClose,
  memberAddress,
  memberName,
  roomMemberId,
  roomId,
}: DelegationModalProps) {
  const [amount, setAmount] = useState('');
  const [periodDuration, setPeriodDuration] = useState('');
  const [justification, setJustification] = useState('');
  const [network, setNetwork] = useState<NetworkType>('testnet');
  const [token, setToken] = useState<TokenType>('USDC');
  const [chainId, setChainId] = useState<number>(CHAIN_IDS.ETH_SEPOLIA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Update chain when network changes
  useEffect(() => {
    const availableChains = getOriginChainsForNetwork(network);
    if (availableChains.length > 0 && !availableChains.includes(chainId)) {
      setChainId(availableChains[0]);
    }
  }, [network, chainId]);

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

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    // Validate period duration
    const periodDays = parseFloat(periodDuration);
    if (isNaN(periodDays) || periodDays <= 0 || !Number.isInteger(periodDays)) {
      setError('Please enter a valid whole number of days (1 or more)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get chain object based on chainId
      let chain;
      switch (chainId) {
        case CHAIN_IDS.ETH_SEPOLIA:
          chain = sepolia;
          break;
        case CHAIN_IDS.ETH_MAINNET:
          chain = mainnet;
          break;
        case CHAIN_IDS.BASE_SEPOLIA:
        case CHAIN_IDS.BASE_MAINNET:
          chain = base;
          break;
        case CHAIN_IDS.ARBITRUM_SEPOLIA:
        case CHAIN_IDS.ARBITRUM_MAINNET:
          chain = arbitrum;
          break;
        default:
          chain = network === 'testnet' ? sepolia : mainnet;
      }

      // Get token address
      const tokenAddress = getTokenAddress(chainId, token);
      if (!tokenAddress) {
        throw new Error(`${token} is not available on ${getChainName(chainId)}`);
      }

      // Validate token address format
      if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
        throw new Error(`Invalid token address format: ${tokenAddress}`);
      }

      console.log('Delegation Chain:', {
        chainId,
        chainName: getChainName(chainId),
        network,
        token,
        tokenAddress,
      });
      
      // Verify the token address is valid for this chain
      console.log('Token validation:', {
        token,
        chainId,
        chainName: getChainName(chainId),
        tokenAddress,
        isValidFormat: tokenAddress.startsWith('0x') && tokenAddress.length === 42,
      });

      // Ensure wallet is connected to the correct network
      console.log('Checking and switching network if needed...');
      try {
        await ensureNetwork(chainId);
        console.log('Network verification complete');
      } catch (networkError: any) {
        console.error('Network switching error:', networkError);
        throw new Error(
          `Network error: ${networkError.message}. ` +
          `Please ensure MetaMask is connected to ${getChainName(chainId)} and try again.`
        );
      }

      // Double-check network after switching
      const finalNetworkCheck = await checkNetwork(chainId);
      if (!finalNetworkCheck) {
        throw new Error(
          `MetaMask is not connected to ${getChainName(chainId)}. ` +
          `Please switch to ${getChainName(chainId)} in MetaMask and try again.`
        );
      }

      // Verify MetaMask is available and connected
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask and try again.');
      }

      // Wait a bit for MetaMask to be fully ready after network switch
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get current account from MetaMask
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No MetaMask account connected. Please connect your wallet and try again.');
      }

      // Verify chain ID one more time
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      const expectedChainId = `0x${chainId.toString(16)}`;
      console.log('Final chain ID check:', {
        current: currentChainId,
        expected: expectedChainId,
        match: currentChainId.toLowerCase() === expectedChainId.toLowerCase(),
      });

      if (currentChainId.toLowerCase() !== expectedChainId.toLowerCase()) {
        throw new Error(
          `Chain ID mismatch. MetaMask is on ${currentChainId}, but we need ${expectedChainId} (${getChainName(chainId)}). ` +
          `Please switch to ${getChainName(chainId)} in MetaMask and try again.`
        );
      }

      console.log('MetaMask account:', accounts[0]);
      console.log('Creating wallet client for delegation...');
      
      // Create wallet client with error handling
      let walletClient;
      try {
        walletClient = createWalletClient({
          transport: custom(window.ethereum),
          chain,
        }).extend(erc7715ProviderActions());
        console.log('Wallet client created successfully');
      } catch (clientError: any) {
        console.error('Error creating wallet client:', clientError);
        throw new Error(
          `Failed to create wallet client: ${clientError.message}. ` +
          `Please ensure MetaMask is properly connected and try again.`
        );
      }

      const currentTime = Math.floor(Date.now() / 1000);
      // 1 week from now
      const expiry = currentTime + 604800;

      // Parse amount (USDC and USDT both have 6 decimals)
      const periodAmount = parseUnits(amount, 6);
      
      // Calculate period duration in seconds
      // 1 day = 24 hours * 60 minutes * 60 seconds = 86400 seconds
      const SECONDS_PER_DAY = 86400;
      const periodDurationSeconds = Math.floor(periodDays * SECONDS_PER_DAY);

      console.log('=== Delegation Request Parameters ===');
      console.log('Chain ID:', chain.id);
      console.log('Chain Name:', chain.name);
      console.log('Network:', network);
      console.log('Token:', token);
      console.log('Token Address:', tokenAddress);
      console.log('Member Address:', memberAddress);
      console.log('Amount:', amount);
      console.log('Period Amount (wei):', periodAmount.toString());
      console.log('Period Duration (days):', periodDays);
      console.log('Period Duration (seconds):', periodDurationSeconds);
      console.log('Justification:', justification);
      console.log('Expiry (timestamp):', expiry);
      console.log('Current Time:', currentTime);

      let grantedPermissions;
      let lastError: any = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Requesting execution permissions from MetaMask (attempt ${attempt}/${maxRetries})...`);
          console.log('Delegation request will be sent to MetaMask. Please approve the transaction.');
          
          // Add a delay before each attempt (longer for retries)
          if (attempt > 1) {
            console.log(`Waiting 2 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Recreate wallet client for each attempt to ensure fresh connection
          const retryWalletClient = createWalletClient({
            transport: custom(window.ethereum),
            chain,
          }).extend(erc7715ProviderActions());
          
          // Prepare delegation request with validated and normalized addresses
          const delegationRequest = {
            chainId: chain.id,
            expiry,
            signer: {
              type: 'account' as const,
              data: {
                // The requested permissions will be granted to the member's smart account
                // Normalize address to lowercase to avoid checksum issues
                address: memberAddress.toLowerCase() as Address,
              },
            },
            permission: {
              type: 'erc20-token-periodic' as const,
              data: {
                // Normalize token address to lowercase
                tokenAddress: tokenAddress.toLowerCase() as Address,
                periodAmount,
                periodDuration: periodDurationSeconds,
                justification,
              },
            },
            isAdjustmentAllowed: true,
          };
          
          console.log('Delegation request payload:', {
            ...delegationRequest,
            periodAmount: periodAmount.toString(),
            periodDuration: periodDurationSeconds,
          });
          
          grantedPermissions = await retryWalletClient.requestExecutionPermissions([delegationRequest]);
          
          // Success - break out of retry loop
          console.log(`Delegation successful on attempt ${attempt}`);
          break;
        } catch (attemptError: any) {
          lastError = attemptError;
          console.error(`Attempt ${attempt} failed:`, {
            message: attemptError.message,
            code: attemptError.code,
            name: attemptError.name,
            shortMessage: attemptError.shortMessage,
            cause: attemptError.cause,
            stack: attemptError.stack,
          });
          
          // If it's a user rejection, don't retry
          if (attemptError.code === 4001) {
            throw attemptError;
          }
          
          // Check if it's the "Invalid response structure" error from MetaMask
          const isInvalidResponseError = 
            attemptError.code === -32603 || 
            attemptError.name === 'InternalRpcError' ||
            attemptError.message?.includes('Invalid response structure') ||
            attemptError.message?.includes('SnapError');
          
          if (isInvalidResponseError) {
            console.error('=== RPC Error: Invalid Response Structure ===');
            console.error('This error typically occurs when:');
            console.error('1. MetaMask tries to fetch token balance/metadata and the RPC returns unexpected format');
            console.error('2. The token address might not be valid on this chain');
            console.error('3. The RPC endpoint might be having issues');
            console.error('4. MetaMask cannot read the token contract');
            console.error('Token address:', tokenAddress);
            console.error('Chain:', getChainName(chainId));
            console.error('Network:', network);
            
            // If it's the last attempt, provide detailed error with troubleshooting steps
            if (attempt === maxRetries) {
              // Verify network one more time
              try {
                const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
                const expectedChainId = `0x${chainId.toString(16)}`;
                console.error('Final network verification:', {
                  current: currentChainId,
                  expected: expectedChainId,
                  match: currentChainId.toLowerCase() === expectedChainId.toLowerCase(),
                });
                
                if (currentChainId.toLowerCase() !== expectedChainId.toLowerCase()) {
                  throw new Error(
                    `Network mismatch: MetaMask is on ${currentChainId}, but we need ${expectedChainId} (${getChainName(chainId)}). ` +
                    `Please switch to ${getChainName(chainId)} in MetaMask and try again.`
                  );
                }
              } catch (networkCheckError: any) {
                console.error('Error checking network:', networkCheckError);
              }
              
              throw new Error(
                `RPC Error: Invalid response structure from MetaMask after ${maxRetries} attempts. ` +
                `This happens when MetaMask tries to fetch token information and gets an unexpected response. ` +
                `Possible causes: 1) Token address (${tokenAddress}) may not be valid on ${getChainName(chainId)}, ` +
                `2) RPC endpoint issues, 3) MetaMask cannot read the token contract. ` +
                `Solutions: 1) Verify ${token} is available on ${getChainName(chainId)}, ` +
                `2) Ensure MetaMask is on ${getChainName(chainId)}, 3) Refresh the page, ` +
                `4) Try disconnecting and reconnecting your wallet. ` +
                `Error: ${attemptError.message || attemptError.shortMessage}`
              );
            }
          }
          
          // If it's the last attempt, throw the error
          if (attempt === maxRetries) {
            throw attemptError;
          }
          
          // Otherwise, continue to next retry
          console.log(`Will retry delegation (${attempt + 1}/${maxRetries})...`);
        }
      }
      
      // If we get here and grantedPermissions is still undefined, something went wrong
      if (!grantedPermissions) {
        const delegationError = lastError || new Error('Failed to get granted permissions after all retries');
        
        console.error('=== Delegation Failed After All Retries ===');
        console.error('Error details:', {
          message: delegationError.message,
          code: delegationError.code,
          name: delegationError.name,
          stack: delegationError.stack,
          data: delegationError.data,
          shortMessage: delegationError.shortMessage,
          cause: delegationError.cause,
        });
        
        // Check for specific error types
        if (delegationError.code === 4001) {
          throw new Error('Delegation request was rejected by user. Please try again and approve the transaction.');
        } else if (delegationError.code === -32602) {
          throw new Error(`Invalid delegation parameters. Please check: ${delegationError.message}`);
        } else if (delegationError.code === -32603 || delegationError.name === 'InternalRpcError') {
          // This is the "Invalid response structure" error
          console.error('RPC Error detected. This might be due to:');
          console.error('1. Network mismatch - MetaMask might not be on the correct network');
          console.error('2. RPC endpoint issue - The provider might be returning unexpected format');
          console.error('3. MetaMask version issue - Try updating MetaMask');
          console.error('4. viem/MetaMask compatibility issue - Try refreshing the page');
          
          // Verify network one more time
          try {
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            const expectedChainId = `0x${chainId.toString(16)}`;
            console.error('Current chain ID:', currentChainId);
            console.error('Expected chain ID:', expectedChainId);
            
            if (currentChainId.toLowerCase() !== expectedChainId.toLowerCase()) {
              throw new Error(
                `Network mismatch detected. MetaMask is on chain ${currentChainId}, but we need ${expectedChainId} (${getChainName(chainId)}). ` +
                `Please switch to ${getChainName(chainId)} in MetaMask and try again.`
              );
            }
          } catch (networkCheckError: any) {
            console.error('Error checking network:', networkCheckError);
          }
          
          throw new Error(
            `RPC Error: Invalid response structure from MetaMask provider after ${maxRetries} attempts. ` +
            `This is often caused by a compatibility issue between viem and MetaMask. ` +
            `Please try: 1) Refreshing the page, 2) Ensuring MetaMask is on ${getChainName(chainId)}, ` +
            `3) Updating MetaMask to the latest version, 4) Disconnecting and reconnecting your wallet. ` +
            `If the issue persists, it may be a known compatibility issue. Error: ${delegationError.message || delegationError.shortMessage}`
          );
        } else if (delegationError.message?.includes('network') || delegationError.message?.includes('chain')) {
          throw new Error(
            `Network error: ${delegationError.message}. ` +
            `Please ensure MetaMask is connected to ${getChainName(chainId)} and try again.`
          );
        } else {
          throw new Error(
            `Delegation failed after ${maxRetries} attempts: ${delegationError.message || delegationError.shortMessage || 'Unknown error'}. ` +
            `Please check the console for more details.`
          );
        }
      }
      
      // Success - process the granted permissions
      console.log('=== Delegation Successful ===');
      console.log('Granted Permissions:', grantedPermissions);
      console.log('Granted Permissions (stringified):', JSON.stringify(grantedPermissions, null, 2));

      // Save delegation data to database
      if (grantedPermissions && grantedPermissions.length > 0) {
        const permission = grantedPermissions[0];
        
        // Extract context from the permission
        // The context is typically in the permission response
        // Based on ERC-7715, context is usually at the top level or in permission.data
        let permissionsContext = '';
        
        // Try different possible locations for the context
        if ((permission as any).context) {
          permissionsContext = (permission as any).context;
        } else if ((permission as any).permissionsContext) {
          permissionsContext = (permission as any).permissionsContext;
        } else if ((permission as any).permission?.context) {
          permissionsContext = (permission as any).permission.context;
        } else if ((permission as any).data?.context) {
          permissionsContext = (permission as any).data.context;
        } else {
          // If context is not found, log the structure and use a placeholder
          console.warn('Context not found in permission structure:', permission);
          permissionsContext = JSON.stringify(permission);
        }
        
        console.log('Extracted permissions context:', permissionsContext);
        
        const startTime = currentTime;

        // Get or create room_member_id
        let finalRoomMemberId = roomMemberId;
        
        if (!finalRoomMemberId && roomId) {
          // Find the room member by wallet address and room_id
          const { data: memberData } = await supabase
            .from('room_members')
            .select('id')
            .eq('room_id', roomId)
            .eq('wallet_address', memberAddress.toLowerCase())
            .single();
          
          if (memberData) {
            finalRoomMemberId = memberData.id;
          }
        }

        if (finalRoomMemberId) {
          // Save delegation to database
          const { error: delegationError } = await supabase
            .from('delegations')
            .insert([
              {
                room_member_id: finalRoomMemberId,
                wallet_address: memberAddress.toLowerCase(),
                permissions_context: permissionsContext,
                delegation_manager: DELEGATION_MANAGER,
                justification: justification,
                period_duration: periodDurationSeconds,
                start_time: startTime,
                token_address: tokenAddress,
              },
            ]);

          if (delegationError) {
            console.error('Error saving delegation:', delegationError);
            // Don't fail the whole operation if saving fails
          } else {
            console.log('Delegation saved successfully to database');
          }
        } else {
          console.warn('Could not find room member ID, delegation not saved to database');
        }
      }

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
            Create Delegation
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
              htmlFor="chain"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Chain
            </label>
            <select
              id="chain"
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value))}
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
              Select the blockchain for this delegation
            </p>
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
              htmlFor="amount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Amount per Period ({token})
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
              Amount in {token} that can be transferred per period
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
              onChange={(e) => {
                const value = e.target.value;
                // Only allow positive integers
                if (value === '' || (parseFloat(value) > 0 && Number.isInteger(parseFloat(value)))) {
                  setPeriodDuration(value);
                }
              }}
              min="1"
              step="1"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              placeholder="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              How often this delegation can be used (in days)
            </p>
            {periodDuration && !isNaN(parseFloat(periodDuration)) && parseFloat(periodDuration) > 0 && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                Period: {parseFloat(periodDuration)} day(s) = {Math.floor(parseFloat(periodDuration) * 86400).toLocaleString()} seconds
              </p>
            )}
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
              placeholder={`Permission to transfer ${token} for family expenses`}
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

