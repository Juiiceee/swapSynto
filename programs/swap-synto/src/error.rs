use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Not the owner")]
    NotTheOwner,
}
