// What frontend reads: name, email, roles, isEmailVerified, _id
// What must be stripped: password, passwordChangedAt, __v, isDeleted, deletedAt

const toUserDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    roles: doc.roles,
    isEmailVerified: doc.isEmailVerified,
    termsAccepted: doc.termsAccepted,
    createdAt: doc.createdAt,
});

module.exports = { toUserDTO };