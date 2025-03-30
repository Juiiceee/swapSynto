use crate::Escrow;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = signer, seeds=[b"escrow", signer.key().as_ref()], bump, space = 8 + 8 + 32 + 1)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.escrow.usdc_amount = 0;
        self.escrow.bump = bump;
        self.escrow.owner = self.signer.key();
        Ok(())
    }
}
