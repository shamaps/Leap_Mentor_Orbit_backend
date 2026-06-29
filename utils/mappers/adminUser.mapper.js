// adminUser.mapper.js  
const toAdminDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    isSuperAdmin: doc.isSuperAdmin,
    isActive: doc.isActive,
    lastLoginAt: doc.lastLoginAt,
    commissionRate: doc.commissionRate,
    walletBalance: doc.walletBalance,
});
// Stripped: password (already handled by toJSON), __v
module.exports = { toAdminDTO };