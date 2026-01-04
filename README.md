# dPay — Delegated Family Payments

**Tagline:** *Your family's wallet, your keys, your control.*

dPay is a non-custodial family budget management application powered by ERC-7715 delegation, enabling family heads to delegate spending permissions to family members without transferring custody of funds. The platform uses Envio HyperIndex for real-time blockchain event indexing and analytics, providing comprehensive spending insights across all family members.

---

## 🎯 Problem

Managing family finances on-chain is broken. Today, if you want to give your spouse or kids spending money, you have two bad options:

1. **Transfer funds to their wallet** — You lose custody. Once sent, you can't control how it's spent or get it back.

2. **Share your private keys** — Terrible security. Full access means full risk.

Traditional apps like GPay solve this with custodial accounts, but that means trusting a centralized entity with your money. They can freeze accounts, impose limits, and you're locked into their ecosystem.

**What if you could give your family spending power without giving up custody?**

---

## 💡 Solution

**dPay** is a non-custodial family budget management app powered by ERC-7715 delegation. 

The family head (e.g., Dad) holds all funds in a single smart account. Family members receive *spending permissions* — not funds. They can spend up to their budget directly from the family vault, without Dad ever transferring tokens or sharing keys.

> Think of it like a corporate card: the company owns the money, employees can spend within limits, and access can be revoked instantly.

---

## ⚙️ How It Works

```
┌─────────────────┐         ERC-7715          ┌─────────────────┐
│   Family Head   │ ──── Delegate Budget ───► │  Family Member  │
│   (Vault)       │                           │  (Mom/Son/etc)  │
└─────────────────┘                           └─────────────────┘
        │                                              │
        │ Funds stay here                              │ Can spend up to limit
        ▼                                              ▼
┌─────────────────┐                           ┌─────────────────┐
│  Smart Account  │ ◄── redeemDelegations ─── │ Member's Wallet │
│  (Holds $$$)    │                           │ (No funds req)  │
└─────────────────┘                           └─────────────────┘
        │
        ▼
┌─────────────────┐
│  Envio Indexer  │ ──► Real-time Dashboard
└─────────────────┘
```

1. **Family head creates a vault** — A smart account that holds all family funds
2. **Delegates budgets to members** — Using MetaMask's delegation framework (ERC-7715)
   - Mom: $500/month
   - Son: $50/week
   - Daughter: $50/week
3. **Members spend directly** — When they need to pay, they call `redeemDelegations()` which executes a transfer from the vault
4. **Real-time tracking** — Envio indexes all spends, showing who spent what, when, and where
5. **Instant revoke** — One click to revoke any member's access

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Non-Custodial** | Family head keeps full custody — only delegates spending *capability*, not funds |
| **Granular Budgets** | Set per-member limits: weekly, monthly, or custom periods |
| **Hard Limits** | Enforced on-chain by SpendingLimitEnforcer — can't be overridden |
| **Instant Revoke** | Remove access in one transaction — no support tickets |
| **Real-Time Dashboard** | Track all family spending with Envio-powered analytics |
| **No Pre-Funding** | Members don't need tokens in their wallets to spend |
| **Multi-Token Support** | Works with USDC and USDT on multiple chains |
| **Cross-Chain Payments** | Support for Ethereum, Base, Arbitrum, and Optimism (mainnet & testnet) |
| **QR Code Payments** | Shopkeepers can generate payment QR codes for easy checkout |

---

## 🆚 GPay vs dPay

| | GPay | dPay |
|---|---|---|
| **Custody** | Google holds your money | You hold your keys |
| **Budget Control** | Soft limits, can override | Hard on-chain limits |
| **Revoke Access** | Contact support, wait days | One click, instant |
| **Censorship** | Can be frozen | Permissionless |

*Same UX, but you stay in control*

---

## 🔧 Technical Architecture

### Smart Contracts
- **MetaMask DelegationManager** — Core delegation framework (ERC-7715)
- **SpendingLimitEnforcer** — Enforces budget limits per period
- **TimestampEnforcer** — Handles permission expiry
- **ERC-7710** — User operation delegation for seamless payments

### Indexer (Envio HyperIndex)
- **Deployed Endpoint:** `https://indexer.dev.hyperindex.xyz/7422293/v1/graphql`
- Indexes `RedeemedDelegation` and `EnabledDelegation` events
- Decodes actual spend amounts from transaction calldata
- Tracks per-member spending against budgets
- Provides GraphQL API for real-time dashboard analytics
- Supports Base Sepolia (Chain ID: 11155111)

### Backend (Supabase)
- Stores delegation metadata and permission contexts
- Room and member management
- Delegation tracking and history
- Aggregates data from Envio for fast queries

### Frontend
- **Framework:** Next.js 16 with React
- **Styling:** TailwindCSS
- **Wallet Integration:** MetaMask Smart Accounts Kit
- **Features:**
  - Family dashboard with spending analytics
  - Member view showing remaining budget
  - One-click delegation and revocation
  - QR code scanning for payments
  - Cross-chain payment support

---

## 🛠 Tech Stack

- **Blockchain:** Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia (Testnet) | Ethereum Mainnet, Base Mainnet, Arbitrum Mainnet, Optimism Mainnet
- **Delegation:** MetaMask Delegation Framework (ERC-7715, ERC-7710)
- **Smart Accounts:** MetaMask Smart Accounts Kit
- **Indexing:** Envio HyperIndex
- **Backend:** Supabase (PostgreSQL)
- **Frontend:** Next.js 16, React, TailwindCSS
- **Wallet:** MetaMask
- **Cross-Chain:** Across Protocol
- **Bundler:** Pimlico

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- Supabase account
- Envio indexer deployment (or use the provided endpoint)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dpay
   ```

2. **Install dependencies**
   ```bash
   cd webb
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `NEXT_PUBLIC_ALCHEMY_API_KEY` - Alchemy API key for RPC calls
   - `NEXT_PUBLIC_PIMLICO_API_KEY` - Pimlico bundler API key

4. **Set up Supabase database**
   - Run the SQL schema from `webb/supabase-schema.sql`
   - Configure Row Level Security (RLS) policies

5. **Deploy Envio indexer** (optional)
   - Configure `envio/config.yaml` with your contract addresses
   - Deploy to Envio HyperIndex
   - Update GraphQL endpoint in `webb/lib/graphql-client.ts` and API routes

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to `http://localhost:3000`

---

## 📖 Usage Guide

### For Family Heads (Room Owners)

1. **Create a Room**
   - Navigate to `/register`
   - Connect your MetaMask wallet
   - Enter room name and your wallet address
   - Generate QR code invite link

2. **Delegate Budgets**
   - Go to `/rooms` to view your rooms
   - Click "Delegate" next to a member
   - Set amount, period duration, and justification
   - Select network (mainnet/testnet), token (USDC/USDT), and chain
   - Approve delegation in MetaMask

3. **Monitor Spending**
   - View real-time analytics on `/rooms`
   - See total spent, transaction counts, and recent activity
   - Track per-member spending patterns

### For Family Members

1. **Join a Room**
   - Scan the QR code from the family head
   - Or visit `/join` with the invite code
   - A smart account will be automatically created
   - Your session account is stored locally

2. **View Delegations**
   - Go to `/dashboard` to see all your delegations
   - View spending analytics and remaining budgets
   - See transaction history

3. **Make Payments**
   - Click "Pay" on any delegation
   - Enter recipient address and amount
   - Select destination chain for cross-chain payments
   - Confirm transaction (signed with your session account)

4. **Scan & Pay**
   - Click "Scan & Pay" on the dashboard
   - Scan a QR code from a shopkeeper
   - Payment details are pre-filled
   - Confirm and pay

---

## 🎯 Use Cases

1. **Family Allowances** — Give kids weekly spending money without transferring tokens
2. **Household Budgets** — Spouse can pay bills from shared vault
3. **Elderly Care** — Allow caretakers limited spending access for an elderly parent
4. **Travel Budgets** — Give family members travel spending limits that auto-expire
5. **Shared Subscriptions** — Delegate exact amounts for recurring payments
6. **Merchant Payments** — Shopkeepers generate QR codes for seamless checkout

---

## 📊 Envio Indexer Integration

dPay uses Envio HyperIndex to provide real-time analytics and spending insights:

- **Endpoint:** `https://indexer.dev.hyperindex.xyz/7422293/v1/graphql`
- **Indexed Events:**
  - `EnabledDelegation` - When a new delegation is created
  - `RedeemedDelegation` - When a member spends from their budget
  - `DisabledDelegation` - When a delegation is revoked

- **Analytics Provided:**
  - Total spent per member
  - Transaction counts
  - Recent spending activity
  - Budget utilization
  - Time-based spending patterns

The indexer decodes transaction calldata to extract actual spend amounts and provides a GraphQL API for the dashboard to query real-time spending data.

---

## 🔐 Security Features

- **Non-Custodial:** All funds remain in the family head's smart account
- **On-Chain Enforcement:** Budget limits enforced by smart contracts
- **Session Accounts:** Members use locally stored session accounts (no MetaMask required for payments)
- **Private Key Management:** Session account private keys stored securely in browser localStorage
- **Permission-Based Access:** Granular spending permissions with time-based expiry
- **Instant Revocation:** One-click access removal via on-chain transaction

---

## 🚧 What's Next

- [ ] Multi-sig family vaults (require 2 parents to approve large spends)
- [ ] Merchant whitelists (kids can only spend at approved stores)
- [ ] Spending notifications (real-time alerts when family members spend)
- [ ] Budget rollover (unused allowance carries to next period)
- [ ] Mobile app with push notifications
- [ ] ENS name resolution for better UX
- [ ] Recurring delegation automation
- [ ] Spending category tracking

---

## 📝 Project Structure

```
dpay/
├── webb/                    # Next.js frontend application
│   ├── app/                 # Next.js app router pages
│   │   ├── dashboard/       # Member dashboard
│   │   ├── rooms/           # Room owner view
│   │   ├── register/        # Create room
│   │   ├── join/            # Join room
│   │   ├── receipt/         # Generate payment QR
│   │   └── whilepaying/     # Scan and pay
│   ├── components/          # React components
│   │   ├── PaymentModal.tsx
│   │   ├── DelegationModal.tsx
│   │   ├── MemberAnalytics.tsx
│   │   └── VaultAnalytics.tsx
│   ├── lib/                 # Utility functions
│   │   ├── graphql-client.ts
│   │   ├── delegations.ts
│   │   ├── session-account.ts
│   │   ├── swap.ts
│   │   └── network-switch.ts
│   └── app/api/             # API routes
│       ├── vault/           # Vault analytics endpoint
│       └── member/          # Member analytics endpoint
├── envio/                   # Envio indexer configuration
│   └── config.yaml
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

[Specify your license here]

---

## 🔗 Links

- **Live Demo:** [Add your demo link]
- **GitHub:** [Add your GitHub link]
- **Documentation:** [Add documentation link]
- **Video Demo:** [Add video link]

---

## 👥 Team

- [Your name/team]

---

## 🙏 Acknowledgments

- MetaMask for the delegation framework (ERC-7715, ERC-7710)
- Envio for the HyperIndex infrastructure
- Pimlico for bundler services
- Across Protocol for cross-chain swaps

---

*Built for the MetaMask Advanced Permissions Dev Cook-Off* 🍳

