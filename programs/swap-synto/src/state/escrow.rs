use anchor_lang::prelude::*;

#[account]
pub struct Escrow {
	pub owner: Pubkey,
    pub usdc_amount: u64,
    pub bump: u8,
}