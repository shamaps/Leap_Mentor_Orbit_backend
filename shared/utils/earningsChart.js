// utils/earningsChart.js

/**
 * Build 6-month buckets and sum completed-session amounts into each.
 * @param {Array} completedSessions - sessions with `completedAt`, `totalAmount`
 * @param {Date} now
 * @returns {{label: string, amount: number}[]}
 */
// utils/earningsChart.js

/**
 * Build 6-month buckets and sum completed-session amounts into each.
 * @param {Array} completedSessions - sessions with `completedAt`, `totalAmount`
 * @param {Date} now
 * @returns {{label: string, amount: number}[]}
 */
const buildMonthlyBuckets = (completedSessions, now) => {
    const monthlyTotals = completedSessions.reduce((map, r) => {
        const c = new Date(r.completedAt);
        const key = `${c.getFullYear()}-${c.getMonth()}`;
        return map.set(key, (map.get(key) || 0) + (r.totalAmount || 0));
    }, new Map());

    const data = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const label = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        return { label, amount: monthlyTotals.get(key) || 0 };
    });
    return data;
};
/**
 * Build 8 weekly buckets (last 56 days) and sum completed-session amounts into each.
 * @param {Array} completedSessions - sessions with `completedAt`, `totalAmount`
 * @param {Date} now
 * @returns {{label: string, amount: number}[]}
 */
const buildWeeklyBuckets = (completedSessions, now) => {
    const weekBoundaries = Array.from({ length: 8 }, (_, i) => {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (7 - i) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return { label: `W${i + 1}`, weekStart, weekEnd, amount: 0 };
    });

    for (const r of completedSessions) {
        const c = new Date(r.completedAt);
        const bucket = weekBoundaries.find((b) => c >= b.weekStart && c < b.weekEnd);
        if (bucket) bucket.amount += r.totalAmount || 0;
    }

    return weekBoundaries.map(({ label, amount }) => ({ label, amount }));
};

module.exports = { buildMonthlyBuckets, buildWeeklyBuckets };
