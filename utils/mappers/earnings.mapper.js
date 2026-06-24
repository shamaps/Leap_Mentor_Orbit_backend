// utils/mappers/earnings.mapper.js
const toEarningsSummaryDTO = (data) => ({
    totalEarnings: data.totalEarnings,
    sessionsThisMonth: data.sessionsThisMonth,
    avgRating: data.avgRating,
    pendingPayout: data.pendingPayout,
    walletBalance: data.walletBalance,
});

const toEarningsChartDTO = (data) => ({
    period: data.period,
    data: data.data,
});

const toPayoutRowDTO = (r) => ({
    id: r._id,
    date: r.completedAt
        ? new Date(r.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—",
    menteeName: r.mentee?.name || "—",
    menteeEmail: r.mentee?.email || "—",
    sessionType: r.confirmedSlot?.day || "—",
    duration: r.confirmedSlot
        ? (() => {
            const [sh, sm] = (r.confirmedSlot.startTime || "0:0").split(":").map(Number);
            const [eh, em] = (r.confirmedSlot.endTime || "0:0").split(":").map(Number);
            return `${(eh * 60 + em) - (sh * 60 + sm)} mins`;
        })()
        : "—",
    amount: r.totalAmount || 0,
    status: r.paymentStatus || "paid",
});

const toPayoutHistoryDTO = ({ payouts, pagination }) => ({
    payouts: payouts.map(toPayoutRowDTO),
    pagination,
});

module.exports = { toEarningsSummaryDTO, toEarningsChartDTO, toPayoutHistoryDTO };