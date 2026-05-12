use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::AceError;
use crate::state::{Payment, ProtocolConfig, Vault};

// ── Schedule Payment ──────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SchedulePaymentParams {
    /// Unique payment ID (bytes32, e.g. uuid encoded as [u8;32]).
    pub payment_id: [u8; 32],
    /// Recipient wallet.
    pub recipient: Pubkey,
    /// Amount in lamports.
    pub amount_lamports: u64,
    /// Payment kind (0=subscription,1=payroll,2=bill,3=treasury_payout,4=x402).
    pub kind: u8,
    /// Priority (0=low,1=normal,2=high).
    pub priority: u8,
    /// Recurrence (0=once,1=daily,2=weekly,3=monthly).
    pub recurrence: u8,
    /// Unix timestamp when payment is first due.
    pub next_due: i64,
    /// Max lamports for x402 autopay (0 if not x402).
    pub max_spend_lamports: u64,
}

#[derive(Accounts)]
#[instruction(params: SchedulePaymentParams)]
pub struct SchedulePayment<'info> {
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

    #[account(
        init,
        payer = owner,
        space = Payment::LEN,
        seeds = [b"payment", vault.key().as_ref(), &params.payment_id],
        bump,
    )]
    pub payment: Account<'info, Payment>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn schedule_payment(ctx: Context<SchedulePayment>, params: SchedulePaymentParams) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, AceError::ProtocolPaused);
    require!(params.amount_lamports > 0, AceError::ZeroAmount);

    let vault = &mut ctx.accounts.vault;
    let payment = &mut ctx.accounts.payment;
    let now = Clock::get()?.unix_timestamp;

    // Determine if manual approval is required:
    // - safe mode always requires approval
    // - any payment above threshold requires approval regardless of mode
    let requires_approval = vault.operation_mode == Payment::MODE_SAFE
        || params.amount_lamports >= Payment::MANUAL_APPROVAL_THRESHOLD_LAMPORTS;

    // In autopilot mode for x402 payments, also enforce x402 spend cap
    if vault.operation_mode == Payment::MODE_AUTOPILOT && params.kind == Payment::KIND_X402 {
        require!(
            params.amount_lamports <= vault.ai_payment_cap_lamports,
            AceError::ExceedsSpendCap
        );
    }

    // Reserve funds in the payments bucket
    require!(
        vault.payments_lamports >= params.amount_lamports
            || vault.liquid_lamports >= params.amount_lamports,
        AceError::InsufficientFunds
    );

    // Deduct from payments bucket first, then liquid
    if vault.payments_lamports >= params.amount_lamports {
        vault.payments_lamports = vault.payments_lamports.saturating_sub(params.amount_lamports);
    } else {
        vault.liquid_lamports = vault.liquid_lamports.saturating_sub(params.amount_lamports);
    }

    payment.vault = ctx.accounts.vault.key();
    payment.owner = ctx.accounts.owner.key();
    payment.recipient = params.recipient;
    payment.amount_lamports = params.amount_lamports;
    payment.kind = params.kind;
    payment.priority = params.priority;
    payment.recurrence = params.recurrence;
    payment.next_due = params.next_due;
    payment.scheduled_at = now;
    payment.executed_at = 0;
    payment.max_spend_lamports = params.max_spend_lamports;
    payment.approved = !requires_approval;
    payment.status = if requires_approval {
        Payment::STATUS_PENDING // awaiting owner approval
    } else {
        Payment::STATUS_SCHEDULED
    };
    payment.bump = ctx.bumps.payment;

    emit!(PaymentScheduled {
        owner: payment.owner,
        vault: payment.vault,
        payment: ctx.accounts.payment.key(),
        amount_lamports: params.amount_lamports,
        next_due: params.next_due,
        requires_approval,
        timestamp: now,
    });

    Ok(())
}

// ── Approve Payment ───────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ApprovePayment<'info> {
    #[account(
        mut,
        has_one = owner @ AceError::Unauthorized,
        constraint = payment.vault == vault.key(),
    )]
    pub payment: Account<'info, Payment>,

    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

pub fn approve_payment(ctx: Context<ApprovePayment>) -> Result<()> {
    require!(
        ctx.accounts.payment.status == Payment::STATUS_PENDING,
        AceError::InvalidPaymentStatus
    );
    let pay_owner = ctx.accounts.payment.owner;
    ctx.accounts.payment.approved = true;
    ctx.accounts.payment.status = Payment::STATUS_SCHEDULED;
    let payment_key = ctx.accounts.payment.key();

    emit!(PaymentApproved {
        owner: pay_owner,
        payment: payment_key,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

// ── Execute Payment ───────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ExecutePayment<'info> {
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

    #[account(
        mut,
        has_one = owner @ AceError::Unauthorized,
        constraint = payment.vault == vault.key(),
    )]
    pub payment: Account<'info, Payment>,

    /// CHECK: recipient verified against payment account
    #[account(
        mut,
        constraint = recipient.key() == payment.recipient,
    )]
    pub recipient: UncheckedAccount<'info>,

    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn execute_payment(ctx: Context<ExecutePayment>) -> Result<()> {
    require!(!ctx.accounts.config.is_paused, AceError::ProtocolPaused);

    let now = Clock::get()?.unix_timestamp;

    // Snapshot all needed values before any mutable borrows
    let pay_status = ctx.accounts.payment.status;
    let pay_approved = ctx.accounts.payment.approved;
    let pay_priority = ctx.accounts.payment.priority;
    let pay_amount = ctx.accounts.payment.amount_lamports;
    let pay_owner = ctx.accounts.payment.owner;
    let pay_vault = ctx.accounts.payment.vault;
    let pay_recipient = ctx.accounts.payment.recipient;

    let vault_mode = ctx.accounts.vault.operation_mode;
    let vault_cap = ctx.accounts.vault.ai_payment_cap_lamports;
    let vault_owner_key = ctx.accounts.vault.owner;
    let vault_bump = ctx.accounts.vault.bump;
    let reserve_bps = ctx.accounts.vault.reserve_ratio_bps();

    // Status must be scheduled (approved)
    require!(pay_status == Payment::STATUS_SCHEDULED, AceError::InvalidPaymentStatus);
    require!(pay_approved, AceError::RequiresManualApproval);

    // Reserve ratio check — block optional (low-priority) payments if reserve is low
    if pay_priority == 0 {
        require!(reserve_bps >= Vault::MIN_RESERVE_BPS, AceError::ReserveTooLow);
    }

    // Autopilot spend cap enforcement
    if vault_mode == Payment::MODE_AUTOPILOT {
        require!(pay_amount <= vault_cap, AceError::ExceedsSpendCap);
    }

    // Transfer from vault PDA to recipient
    let seeds = &[b"vault" as &[u8], vault_owner_key.as_ref(), &[vault_bump]];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.recipient.to_account_info(),
        },
        signer,
    );
    system_program::transfer(cpi_ctx, pay_amount)?;

    // Update vault totals
    ctx.accounts.vault.total_lamports =
        ctx.accounts.vault.total_lamports.saturating_sub(pay_amount);

    // Update payment status
    ctx.accounts.payment.status = Payment::STATUS_COMPLETED;
    ctx.accounts.payment.executed_at = now;
    let payment_key = ctx.accounts.payment.key();

    emit!(PaymentExecuted {
        owner: pay_owner,
        vault: pay_vault,
        payment: payment_key,
        recipient: pay_recipient,
        amount_lamports: pay_amount,
        timestamp: now,
    });

    Ok(())
}

// ── Cancel Payment ────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct CancelPayment<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AceError::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        has_one = owner @ AceError::Unauthorized,
        constraint = payment.vault == vault.key(),
        close = owner,
    )]
    pub payment: Account<'info, Payment>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn cancel_payment(ctx: Context<CancelPayment>) -> Result<()> {
    let pay_status = ctx.accounts.payment.status;
    let pay_amount = ctx.accounts.payment.amount_lamports;
    let pay_owner = ctx.accounts.payment.owner;
    let pay_vault = ctx.accounts.payment.vault;
    let payment_key = ctx.accounts.payment.key();

    require!(
        pay_status == Payment::STATUS_PENDING
            || pay_status == Payment::STATUS_SCHEDULED
            || pay_status == Payment::STATUS_QUEUED,
        AceError::InvalidPaymentStatus
    );

    // Return reserved lamports back to liquid bucket
    ctx.accounts.vault.liquid_lamports = ctx.accounts.vault
        .liquid_lamports
        .checked_add(pay_amount)
        .ok_or(AceError::Overflow)?;

    emit!(PaymentCancelled {
        owner: pay_owner,
        vault: pay_vault,
        payment: payment_key,
        amount_lamports: pay_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    // Account is closed by anchor (close = owner) and rent returned to owner
    Ok(())
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct PaymentScheduled {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub payment: Pubkey,
    pub amount_lamports: u64,
    pub next_due: i64,
    pub requires_approval: bool,
    pub timestamp: i64,
}

#[event]
pub struct PaymentApproved {
    pub owner: Pubkey,
    pub payment: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PaymentExecuted {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub payment: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct PaymentCancelled {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub payment: Pubkey,
    pub amount_lamports: u64,
    pub timestamp: i64,
}
