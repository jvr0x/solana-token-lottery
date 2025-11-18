import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token'
import * as sb from '@switchboard-xyz/on-demand'
import SwitchboardIDL from '../switchboard.json'
import { TokenLottery } from '../target/types/token_lottery'

describe('tokenlottery', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const wallet = provider.wallet as anchor.Wallet

  const program = anchor.workspace.TokenLottery as Program<TokenLottery>

  let switchboardProgram = new anchor.Program(SwitchboardIDL as anchor.Idl, provider)
  const rngKp = anchor.web3.Keypair.generate()

  // fetch the switchboard idl and store it
  // beforeAll(async () => {
  //   const switchboardIDL = await anchor.Program.fetchIdl(
  //     sb.ON_DEMAND_MAINNET_PID,
  //     {connection: new anchor.web3.Connection("https://api.mainnet-beta.solana.com")}
  //   ) as anchor.Idl;

  //   var fs = require('fs');
  //   fs.writeFile("switchboard.json", JSON.stringify(switchboardIDL), function(err) {
  //     if (err) {
  //       console.log(err);
  //     }
  //   })

  //   switchboardProgram = new anchor.Program(switchboardIDL, provider);
  // });

  async function buyTicket() {
    const buyTicketIx = await program.methods
      .buyTicket()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()

    const computeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    })

    const priorityIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    })

    const blockhashContext = await provider.connection.getLatestBlockhash()

    const tx = new anchor.web3.Transaction({
      blockhash: blockhashContext.blockhash,
      lastValidBlockHeight: blockhashContext.lastValidBlockHeight,
      feePayer: wallet.payer.publicKey,
    })
      .add(buyTicketIx)
      .add(computeIx)
      .add(priorityIx)

    const sig = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [wallet.payer])
    console.log('buy ticket ', sig)
  }

  it('should test token lottery', async () => {
    const initConfigIx = await program.methods
      .initializeConfig(new anchor.BN(0), new anchor.BN(1863137100), new anchor.BN(10000))
      .instruction()

    const blockhashWithContext = await provider.connection.getLatestBlockhash()

    const tx = new anchor.web3.Transaction({
      feePayer: provider.wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    }).add(initConfigIx)

    const signature = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [wallet.payer])
    console.log('Your transaction signature', signature)

    const initLotteryIx = await program.methods
      .initializeLottery()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()

    const initLotteryTx = new anchor.web3.Transaction({
      feePayer: provider.wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    }).add(initLotteryIx)

    const initLotterySignature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      initLotteryTx,
      [wallet.payer],
      { skipPreflight: true },
    )
    console.log('Your initLottery transaction signature', initLotterySignature)

    await buyTicket()
    await buyTicket()
    await buyTicket()
    await buyTicket()
    await buyTicket()
    await buyTicket()
    await buyTicket()
    await buyTicket()

    const queue = new anchor.web3.PublicKey('A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w')
    const queueAccount = new sb.Queue(switchboardProgram, queue)

    try {
      await queueAccount.loadData()
    } catch (error) {
      console.log('Error', error)
      process.exit(1)
    }

    const [randomness, createRandomnessIx] = await sb.Randomness.create(switchboardProgram, rngKp, queue)
    const createRandomnessTx = await sb.asV0Tx({
      connection: provider.connection,
      ixs: [createRandomnessIx],
      payer: wallet.publicKey,
      signers: [wallet.payer, rngKp],
    })

    const createRandomnessSignature = await provider.connection.sendTransaction(createRandomnessTx)

    // Wait for confirmation with finalized commitment
    await provider.connection.confirmTransaction(createRandomnessSignature, 'finalized')
    
    console.log('createRandomnessSignature', createRandomnessSignature)

    const sbCommitIx = await randomness.commitIx(queue)

    const commitIx = await program.methods
      .commitRandomness()
      .accounts({
        randomnessAccount: randomness.pubkey,
      })
      .instruction()

    const commitComputeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 100000,
    })

    const commitPriorityIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    })

    const commitBlockhashWithContext = await provider.connection.getLatestBlockhash()

    const commitTx = new anchor.web3.Transaction({
      feePayer: provider.wallet.publicKey,
      blockhash: commitBlockhashWithContext.blockhash,
      lastValidBlockHeight: commitBlockhashWithContext.lastValidBlockHeight,
    })
      .add(commitComputeIx)
      .add(commitPriorityIx)
      .add(sbCommitIx)
      .add(commitIx);
    
    const commitSignature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection, commitTx, [wallet.payer]
    );
    
    console.log('commitSignature', commitSignature);
  }, 300000);
})
