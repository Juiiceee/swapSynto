use crate::Escrow;
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut, seeds=[b"escrow", signer.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> Swap<'info> {
    pub fn swap(&mut self, payer_amount: u64) -> Result<()> {
        let seeds = &[
            b"escrow",
            self.signer.to_account_info().key.as_ref(),
            &[self.escrow.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                system_program::Transfer {
                    from: self.signer.to_account_info(),
                    to: self.escrow.to_account_info(),
                },
            ),
            payer_amount,
        )?;

        let usdc_amount: u64 = (payer_amount * 130_000_000) / 1_000_000_000;
        msg!("le nombre d'usdc envoye {}", usdc_amount);
        self.escrow.usdc_amount -= usdc_amount;
        msg!(
            "le nombre d'usdc dans l'account escrow {}",
            self.escrow.usdc_amount
        );
        let cpi_accounts = Transfer {
            from: self.vault_token_account.to_account_info(),
            to: self.user_token_account.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        token::transfer(cpi_ctx, usdc_amount)?;
        Ok(())
    }
}
