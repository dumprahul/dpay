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
  
  // 1. Get quote and tx data from Across API
  const { data } = await axios.get('https://app.across.to/api/swap/approval', {
    params: {
      tradeType: 'exactInput',
      amount: parseUnits(params.amount, 6).toString(), // Assuming USDC (6 decimals)
      inputToken: params.inputToken,
      originChainId: params.originChainId,
      outputToken: params.outputToken,
      destinationChainId: params.destinationChainId,
      depositor: params.depositor,
      recipient: params.recipient || params.depositor,
    }
  });

  console.log('Quote:', {
    input: data.inputAmount,
    output: data.expectedOutputAmount,
    fillTime: `${data.expectedFillTime}s`
  });

  // 2. Handle approvals if needed
  if (data.approvalTxns) {
    for (const txn of data.approvalTxns) {
      const hash = await walletClient.sendTransaction({
        to: txn.to,
        data: txn.data,
        chain: walletClient.chain,
        account: walletClient.account!,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log('Approved:', hash);
    }
  }

  // 3. Execute swap
  const txHash = await walletClient.sendTransaction({
    to: data.swapTx.to,
    data: data.swapTx.data,
    value: data.swapTx.value ? BigInt(data.swapTx.value) : undefined,
    chain: walletClient.chain,
    account: walletClient.account!,
  });

  console.log('Swap tx:', txHash);
  return txHash;
}

// Chain IDs
export const CHAIN_IDS = {
  ETH_SEPOLIA: 11155111,
  ETH_MAINNET: 1,
  BASE_MAINNET: 8453,
  OPTIMISM_MAINNET: 10,
} as const;

// USDC addresses on different chains
export const USDC_ADDRESSES: Record<number, Address> = {
  [CHAIN_IDS.ETH_SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [CHAIN_IDS.ETH_MAINNET]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [CHAIN_IDS.BASE_MAINNET]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [CHAIN_IDS.OPTIMISM_MAINNET]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
};

// Helper function to get USDC address for a chain
export function getUSDCAddress(chainId: number): Address | null {
  return USDC_ADDRESSES[chainId] || null;
}

