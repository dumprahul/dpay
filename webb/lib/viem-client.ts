import { createPublicClient, http, type PublicClient } from 'viem';
import { createBundlerClient, type BundlerClient } from 'viem/account-abstraction';
import { sepolia } from 'viem/chains';

// You can change this to your preferred chain
const chain = sepolia;

// Get bundler URL from environment or use a default
const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL || 'https://api.stackup.sh/v1/node/your-api-key';

export const publicClient: PublicClient = createPublicClient({
  chain,
  transport: http(),
});

export const bundlerClient: BundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(bundlerUrl),
});

