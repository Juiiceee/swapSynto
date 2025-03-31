use crate::ErrorCode;
use crate::Escrow;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds=[b"escrow", signer.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self) -> Result<()> {
        let lamports = self.escrow.to_account_info().lamports();
        let rent_exempt_amount = Rent::get()?.minimum_balance(49);
        require!(
            self.escrow.owner == self.signer.key(),
            ErrorCode::NotTheOwner
        );

        let amount_to_transfer = lamports.saturating_sub(rent_exempt_amount);

        **self.escrow.to_account_info().try_borrow_mut_lamports()? -= amount_to_transfer;
        **self.signer.to_account_info().try_borrow_mut_lamports()? += amount_to_transfer;

        Ok(())
    }
}
