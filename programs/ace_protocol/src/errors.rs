use anchor_lang::prelude::*;

#[error_code]
pub enum AceError {
    #[msg("Protocol is paused.")]
    ProtocolPaused,

    #[msg("Reserve ratio is below the minimum safe threshold.")]
    ReserveTooLow,

    #[msg("Payment amount exceeds the AI autopilot spend cap.")]
    ExceedsSpendCap,

    #[msg("Insufficient liquid balance for this withdrawal.")]
    InsufficientLiquid,

    #[msg("Insufficient vault balance to execute this payment.")]
    InsufficientFunds,

    #[msg("Payment is not in a schedulable state.")]
    InvalidPaymentStatus,

    #[msg("Payment requires manual approval before execution.")]
    RequiresManualApproval,

    #[msg("Allocation percentages must sum to 100.")]
    InvalidAllocation,

    #[msg("Only the vault owner can perform this action.")]
    Unauthorized,

    #[msg("Payment amount is zero.")]
    ZeroAmount,

    #[msg("x402 endpoint is not authorized under current policy.")]
    X402EndpointBlocked,

    #[msg("Arithmetic overflow.")]
    Overflow,
}
