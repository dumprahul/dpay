import { DelegationManager } from "generated";

// =============================================================================
// KNOWN ENFORCERS (lowercase)
// =============================================================================
const SPENDING_LIMIT_ENFORCER = "0x474e3ae7e169e940607cc624da8a15eb120139ab";
const TIMESTAMP_ENFORCER = "0x1046bb45c8d673d4ea75321280db34899413c069";

// =============================================================================
// CAVEAT DECODERS
// =============================================================================

/**
 * Decode SpendingLimitEnforcer terms
 * Layout: token (20 bytes) | limit (32 bytes) | period (32 bytes) | startDate (32 bytes)
 */
function decodeSpendingLimitTerms(termsHex: string): {
  token: string;
  limit: bigint;
  period: bigint;
  startDate: bigint;
} | null {
  try {
    const hex = termsHex.startsWith("0x") ? termsHex.slice(2) : termsHex;
    if (hex.length < 232) return null;

    return {
      token: "0x" + hex.slice(0, 40),
      limit: BigInt("0x" + hex.slice(40, 104)),
      period: BigInt("0x" + hex.slice(104, 168)),
      startDate: BigInt("0x" + hex.slice(168, 232)),
    };
  } catch {
    return null;
  }
}

/**
 * Decode TimestampEnforcer terms
 * Layout: expiryTimestamp (32 bytes)
 */
function decodeTimestampTerms(termsHex: string): bigint | null {
  try {
    const hex = termsHex.startsWith("0x") ? termsHex.slice(2) : termsHex;
    if (hex.length < 64) return null;
    return BigInt("0x" + hex.slice(0, 64));
  } catch {
    return null;
  }
}

// =============================================================================
// EXECUTION CALLDATA DECODER
// =============================================================================

const TRANSFER_SELECTOR = "a9059cbb";

/**
 * Decode execution calldata to extract transfer details
 * Format: abi.encodePacked(target, value, calldata)
 * - target: 20 bytes (token address)
 * - value: 32 bytes (ETH value, usually 0)
 * - calldata: transfer(to, amount) = 4 + 32 + 32 = 68 bytes
 */
function decodeExecutionCalldata(executionHex: string): {
  token: string;
  recipient: string;
  amount: bigint;
} | null {
  try {
    const hex = executionHex.startsWith("0x") ? executionHex.slice(2) : executionHex;

    // Minimum: 20 (target) + 32 (value) + 4 (selector) + 32 (to) + 32 (amount) = 120 bytes = 240 hex
    if (hex.length < 240) return null;

    const target = "0x" + hex.slice(0, 40);            // 20 bytes
    const selector = hex.slice(104, 112);              // 4 bytes (after 52 bytes)

    // Check if it's a transfer call
    if (selector.toLowerCase() !== TRANSFER_SELECTOR) return null;

    // Extract recipient (last 20 bytes of 32-byte padded address)
    const recipient = "0x" + hex.slice(136, 176);      // bytes 68-88
    const amount = BigInt("0x" + hex.slice(176, 240)); // bytes 88-120

    return { token: target.toLowerCase(), recipient: recipient.toLowerCase(), amount };
  } catch {
    return null;
  }
}

/**
 * Extract execution calldata from raw tx input
 * Searches for the execution bytes array containing the actual transfer
 */
function extractExecutionFromInput(inputHex: string): string | null {
  try {
    const hex = inputHex.startsWith("0x") ? inputHex.slice(2) : inputHex;

    // Look for common execution lengths (0x78 = 120 bytes for standard transfer)
    const lengthMarkers = [
      "0000000000000000000000000000000000000000000000000000000000000078", // 120 bytes
      "0000000000000000000000000000000000000000000000000000000000000074", // 116 bytes
    ];

    for (const marker of lengthMarkers) {
      const idx = hex.lastIndexOf(marker);
      if (idx !== -1) {
        const length = parseInt(marker, 16) * 2; // Convert to hex chars
        const executionStart = idx + 64; // After 32-byte length
        const executionData = hex.slice(executionStart, executionStart + length);
        
        // Validate it looks like execution data (starts with address, not zeros)
        if (executionData.length >= 40 && !executionData.startsWith("000000000000000000000000")) {
          return executionData;
        }
      }
    }

    // Fallback: search for transfer selector pattern in the data
    const transferPattern = "a9059cbb";
    const transferIdx = hex.lastIndexOf(transferPattern);
    
    if (transferIdx > 104) {
      // Work backwards to find the target address (20 bytes before value + selector)
      const executionStart = transferIdx - 104; // 52 bytes * 2
      const executionData = hex.slice(executionStart, transferIdx + 136); // selector + to + amount
      return executionData;
    }

    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// REDEEMED DELEGATION HANDLER
// =============================================================================

DelegationManager.RedeemedDelegation.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const timestamp = BigInt(event.block.timestamp);
  const blockNumber = BigInt(event.block.number);
  const txHash = event.transaction.hash;
  const logIndex = event.logIndex;

  // Indexed params
  const rootDelegator = event.params.rootDelegator.toLowerCase(); // Vault (family head)
  const redeemer = event.params.redeemer.toLowerCase();           // Member (family member)

  // Delegation tuple: [delegate, delegator, authority, caveats[], salt, signature]
  const delegationTuple = event.params.delegation;
  const caveatsTuple = delegationTuple[3];

  // ---------------------------------------------------------------------------
  // 1. Decode caveat terms for budget info
  // ---------------------------------------------------------------------------
  let budgetLimit: bigint | undefined;
  let budgetPeriod: bigint | undefined;
  let budgetToken: string | undefined;
  let expiresAt: bigint | undefined;

  for (const caveat of caveatsTuple) {
    const enforcer = caveat[0].toLowerCase();
    const terms = caveat[1];

    if (enforcer === SPENDING_LIMIT_ENFORCER) {
      const decoded = decodeSpendingLimitTerms(terms);
      if (decoded) {
        budgetToken = decoded.token;
        budgetLimit = decoded.limit;
        budgetPeriod = decoded.period;
      }
    }

    if (enforcer === TIMESTAMP_ENFORCER) {
      const decoded = decodeTimestampTerms(terms);
      if (decoded) {
        expiresAt = decoded;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Decode actual spend amount from tx input
  // ---------------------------------------------------------------------------
  let actualAmount: bigint | undefined;
  let actualToken: string | undefined;
  let recipient: string | undefined;

  const txInput = event.transaction.input;
  if (txInput) {
    const executionData = extractExecutionFromInput(txInput);
    if (executionData) {
      const decoded = decodeExecutionCalldata(executionData);
      if (decoded) {
        actualToken = decoded.token;
        recipient = decoded.recipient;
        actualAmount = decoded.amount;
      }
    }
  }

  // Use actual token if decoded, otherwise fall back to budget token
  const token = actualToken ?? budgetToken;
  const amount = actualAmount ?? 0n;

  // ---------------------------------------------------------------------------
  // 3. Entity IDs
  // ---------------------------------------------------------------------------
  const vaultId = `${chainId}-${rootDelegator}`;
  const memberId = `${chainId}-${rootDelegator}-${redeemer}`;
  const spendId = `${chainId}-${txHash}-${logIndex}`;

  // ---------------------------------------------------------------------------
  // 4. Create/Update Vault
  // ---------------------------------------------------------------------------
  const existingVault = await context.Vault.get(vaultId);
  const existingMember = await context.Member.get(memberId);
  const isNewMember = !existingMember;

  if (existingVault) {
    context.Vault.set({
      ...existingVault,
      totalSpent: existingVault.totalSpent + amount,
      spendCount: existingVault.spendCount + 1,
      memberCount: isNewMember ? existingVault.memberCount + 1 : existingVault.memberCount,
      lastActivityAt: timestamp,
    });
  } else {
    context.Vault.set({
      id: vaultId,
      chainId,
      address: rootDelegator,
      totalSpent: amount,
      spendCount: 1,
      memberCount: 1,
      firstSeenAt: timestamp,
      lastActivityAt: timestamp,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Create/Update Member
  // ---------------------------------------------------------------------------
  if (existingMember) {
    context.Member.set({
      ...existingMember,
      totalSpent: existingMember.totalSpent + amount,
      spendCount: existingMember.spendCount + 1,
      lastActiveAt: timestamp,
    });
  } else {
    context.Member.set({
      id: memberId,
      chainId,
      address: redeemer,
      vault_id: vaultId,
      totalSpent: amount,
      spendCount: 1,
      firstSeenAt: timestamp,
      lastActiveAt: timestamp,
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Create Spend record
  // ---------------------------------------------------------------------------
  context.Spend.set({
    id: spendId,
    chainId,
    vault_id: vaultId,
    member_id: memberId,
    token,
    amount,
    recipient,
    budgetLimit,
    budgetPeriod,
    expiresAt,
    timestamp,
    txHash,
    blockNumber,
  });
});