pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("e7cjA4WaVmLBPEfTqxPDocLowPjhTmg1PLKSMwLqNKx");

#[program]
pub mod swap_synto {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(ctx.bumps.escrow)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn swap(ctx: Context<Swap>, payer_amount: u64) -> Result<()> {
        ctx.accounts.swap(payer_amount)
    }
}
