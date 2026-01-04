import { createWalletClient, createPublicClient, http, parseUnits, type Address, type Hash } from 'viem';
import axios from 'axios';

// ============================================
// Simple Across Swap with Viem
// ============================================

interface SwapParams {
  amount: string;               // Human readable (e.g., "10")
  inputToken: Address;          // Token on origin chain
  outputToken: Address;         // Token on destination chain
  originChainId: number;
  destinationChainId: number;
  depositor: Address;
  recipient?: Address;          // Defaults to depositor
}

export async function acrossSwap(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  params: SwapParams
): Promise<Hash> {
  
  console.log('=== Across Protocol Swap Function Called ===');
  console.log('Swap Parameters:', {
    amount: params.amount,
    inputToken: params.inputToken,
    outputToken: params.outputToken,
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId,
    depositor: params.depositor,
    recipient: params.recipient || params.depositor,
  });

  // 1. Get quote and tx data from Across API
  console.log('=== Step 1: Requesting Quote from Across API ===');
  console.log('API Endpoint: https://app.across.to/api/swap/approval');
  console.log('Request Parameters:', {
    tradeType: 'exactInput',
    amount: parseUnits(params.amount, 6).toString(),
    inputToken: params.inputToken,
    originChainId: params.originChainId,
    outputToken: params.outputToken,
    destinationChainId: params.destinationChainId,
    depositor: params.depositor,
    recipient: params.recipient || params.depositor,
  });

  const { data } = await axios.get('https://app.across.to/api/swap/approval', {
    params: {
      tradeType: 'exactInput',
      amount: parseUnits(params.amount, 6).toString(), // Assuming USDC/USDT (6 decimals)
      inputToken: params.inputToken,
      originChainId: params.originChainId,
      outputToken: params.outputToken,
      destinationChainId: params.destinationChainId,
      depositor: params.depositor,
      recipient: params.recipient || params.depositor,
    }
  });

  console.log('=== Quote Received from Across API ===');
  console.log('Quote Details:', {
    inputAmount: data.inputAmount,
    expectedOutputAmount: data.expectedOutputAmount,
    expectedFillTime: `${data.expectedFillTime}s`,
    hasApprovalTxns: !!data.approvalTxns,
    approvalTxnsCount: data.approvalTxns?.length || 0,
    swapTxTo: data.swapTx?.to,
    swapTxValue: data.swapTx?.value,
  });

  // 2. Handle approvals if needed
  if (data.approvalTxns && data.approvalTxns.length > 0) {
    console.log('=== Step 2: Processing Token Approvals ===');
    console.log(`Found ${data.approvalTxns.length} approval transaction(s) required`);
    
    for (let i = 0; i < data.approvalTxns.length; i++) {
      const txn = data.approvalTxns[i];
      console.log(`Approval ${i + 1}/${data.approvalTxns.length}:`, {
        to: txn.to,
        dataLength: txn.data?.length || 0,
      });
      
      console.log(`Sending approval transaction ${i + 1}...`);
      const hash = await walletClient.sendTransaction({
        to: txn.to,
        data: txn.data,
        chain: walletClient.chain,
        account: walletClient.account!,
      });
      
      console.log(`Approval transaction ${i + 1} submitted:`, hash);
      console.log(`Waiting for approval transaction ${i + 1} confirmation...`);
      
      const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash });
      
      console.log(`Approval transaction ${i + 1} confirmed:`, {
        hash: approvalReceipt.transactionHash,
        blockNumber: approvalReceipt.blockNumber.toString(),
        status: approvalReceipt.status,
      });
    }
    
    console.log('=== All Approvals Complete ===');
  } else {
    console.log('=== Step 2: No Approvals Required ===');
  }

  // 3. Execute swap
  console.log('=== Step 3: Executing Cross-Chain Swap Transaction ===');
  console.log('Swap Transaction Details:', {
    to: data.swapTx.to,
    value: data.swapTx.value || '0',
    dataLength: data.swapTx.data?.length || 0,
  });
  
  console.log('Sending swap transaction...');
  const txHash = await walletClient.sendTransaction({
    to: data.swapTx.to,
    data: data.swapTx.data,
    value: data.swapTx.value ? BigInt(data.swapTx.value) : undefined,
    chain: walletClient.chain,
    account: walletClient.account!,
  });

  console.log('=== Swap Transaction Submitted ===');
  console.log('Transaction Hash:', txHash);
  console.log('Transaction will be processed by Across Protocol');
  console.log('Tokens will be bridged to destination chain');
  
  return txHash;
}

// Chain IDs
export const CHAIN_IDS = {
  // Testnets
  ETH_SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  OPTIMISM_SEPOLIA: 11155420,
  ARBITRUM_SEPOLIA: 421614,
  // Mainnets
  ETH_MAINNET: 1,
  BASE_MAINNET: 8453,
  OPTIMISM_MAINNET: 10,
  ARBITRUM_MAINNET: 42161,
} as const;

// USDC addresses on different chains
export const USDC_ADDRESSES: Record<number, Address> = {
  // Testnets
  [CHAIN_IDS.ETH_SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [CHAIN_IDS.BASE_SEPOLIA]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  [CHAIN_IDS.OPTIMISM_SEPOLIA]: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Optimism Sepolia USDC
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: '0x75faf114eafb1BDbe2F0316DF893fd58Ce87AAf7', // Arbitrum Sepolia USDC
  // Mainnets
  [CHAIN_IDS.ETH_MAINNET]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [CHAIN_IDS.BASE_MAINNET]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [CHAIN_IDS.OPTIMISM_MAINNET]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  [CHAIN_IDS.ARBITRUM_MAINNET]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
};

// USDT addresses on different chains
export const USDT_ADDRESSES: Record<number, Address> = {
  // Testnets
  [CHAIN_IDS.ETH_SEPOLIA]: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Sepolia USDT
  [CHAIN_IDS.BASE_SEPOLIA]: '0x0578a8F5F3440E0eC8b5B9175bDe8b5e8F4e1B1', // Base Sepolia USDT
  [CHAIN_IDS.OPTIMISM_SEPOLIA]: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // Optimism Sepolia USDT
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: '0xf0F161fDA2712DB8b566946122a5af183995a2E8', // Arbitrum Sepolia USDT
  // Mainnets
  [CHAIN_IDS.ETH_MAINNET]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  [CHAIN_IDS.BASE_MAINNET]: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // Base Mainnet USDT
  [CHAIN_IDS.OPTIMISM_MAINNET]: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  [CHAIN_IDS.ARBITRUM_MAINNET]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
};

// Helper function to get token address for a chain
export function getTokenAddress(chainId: number, token: 'USDC' | 'USDT'): Address | null {
  if (token === 'USDC') {
    return USDC_ADDRESSES[chainId] || null;
  } else {
    return USDT_ADDRESSES[chainId] || null;
  }
}

// Helper function to get USDC address for a chain (backward compatibility)
export function getUSDCAddress(chainId: number): Address | null {
  return USDC_ADDRESSES[chainId] || null;
}

// Helper function to get USDT address for a chain
export function getUSDTAddress(chainId: number): Address | null {
  return USDT_ADDRESSES[chainId] || null;
}

// Network type
export type NetworkType = 'mainnet' | 'testnet';

// Token type
export type TokenType = 'USDC' | 'USDT';

// Get available chains for a network type
export function getChainsForNetwork(network: NetworkType): number[] {
  if (network === 'testnet') {
    return [
      CHAIN_IDS.ETH_SEPOLIA,
      CHAIN_IDS.BASE_SEPOLIA,
      CHAIN_IDS.OPTIMISM_SEPOLIA,
      CHAIN_IDS.ARBITRUM_SEPOLIA,
    ];
  } else {
    return [
      CHAIN_IDS.ETH_MAINNET,
      CHAIN_IDS.BASE_MAINNET,
      CHAIN_IDS.OPTIMISM_MAINNET,
      CHAIN_IDS.ARBITRUM_MAINNET,
    ];
  }
}

// Get available origin chains (ETH, Arbitrum, Base only - both testnet and mainnet)
export function getOriginChainsForNetwork(network: NetworkType): number[] {
  if (network === 'testnet') {
    return [
      CHAIN_IDS.ETH_SEPOLIA,
      CHAIN_IDS.BASE_SEPOLIA,
      CHAIN_IDS.ARBITRUM_SEPOLIA,
    ];
  } else {
    return [
      CHAIN_IDS.ETH_MAINNET,
      CHAIN_IDS.BASE_MAINNET,
      CHAIN_IDS.ARBITRUM_MAINNET,
    ];
  }
}

// Get chain name by ID
export function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    [CHAIN_IDS.ETH_SEPOLIA]: 'Ethereum Sepolia',
    [CHAIN_IDS.BASE_SEPOLIA]: 'Base Sepolia',
    [CHAIN_IDS.OPTIMISM_SEPOLIA]: 'Optimism Sepolia',
    [CHAIN_IDS.ARBITRUM_SEPOLIA]: 'Arbitrum Sepolia',
    [CHAIN_IDS.ETH_MAINNET]: 'Ethereum Mainnet',
    [CHAIN_IDS.BASE_MAINNET]: 'Base Mainnet',
    [CHAIN_IDS.OPTIMISM_MAINNET]: 'Optimism Mainnet',
    [CHAIN_IDS.ARBITRUM_MAINNET]: 'Arbitrum Mainnet',
  };
  return chainNames[chainId] || `Chain ${chainId}`;
}

