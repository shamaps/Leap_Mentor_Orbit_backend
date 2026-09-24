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
module.exports = { toAdminDTO };