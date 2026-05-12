use anchor_lang::prelude::*;

// ── ProtocolConfig ────────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct ProtocolConfig {
    /// Admin / pause authority.
    pub admin: Pubkey,
    /// Basis points charged on yield harvests (e.g. 50 = 0.5%).
    pub yield_fee_bps: u16,
    /// Basis points charged on payouts.
    pub payout_fee_bps: u16,
    /// Accumulated fees (lamports) claimable by admin.
    pub pending_fee_lamports: u64,
    /// Whether the entire protocol is paused.
    pub is_paused: bool,
    /// Bump for PDA.
    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 8      // discriminator
        + 32   // admin
        + 2    // yield_fee_bps
        + 2    // payout_fee_bps
        + 8    // pending_fee_lamports
        + 1    // is_paused
        + 1;   // bump
}

// ── Vault ─────────────────────────────────────────────────────────────────────

/// operation_mode encoding: 0 = safe, 1 = autopilot
/// risk_level encoding:     0 = conservative, 1 = balanced, 2 = aggressive
/// status encoding:         0 = active, 1 = paused, 2 = emergency

#[account]
#[derive(Default)]
pub struct Vault {
    /// Owner wallet.
    pub owner: Pubkey,
    /// Current vault status (0=active, 1=paused, 2=emergency).
    pub status: u8,
    /// Total deposited lamports.
    pub total_lamports: u64,
    /// Yield bucket (lamports).
    pub yield_lamports: u64,
    /// Reserve bucket (lamports) — never falls below min_reserve_ratio.
    pub reserve_lamports: u64,
    /// Liquid bucket (lamports) — freely spendable.
    pub liquid_lamports: u64,
    /// Payments bucket (lamports) — locked for upcoming scheduled payments.
    pub payments_lamports: u64,
    /// Risk level (0=conservative, 1=balanced, 2=aggressive).
    pub risk_level: u8,
    /// Allocation % for yield bucket (0–100).
    pub alloc_yield_pct: u8,
    /// Allocation % for reserve bucket (0–100).
    pub alloc_reserve_pct: u8,
    /// Allocation % for liquid bucket (0–100).
    pub alloc_liquid_pct: u8,
    /// Allocation % for payments bucket (0–100).
    pub alloc_payments_pct: u8,
    /// Operation mode (0=safe, 1=autopilot).
    pub operation_mode: u8,
    /// Max lamports the AI autopilot can spend per cycle.
    pub ai_payment_cap_lamports: u64,
    /// Unix timestamp of creation.
    pub created_at: i64,
    /// Unix timestamp of last rebalance.
    pub last_rebalanced_at: i64,
    /// Bump for PDA.
    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 8      // discriminator
        + 32   // owner
        + 1    // status
        + 8    // total_lamports
        + 8    // yield_lamports
        + 8    // reserve_lamports
        + 8    // liquid_lamports
        + 8    // payments_lamports
        + 1    // risk_level
        + 1    // alloc_yield_pct
        + 1    // alloc_reserve_pct
        + 1    // alloc_liquid_pct
        + 1    // alloc_payments_pct
        + 1    // operation_mode
        + 8    // ai_payment_cap_lamports
        + 8    // created_at
        + 8    // last_rebalanced_at
        + 1;   // bump

    /// Minimum reserve ratio in basis points (1500 = 15%).
    pub const MIN_RESERVE_BPS: u64 = 1500;

    /// Reserve ratio in basis points: reserve / total * 10000
    pub fn reserve_ratio_bps(&self) -> u64 {
        if self.total_lamports == 0 {
            return 10_000;
        }
        self.reserve_lamports
            .saturating_mul(10_000)
            .checked_div(self.total_lamports)
            .unwrap_or(0)
    }
}

// ── Payment ───────────────────────────────────────────────────────────────────

/// status encoding:
///   0 = pending (awaiting manual approval in safe mode)
///   1 = scheduled (approved, waiting for due date)
///   2 = executing
///   3 = completed
///   4 = failed
///   5 = cancelled
///   6 = queued (delayed by execution router)

/// kind encoding:
///   0 = subscription
///   1 = payroll
///   2 = bill
///   3 = treasury_payout
///   4 = x402

/// priority encoding:
///   0 = low, 1 = normal, 2 = high

/// recurrence encoding:
///   0 = once, 1 = daily, 2 = weekly, 3 = monthly

#[account]
#[derive(Default)]
pub struct Payment {
    /// Vault that owns this payment.
    pub vault: Pubkey,
    /// Vault owner (redundant for CPI convenience).
    pub owner: Pubkey,
    /// Recipient wallet.
    pub recipient: Pubkey,
    /// Amount in lamports.
    pub amount_lamports: u64,
    /// Current status (see encoding above).
    pub status: u8,
    /// Payment kind (see encoding above).
    pub kind: u8,
    /// Priority (0=low, 1=normal, 2=high).
    pub priority: u8,
    /// Recurrence (0=once, 1=daily, 2=weekly, 3=monthly).
    pub recurrence: u8,
    /// Unix timestamp when payment is next due.
    pub next_due: i64,
    /// Unix timestamp when payment was scheduled.
    pub scheduled_at: i64,
    /// Unix timestamp when payment executed (0 if not yet).
    pub executed_at: i64,
    /// Maximum lamports allowed for x402 auto-payments.
    pub max_spend_lamports: u64,
    /// Whether manual approval has been granted by owner.
    pub approved: bool,
    /// Bump for PDA.
    pub bump: u8,
}

impl Payment {
    pub const LEN: usize = 8      // discriminator
        + 32   // vault
        + 32   // owner
        + 32   // recipient
        + 8    // amount_lamports
        + 1    // status
        + 1    // kind
        + 1    // priority
        + 1    // recurrence
        + 8    // next_due
        + 8    // scheduled_at
        + 8    // executed_at
        + 8    // max_spend_lamports
        + 1    // approved
        + 1;   // bump

    pub const STATUS_PENDING: u8 = 0;
    pub const STATUS_SCHEDULED: u8 = 1;
    pub const STATUS_EXECUTING: u8 = 2;
    pub const STATUS_COMPLETED: u8 = 3;
    pub const STATUS_FAILED: u8 = 4;
    pub const STATUS_CANCELLED: u8 = 5;
    pub const STATUS_QUEUED: u8 = 6;

    pub const KIND_X402: u8 = 4;

    pub const MODE_SAFE: u8 = 0;
    pub const MODE_AUTOPILOT: u8 = 1;

    /// Lamports above which any payment always requires manual approval.
    pub const MANUAL_APPROVAL_THRESHOLD_LAMPORTS: u64 = 500_000_000; // ~$74 at ~$148/SOL
}
