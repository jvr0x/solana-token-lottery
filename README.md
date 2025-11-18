# Token Lottery

A decentralized lottery system on Solana that issues NFT tickets and uses Switchboard's verifiable randomness to select winners fairly and transparently.

## Overview

Token Lottery is a Solana program built with the Anchor framework that enables:
- **NFT Lottery Tickets**: Each lottery ticket is a unique NFT from a verified collection
- **Verifiable Randomness**: Winner selection uses Switchboard's on-demand randomness for provably fair results
- **Time-bound Lotteries**: Configure start and end times for lottery periods
- **Automated Prize Distribution**: Winners can claim the prize pot by proving ownership of the winning ticket NFT
- **Metaplex Integration**: Full NFT metadata support with collection verification

## Features

### Core Functionality

1. **Lottery Configuration**
   - Set custom start and end times
   - Configure ticket prices
   - Authority-controlled administration

2. **NFT Ticket System**
   - Each ticket is a unique NFT with metadata
   - Tickets are part of a verified collection
   - Sequential numbering: "Token Lottery Ticket #0", "#1", etc.
   - Non-fungible tokens (decimals = 0)

3. **Verifiable Random Winner Selection**
   - Integration with Switchboard's on-demand randomness
   - Two-phase commit-reveal scheme prevents manipulation
   - Cryptographically secure randomness

4. **Collection Management**
   - Program-owned collection mint
   - Automatic collection verification for each ticket
   - Master edition support for both collection and tickets

## Program Architecture

### State

**TokenLottery Account** (PDA: `["token_lottery"]`)
```rust
pub struct TokenLottery {
    pub bump: u8,
    pub winner: u64,                    // Winning ticket number
    pub winner_chosen: bool,             // Winner selection status
    pub start_time: u64,                 // Lottery start slot
    pub end_time: u64,                   // Lottery end slot
    pub lottery_pot_amount: u64,         // Total collected funds
    pub total_tickets: u64,              // Number of tickets sold
    pub ticket_price: u64,               // Price per ticket in lamports
    pub authority: Pubkey,               // Admin authority
    pub randomness_account: Pubkey,      // Switchboard randomness account
}
```

### Instructions

#### 1. `initialize_config`
Initializes the lottery configuration with timing and pricing parameters.

**Parameters:**
- `start_time`: Slot number when ticket sales begin
- `end_time`: Slot number when ticket sales end
- `ticket_price`: Cost per ticket in lamports

#### 2. `initialize_lottery`
Creates the NFT collection that all lottery tickets belong to.

**Actions:**
- Creates collection mint (PDA: `["collection_mint"]`)
- Mints collection NFT
- Creates metadata account
- Creates master edition
- Verifies creator signature

#### 3. `buy_ticket`
Purchases a lottery ticket as an NFT.

**Actions:**
- Validates lottery is open (current slot between start_time and end_time)
- Transfers ticket price from buyer to lottery account
- Creates unique ticket mint (PDA: `[total_tickets.to_le_bytes()]`)
- Mints ticket NFT to buyer
- Creates ticket metadata with sequential name
- Creates ticket master edition
- Verifies ticket as part of collection
- Increments total_tickets counter

#### 4. `commit_randomness`
Commits to Switchboard randomness for winner selection (authority only).

**Actions:**
- Validates caller is lottery authority
- Validates randomness was committed in previous slot (prevents front-running)
- Stores randomness account reference

**Security:** Requires randomness to be from `slot - 1` to prevent manipulation after seeing randomness value.

#### 5. `reveal_winner`
Reveals the lottery winner using committed randomness (authority only).

**Actions:**
- Validates caller is lottery authority
- Validates lottery has ended (current slot >= end_time)
- Validates winner hasn't been chosen yet
- Retrieves randomness value from Switchboard
- Calculates winner: `randomness[0] % total_tickets`
- Marks winner as chosen

#### 6. `claim_winnings`
Allows the winner to claim the lottery prize pot.

**Actions:**
- Validates winner has been chosen
- Validates ticket is verified member of collection
- Validates ticket belongs to correct collection
- Validates ticket name matches winning ticket number
- Validates caller owns the winning ticket NFT (amount > 0)
- Transfers entire lottery pot to winner
- Resets lottery_pot_amount to 0

**Security:**
- Only the holder of the winning ticket NFT can claim
- Ticket must be part of the verified collection
- Ticket metadata name must match "Token Lottery Ticket #[winner_number]"
- Winner must hold at least 1 of the winning ticket in their account

## Technical Stack

### Smart Contract
- **Framework**: Anchor v0.31.1
- **Language**: Rust
- **Token Standard**: SPL Token / Token-2022
- **NFT Standard**: Metaplex Token Metadata
- **Randomness**: Switchboard On-Demand v3.5.0

### Frontend
- **Framework**: Next.js 15.5.3
- **UI Library**: React 19.1.1
- **Styling**: Tailwind CSS 4.1.13
- **Wallet Integration**: Solana Wallet Adapter
- **State Management**: TanStack Query + Jotai
- **Components**: Radix UI primitives

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.31.1+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd token-lottery

# Install dependencies
pnpm install
```

### Build the Program

```bash
# Build the Anchor program
pnpm anchor-build

# Sync program ID
pnpm anchor keys sync
```

### Testing

```bash
# Run local validator
pnpm anchor-localnet

# In another terminal, run tests
pnpm anchor-test

# Or run tests with local validator (starts and stops validator)
anchor test
```

### Deployment

#### Devnet
```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Airdrop SOL for deployment
solana airdrop 2

# Deploy the program
pnpm anchor deploy --provider.cluster devnet
```

#### Mainnet
```bash
# Configure Solana CLI for mainnet
solana config set --url mainnet-beta

# Deploy the program (ensure you have sufficient SOL)
pnpm anchor deploy --provider.cluster mainnet-beta
```

### Running the Frontend

```bash
# Start development server
pnpm dev

# Open http://localhost:3000
```

## Usage Flow

### 1. Initialize Lottery
```typescript
await program.methods
  .initializeConfig(
    new BN(startSlot),
    new BN(endSlot),
    new BN(ticketPriceInLamports)
  )
  .rpc();
```

### 2. Create NFT Collection
```typescript
await program.methods
  .initializeLottery()
  .accounts({
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

### 3. Buy Tickets
```typescript
await program.methods
  .buyTicket()
  .accounts({
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

### 4. Commit Randomness (After Lottery Ends)
```typescript
// Create Switchboard randomness account
const [randomness, createIx] = await Randomness.create(
  switchboardProgram,
  randomnessKeypair,
  queuePubkey
);

// Commit randomness to Switchboard
const commitIx = await randomness.commitIx(queuePubkey);

// Commit randomness reference to lottery
await program.methods
  .commitRandomness()
  .accounts({
    randomnessAccount: randomness.pubkey,
  })
  .rpc();
```

### 5. Reveal Winner
```typescript
await program.methods
  .revealWinner()
  .accounts({
    randomnessAccount: randomness.pubkey,
  })
  .rpc();

// Check winner
const lotteryAccount = await program.account.tokenLottery.fetch(lotteryPda);
console.log(`Winner is ticket #${lotteryAccount.winner}`);
```

### 6. Claim Winnings (Winner Only)
```typescript
// Winner claims their prize
await program.methods
  .claimWinnings()
  .accounts({
    ticketMint: winningTicketMintPda,
    collectionMint: collectionMintPda,
    ticketMetadata: winningTicketMetadataPda,
    ticketAccount: winnerTokenAccount, // Winner's ATA holding the winning ticket
    collectionMetadata: collectionMetadataPda,
    tokenMetadataProgram: METADATA_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();

// Verify funds received
const winnerBalance = await provider.connection.getBalance(winnerPublicKey);
console.log(`Winner received: ${winnerBalance} lamports`);
```

## Security Considerations

### Randomness Security
- **Commit-Reveal Scheme**: Randomness must be committed in slot N-1 and revealed in slot N
- **No Front-Running**: Authority cannot choose winner after seeing randomness value
- **Verifiable**: Switchboard provides cryptographic proof of randomness generation

### Access Control
- Only lottery authority can commit randomness and reveal winner
- Ticket purchases restricted to lottery time window
- Winner can only be chosen once
- Only holder of winning ticket NFT can claim prize

### Prize Claiming Security
- **NFT Ownership Verification**: Winner must hold the winning ticket NFT in their account
- **Collection Verification**: Ticket must be part of the verified collection
- **Metadata Validation**: Ticket name must exactly match the winning ticket number
- **Amount Check**: Winner must hold at least 1 of the winning ticket (amount > 0)
- **Single Claim**: Prize pot is emptied after claim, preventing double-claiming
- **Null-byte Handling**: Metadata name is sanitized to remove null bytes before comparison

### NFT Security
- Collection mint is a PDA owned by the program
- Tickets are verifiable members of the collection
- Metaplex metadata follows standard conventions
- Winning ticket is derived deterministically from winner number

## Program Addresses

### PDAs (Program Derived Addresses)
- Lottery Config: `["token_lottery"]`
- Collection Mint: `["collection_mint"]`
- Collection Token Account: `["collection_associated_token"]`
- Ticket Mints: `[ticket_number.to_le_bytes()]` (where ticket_number is sequential)

### External Programs
- Token Program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Associated Token Program: `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`
- Metadata Program: `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`
- Switchboard On-Demand: `SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv`

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0x1770 | LotteryNotOpen | Lottery is not currently accepting ticket purchases |
| 0x1771 | Unauthorized | Caller is not the lottery authority |
| 0x1772 | RandomnessAlreadyRevealed | Randomness has already been committed/used |
| 0x1773 | LotteryNotCompleted | Lottery end time has not been reached |
| 0x1774 | WinnerChosen | Winner has already been selected |
| 0x1775 | WinnerNotChosen | Winner has not been chosen yet (required for claiming) |
| 0x1776 | RandomnessNotResolved | Switchboard randomness is not yet available |
| 0x1777 | NotVerifiedTicket | Ticket is not a verified member of the collection |
| 0x1778 | IncorrectTicket | Ticket does not match the winning ticket or caller doesn't own it |

## Project Structure

```
token-lottery/
├── anchor/
│   ├── programs/
│   │   └── token_lottery/
│   │       └── src/
│   │           └── lib.rs          # Main program logic
│   ├── tests/
│   │   └── token-lottery.test.ts   # Integration tests
│   ├── Anchor.toml                  # Anchor configuration
│   └── Cargo.toml                   # Rust dependencies
├── src/
│   ├── app/                         # Next.js app directory
│   ├── components/                  # React components
│   └── features/                    # Feature modules
├── package.json                     # Node dependencies
└── README.md                        # This file
```

## Development

### Format Code
```bash
# Format Rust code
cd anchor && cargo fmt

# Format TypeScript/JavaScript
pnpm format
```

### Lint
```bash
# Lint TypeScript/JavaScript
pnpm lint

# Clippy for Rust
cd anchor && cargo clippy -- -D warnings
```

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Switchboard Documentation](https://docs.switchboard.xyz/)
- [Metaplex Documentation](https://docs.metaplex.com/)

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review test files for usage examples
