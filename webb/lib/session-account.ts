import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import { publicClient } from './viem-client';
import type { SmartAccount } from 'viem/account-abstraction';

export interface SessionAccountData {
  privateKey: Hex;
  address: `0x${string}`;
  smartAccountAddress: `0x${string}`;
}

const SESSION_STORAGE_KEY = 'sessionAccount';

/**
 * Get session account from localStorage if it exists
 */
export function getStoredSessionAccount(): SessionAccountData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored) as SessionAccountData;
  } catch (error) {
    console.error('Error reading session account from storage:', error);
    return null;
  }
}

/**
 * Save session account to localStorage
 */
export function saveSessionAccount(data: SessionAccountData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving session account to storage:', error);
  }
}

/**
 * Generate or load session account and create MetaMask Smart Account
 */
export async function generateSessionAccount(): Promise<{
  sessionAccount: SessionAccountData;
  smartAccount: SmartAccount;
}> {
  // Check localStorage for existing session account
  const stored = getStoredSessionAccount();
  let privateKey: Hex;

  if (stored) {
    privateKey = stored.privateKey;
  } else {
    // Generate new private key
    privateKey = generatePrivateKey();
    
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey);

  // Create MetaMask Smart Account for session
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [account.address, [], [], []],
    deploySalt: '0x',
    signer: { account },
  });

  const sessionData: SessionAccountData = {
    privateKey,
    address: account.address,
    smartAccountAddress: smartAccount.address,
  };

  // Save to localStorage
  saveSessionAccount(sessionData);

  return {
    sessionAccount: sessionData,
    smartAccount,
  };
}

