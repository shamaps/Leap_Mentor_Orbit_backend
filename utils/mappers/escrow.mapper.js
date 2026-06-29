// utils/mappers/escrow.mapper.js
const toPayDTO = (data) => ({
    mentorAmount: data.mentorAmount,
    platformFee: data.platformFee,
    totalAmount: data.totalAmount,
    commissionRate: data.commissionRate,
    balance: data.balance,
    escrow: data.escrow,
    paymentStatus: data.paymentStatus,
    status: data.status,
});

const toReleaseDTO = (data) => ({
    totalAmount: data.totalAmount,
    commissionRate: data.commissionRate,
    commissionAmount: data.commissionAmount,
    mentorPayout: data.mentorPayout,
    menteeEscrow: data.menteeEscrow,
    status: data.status,
});

const toRefundDTO = (data) => ({
    totalAmount: data.totalAmount,
    balance: data.balance,
    escrow: data.escrow,
    status: data.status,
    paymentStatus: data.paymentStatus,
});

const toEscrowStatusDTO = (data) => ({
    status: data.status,
    paymentStatus: data.paymentStatus,
    sessionRate: data.sessionRate,
    sessionCount: data.sessionCount,
    totalAmount: data.totalAmount,
    paidAt: data.paidAt,
    completedAt: data.completedAt,
    confirmedSlot: data.confirmedSlot,
    commissionRate: data.commissionRate,
    wallet: data.wallet,
});

const toWalletDTO = (data) => ({
    balance: data.balance,
    escrow: data.escrow,
});

module.exports = { toPayDTO, toReleaseDTO, toRefundDTO, toEscrowStatusDTO, toWalletDTO };