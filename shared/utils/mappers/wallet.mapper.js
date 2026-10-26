// utils/mappers/wallet.mapper.js
const toWithdrawalDTO = (data) => ({
    message: data.message,
    withdrawn: data.withdrawn,
    newBalance: data.newBalance,
});

module.exports = { toWithdrawalDTO };