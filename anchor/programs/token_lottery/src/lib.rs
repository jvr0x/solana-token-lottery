use anchor_lang::prelude::*;

declare_id!("BdRpZcRTZiZ6K25izHE8Sb497LLr2CCKvY4uFoGxVJwz");

#[program]
pub mod token_lottery {
    use super::*;

    pub fn initialize_config(
        ctx: Context<Initialize>,
        start_time: u64,
        end_time: u64,
        ticket_price: u64,
    ) -> Result<()> {
        *ctx.accounts.token_lottery = TokenLottery {
            bump: ctx.bumps.token_lottery,
            winner: 0,
            winner_chosen: false,
            start_time,
            end_time,
            lottery_pot_amount: 0,
            total_tickets: 0,
            ticket_price,
            authority: *ctx.accounts.payer.key,
            randomness_account: Pubkey::default(),
        };

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + TokenLottery::INIT_SPACE,
        seeds = [b"token_lottery".as_ref()],
        bump
    )]
    pub token_lottery: Account<'info, TokenLottery>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenLottery {
    pub bump: u8,
    pub winner: u8,
    pub winner_chosen: bool,
    pub start_time: u64,
    pub end_time: u64,
    pub lottery_pot_amount: u64,
    pub total_tickets: u64,
    pub ticket_price: u64,
    pub authority: Pubkey,
    pub randomness_account: Pubkey,
}
