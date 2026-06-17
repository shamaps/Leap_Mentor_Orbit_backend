// utils/withTimeout.js  
const withTimeout = (promise, ms, label) => {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new AppError(504, `${label} timed out`)), ms)
    );
    return Promise.race([promise, timeout]);
};

module.exports = { withTimeout };