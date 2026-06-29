// utils/emails/index.js
// OCP-compliant barrel — to add a new email file, just add one spread line here.
// No need to manually list individual function names.
module.exports = {
    ...require("./connectRequestEmails"),
    ...require("./paymentEmails"),
    ...require("./sessionEmails"),
    ...require("./adminEmails"),
};