use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY");

#[program]
pub mod ace_protocol {
    use super::*;

    // ── ProtocolConfig ────────────────────────────────────────────────────────

    /// Initialize the global protocol configuration (admin only, once).
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        yield_fee_bps: u16,
        payout_fee_bps: u16,
    ) -> Result<()> {
        instructions::protocol::initialize_protocol(ctx, yield_fee_bps, payout_fee_bps)
    }

    /// Pause or unpause the entire protocol.
    pub fn set_protocol_paused(ctx: Context<SetProtocolPaused>, paused: bool) -> Result<()> {
        instructions::protocol::set_protocol_paused(ctx, paused)
    }

    // ── Vault ─────────────────────────────────────────────────────────────────

    /// Create a new treasury vault for a wallet owner.
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        risk_level: u8,
        yield_pct: u8,
        reserve_pct: u8,
        liquid_pct: u8,
        payments_pct: u8,
    ) -> Result<()> {
        instructions::vault::initialize_vault(
            ctx,
            risk_level,
            yield_pct,
            reserve_pct,
            liquid_pct,
            payments_pct,
        )
    }

    /// Deposit lamports into the vault and update balance buckets.
    pub fn deposit(ctx: Context<Deposit>, amount_lamports: u64) -> Result<()> {
        instructions::vault::deposit(ctx, amount_lamports)
    }

    /// Withdraw from the liquid bucket (enforces reserve floor).
    pub fn withdraw(ctx: Context<Withdraw>, amount_lamports: u64) -> Result<()> {
        instructions::vault::withdraw(ctx, amount_lamports)
    }

    /// Update vault allocation percentages and operation mode.
    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        operation_mode: u8,
        ai_payment_cap_lamports: u64,
        yield_pct: u8,
        reserve_pct: u8,
        liquid_pct: u8,
        payments_pct: u8,
    ) -> Result<()> {
        instructions::vault::update_vault_config(
            ctx,
            operation_mode,
            ai_payment_cap_lamports,
            yield_pct,
            reserve_pct,
            liquid_pct,
            payments_pct,
        )
    }

    // ── Payments ──────────────────────────────────────────────────────────────

    /// Schedule a new payment. Enforces policy caps before accepting.
    pub fn schedule_payment(
        ctx: Context<SchedulePayment>,
        params: SchedulePaymentParams,
    ) -> Result<()> {
        instructions::payment::schedule_payment(ctx, params)
    }

    /// Execute a scheduled payment. Enforces reserve ratio + spend cap.
    pub fn execute_payment(ctx: Context<ExecutePayment>) -> Result<()> {
        instructions::payment::execute_payment(ctx)
    }

    /// Cancel a pending or queued payment and release the reserved amount.
    pub fn cancel_payment(ctx: Context<CancelPayment>) -> Result<()> {
        instructions::payment::cancel_payment(ctx)
    }

    /// Approve a payment that requires manual approval (safe mode).
    pub fn approve_payment(ctx: Context<ApprovePayment>) -> Result<()> {
        instructions::payment::approve_payment(ctx)
    }
}
