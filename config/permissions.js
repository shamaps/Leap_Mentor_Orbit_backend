// config/permissions.js
//
// To add a new role:
//   1. Add it to ROLE_PERMISSIONS below with its permission set
//   2. Add the matching role value to the `enum` in models/User.js
//   3. Keep frontend route permission strings in sync.
// Nothing else needs to change 

const PERMISSIONS = {
    // Dashboard identity (mirrors frontend exactly)
    VIEW_MENTOR_DASHBOARD: "view:mentor-dashboard",
    VIEW_MENTEE_DASHBOARD: "view:mentee-dashboard",

    // Mentor-exclusive actions
    MANAGE_OWN_SLOTS: "manage:own-slots",
    UPLOAD_VERIFICATION_DOCS: "upload:verification-docs",
    VIEW_EARNINGS: "view:earnings",
    MANAGE_MENTOR_PROFILE: "manage:mentor-profile",
    MANAGE_MENTOR_REFERRALS: "manage:mentor-referrals",
    SEND_CONNECT_REQUEST: "send:connect-request",
    CANCEL_CONNECT_REQUEST: "cancel:connect-request",
    VIEW_INCOMING_REQUESTS: "view:incoming-requests",
    RESPOND_CONNECT_REQUEST: "respond:connect-request",
    WITHDRAW_EARNINGS: "withdraw:earnings",

    // Mentee-exclusive actions
    BOOK_SESSION: "book:session",
    MANAGE_MENTEE_PROFILE: "manage:mentee-profile",
    MANAGE_LEAP_REQUEST: "manage:leap-request",
    VIEW_INVOICE: "view:invoice",

    // Shared (mentor + mentee) actions
    MANAGE_SESSION: "manage:session",
    MANAGE_GOALS: "manage:goals",
    MANAGE_ESCROW: "manage:escrow",
    SUBMIT_FEEDBACK: "submit:feedback",
    MANAGE_REPORTS: "manage:reports",
};

const ROLE_PERMISSIONS = {
    mentor: [
        PERMISSIONS.VIEW_MENTOR_DASHBOARD,
        PERMISSIONS.MANAGE_OWN_SLOTS,
        PERMISSIONS.UPLOAD_VERIFICATION_DOCS,
        PERMISSIONS.VIEW_EARNINGS,
        PERMISSIONS.MANAGE_MENTOR_PROFILE,
        PERMISSIONS.MANAGE_MENTOR_REFERRALS,
        PERMISSIONS.VIEW_INCOMING_REQUESTS,
        PERMISSIONS.RESPOND_CONNECT_REQUEST,
        PERMISSIONS.WITHDRAW_EARNINGS,
        PERMISSIONS.MANAGE_SESSION,
        PERMISSIONS.MANAGE_GOALS,
        PERMISSIONS.MANAGE_ESCROW,
        PERMISSIONS.SUBMIT_FEEDBACK,
        PERMISSIONS.MANAGE_REPORTS,
    ],
    mentee: [
        PERMISSIONS.VIEW_MENTEE_DASHBOARD,
        PERMISSIONS.BOOK_SESSION,
        PERMISSIONS.SEND_CONNECT_REQUEST,
        PERMISSIONS.CANCEL_CONNECT_REQUEST,
        PERMISSIONS.VIEW_INVOICE,
        PERMISSIONS.MANAGE_MENTEE_PROFILE,
        PERMISSIONS.MANAGE_LEAP_REQUEST,
        PERMISSIONS.MANAGE_SESSION,
        PERMISSIONS.MANAGE_GOALS,
        PERMISSIONS.MANAGE_ESCROW,
        PERMISSIONS.SUBMIT_FEEDBACK,
        PERMISSIONS.MANAGE_REPORTS,
    ],
 
};
const getPermissionsForRoles = (roles = []) =>
    [...new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r] || []))];

const hasPermission = (roles, permission) =>
    getPermissionsForRoles(roles || []).includes(permission);

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForRoles, hasPermission };