import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'viem/chains';

export const config = getDefaultConfig({
  appName: 'Dpay',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'your-project-id',
  chains: [sepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

