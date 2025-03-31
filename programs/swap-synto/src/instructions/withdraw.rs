use crate::ErrorCode;
use crate::Escrow;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self) -> Result<()> {
        let lamports = self.escrow.to_account_info().lamports();

        require!(
            self.escrow.owner == self.signer.key(),
            ErrorCode::NotTheOwner
        );

        **self.escrow.to_account_info().try_borrow_mut_lamports()? = 0;
        **self.signer.to_account_info().try_borrow_mut_lamports()? += lamports;

        Ok(())
    }
}
