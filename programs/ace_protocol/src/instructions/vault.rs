use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::AceError;
use crate::state::{ProtocolConfig, Vault};

// ── Initialize Vault ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        seeds = [b"protocol_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = owner,
        space = Vault::LEN,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_vault(
    ctx: Context<InitializeVault>,
    risk_level: u8,
    yield_pct: u8,
    reserve_pct: u8,
    liquid_pct: u8,
    payments_pct: u8,
) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, AceError::ProtocolPaused);
    let sum = yield_pct as u16 + reserve_pct as u16 + liquid_pct as u16 + payments_pct as u16;
    require!(sum == 100, AceError::InvalidAllocation);

    let vault = &mut ctx.accounts.vault;
    let now = Clock::get()?.unix_timestamp;

    vault.owner = ctx.accounts.owner.key();
    vault.status = 0; // active
    vault.total_lamports = 0;
    vault.yield_lamports = 0;
    vault.reserve_lamports = 0;
    vault.liquid_lamports = 0;
    vault.payments_lamports = 0;
    vault.risk_level = risk_level;
    vault.alloc_yield_pct = yield_pct;
    vault.alloc_reserve_pct = reserve_pct;
    vault.alloc_liquid_pct = liquid_pct;
    vault.alloc_payments_pct = payments_pct;
    vault.operation_mode = 0; // safe by default
    vault.ai_payment_cap_lamports = 500_000_000; // ~$74
    vault.created_at = now;
    vault.last_rebalanced_at = now;
    vault.bump = ctx.bumps.vault;

    emit!(VaultInitialized {
        owner: vault.owner,
        vault: ctx.accounts.vault.key(),
        timestamp: now,
    });

    Ok(())
}

// ── Deposit ───────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"protocol_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AceError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, amount_lamports: u64) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, AceError::ProtocolPaused);
    require!(amount_lamports > 0, AceError::ZeroAmount);

    // Transfer lamports from owner to vault PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount_lamports)?;

    // Distribute into buckets according to allocation %
    let vault = &mut ctx.accounts.vault;
    let yield_amt = amount_lamports
        .checked_mul(vault.alloc_yield_pct as u64)
        .ok_or(AceError::Overflow)?
        .checked_div(100)
        .ok_or(AceError::Overflow)?;
    let reserve_amt = amount_lamports
        .checked_mul(vault.alloc_reserve_pct as u64)
        .ok_or(AceError::Overflow)?
        .checked_div(100)
        .ok_or(AceError::Overflow)?;
    let payments_amt = amount_lamports
        .checked_mul(vault.alloc_payments_pct as u64)
        .ok_or(AceError::Overflow)?
        .checked_div(100)
        .ok_or(AceError::Overflow)?;
    // Liquid gets the remainder to avoid rounding dust
    let liquid_amt = amount_lamports
        .saturating_sub(yield_amt)
        .saturating_sub(reserve_amt)
        .saturating_sub(payments_amt);

    vault.total_lamports = vault.total_lamports.checked_add(amount_lamports).ok_or(AceError::Overflow)?;
    vault.yield_lamports = vault.yield_lamports.checked_add(yield_amt).ok_or(AceError::Overflow)?;
    vault.reserve_lamports = vault.reserve_lamports.checked_add(reserve_amt).ok_or(AceError::Overflow)?;
    vault.liquid_lamports = vault.liquid_lamports.checked_add(liquid_amt).ok_or(AceError::Overflow)?;
    vault.payments_lamports = vault.payments_lamports.checked_add(payments_amt).ok_or(AceError::Overflow)?;

    emit!(Deposited {
        owner: vault.owner,
        vault: ctx.accounts.vault.key(),
        amount_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"protocol_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AceError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount_lamports: u64) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, AceError::ProtocolPaused);
    require!(amount_lamports > 0, AceError::ZeroAmount);

    // Snapshot immutable values before mutable borrow
    let owner_key = ctx.accounts.vault.owner;
    let vault_bump = ctx.accounts.vault.bump;
    let liquid = ctx.accounts.vault.liquid_lamports;
    let total = ctx.accounts.vault.total_lamports;
    let reserve = ctx.accounts.vault.reserve_lamports;

    require!(liquid >= amount_lamports, AceError::InsufficientLiquid);

    // Check reserve floor after withdrawal
    let new_total = total.saturating_sub(amount_lamports);
    if new_total > 0 {
        let new_reserve_bps = reserve.saturating_mul(10_000).checked_div(new_total).unwrap_or(0);
        require!(new_reserve_bps >= Vault::MIN_RESERVE_BPS, AceError::ReserveTooLow);
    }

    // Transfer lamports from vault PDA back to owner using PDA signer
    let seeds = &[b"vault" as &[u8], owner_key.as_ref(), &[vault_bump]];
    let signer = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.owner.to_account_info(),
        },
        signer,
    );
    system_program::transfer(cpi_ctx, amount_lamports)?;

    let vault = &mut ctx.accounts.vault;
    vault.total_lamports = vault.total_lamports.saturating_sub(amount_lamports);
    vault.liquid_lamports = vault.liquid_lamports.saturating_sub(amount_lamports);
    let vault_key = vault.key();
    let vault_owner = vault.owner;

    emit!(Withdrawn {
        owner: vault_owner,
        vault: vault_key,
        amount_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

// ── Update Vault Config ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AceError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

pub fn update_vault_config(
    ctx: Context<UpdateVaultConfig>,
    operation_mode: u8,
    ai_payment_cap_lamports: u64,
    yield_pct: u8,
    reserve_pct: u8,
    liquid_pct: u8,
    payments_pct: u8,
) -> Result<()> {
    let sum = yield_pct as u16 + reserve_pct as u16 + liquid_pct as u16 + payments_pct as u16;
    require!(sum == 100, AceError::InvalidAllocation);

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    vault.operation_mode = operation_mode;
    vault.ai_payment_cap_lamports = ai_payment_cap_lamports;
    vault.alloc_yield_pct = yield_pct;
    vault.alloc_reserve_pct = reserve_pct;
    vault.alloc_liquid_pct = liquid_pct;
    vault.alloc_payments_pct = payments_pct;
    vault.last_rebalanced_at = now;
    let vault_key = vault.key();
    let vault_owner = vault.owner;

    emit!(VaultConfigUpdated {
        owner: vault_owner,
        vault: vault_key,
        operation_mode,
        timestamp: now,
    });

    Ok(())
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct VaultInitialized {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub amount_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct Withdrawn {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub amount_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultConfigUpdated {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub operation_mode: u8,
    pub timestamp: i64,
}
