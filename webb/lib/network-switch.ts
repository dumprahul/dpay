import { CHAIN_IDS, getChainName } from './swap';

// Chain configurations for MetaMask network switching
const CHAIN_CONFIGS: Record<number, {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  [CHAIN_IDS.ETH_SEPOLIA]: {
    chainId: '0xaa36a7', // 11155111
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  [CHAIN_IDS.ETH_MAINNET]: {
    chainId: '0x1', // 1
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    chainId: '0x14a34', // 84532
    chainName: 'Base Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://base-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
  [CHAIN_IDS.BASE_MAINNET]: {
    chainId: '0x2105', // 8453
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://base.drpc.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: {
    chainId: '0x66eee', // 421614
    chainName: 'Arbitrum Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb-sepolia.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
  [CHAIN_IDS.ARBITRUM_MAINNET]: {
    chainId: '0xa4b1', // 42161
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb-mainnet.g.alchemy.com/v2/7cPpN-HuMIH9Kjen8uysX'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
};

/**
 * Check if MetaMask is connected to the correct network
 */
export async function checkNetwork(chainId: number): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const currentChainId = await window.ethereum.request({
      method: 'eth_chainId',
    });

    const targetChainId = `0x${chainId.toString(16)}`;
    return currentChainId.toLowerCase() === targetChainId.toLowerCase();
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

/**
 * Switch MetaMask to the specified network
 */
export async function switchNetwork(chainId: number): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const chainConfig = CHAIN_CONFIGS[chainId];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${getChainName(chainId)} (${chainId})`);
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainConfig.chainId }],
    });
  } catch (switchError: any) {
    // If the network doesn't exist, add it
    if (switchError.code === 4902 || switchError.code === -32603) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainConfig],
        });
      } catch (addError) {
        console.error('Error adding network:', addError);
        throw new Error(
          `Failed to add ${getChainName(chainId)} network. Please add it manually in MetaMask.`
        );
      }
    } else {
      console.error('Error switching network:', switchError);
      throw new Error(
        `Failed to switch to ${getChainName(chainId)} network. Please switch manually in MetaMask.`
      );
    }
  }
}

/**
 * Ensure MetaMask is connected to the correct network, switch if needed
 */
export async function ensureNetwork(chainId: number): Promise<void> {
  const isCorrectNetwork = await checkNetwork(chainId);
  
  if (!isCorrectNetwork) {
    console.log(`Switching network to ${getChainName(chainId)} (${chainId})...`);
    await switchNetwork(chainId);
    
    // Wait a bit for the network switch to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the switch was successful (with retries)
    let verifyNetwork = false;
    for (let i = 0; i < 5; i++) {
      verifyNetwork = await checkNetwork(chainId);
      if (verifyNetwork) {
        break;
      }
      console.log(`Network switch verification attempt ${i + 1}/5...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!verifyNetwork) {
      throw new Error(
        `Failed to switch to ${getChainName(chainId)}. ` +
        `Please ensure MetaMask is connected to ${getChainName(chainId)} and try again.`
      );
    }
    
    console.log(`Successfully switched to ${getChainName(chainId)}`);
  } else {
    console.log(`Already connected to ${getChainName(chainId)}`);
  }
}

