use anchor_lang::prelude::*;
use crate::errors::AceError;
use crate::state::ProtocolConfig;

// ── Initialize Protocol ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::LEN,
        seeds = [b"protocol_config"],
        bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_protocol(
    ctx: Context<InitializeProtocol>,
    yield_fee_bps: u16,
    payout_fee_bps: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.yield_fee_bps = yield_fee_bps;
    config.payout_fee_bps = payout_fee_bps;
    config.pending_fee_lamports = 0;
    config.is_paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}

// ── Set Protocol Paused ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct SetProtocolPaused<'info> {
    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump = config.bump,
        has_one = admin @ AceError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub admin: Signer<'info>,
}

pub fn set_protocol_paused(ctx: Context<SetProtocolPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.is_paused = paused;
    Ok(())
}
