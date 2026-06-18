// services/adminSettings.service.js
const createAdminSettingsService = (adminSettingsRepo, { logger }) => {

// GET /api/admin/settings/overview


const getOverview = async () => {
    const [totalUsers, activeSessions] = await Promise.all([
        adminSettingsRepo.countTotalUsers(),
        adminSettingsRepo.countActiveSessions(),
    ]);
    return { totalUsers, activeSessions };
};


// PUT /api/admin/settings/change-password


const changePassword = async (adminId, currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
        const err = new Error("All fields are required");
        err.statusCode = 400;
        throw err;
    }
    if (newPassword.length < 6) {
        const err = new Error("New password must be at least 6 characters.");
        err.statusCode = 400;
        throw err;
    }
    if (currentPassword === newPassword) {
        const err = new Error("New password must be different.");
        err.statusCode = 400;
        throw err;
    }

    const admin = await adminSettingsRepo.findAdminDocumentById(adminId);
    if (!admin) {
        const err = new Error("Admin not found.");
        err.statusCode = 404;
        throw err;
    }

    // comparePassword method is on AdminUser model
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
        const err = new Error("Current password is incorrect.");
        err.statusCode = 400;
        throw err;
    }

    // pre-save hook on AdminUser hashes the password automatically
    admin.password = newPassword;
    await admin.save();

    return { message: "Password changed successfully." };
};


// POST /api/admin/settings/add-admin


const addAdmin = async (name, email) => {
    if (!name?.trim() || !email?.trim()) {
        const err = new Error("Name and email are required.");
        err.statusCode = 400;
        throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await adminSettingsRepo.findAdminByEmail(normalizedEmail);
    if (existing) {
        const err = new Error("An admin with this email already exists.");
        err.statusCode = 409;
        throw err;
    }

    // pre-save hook on AdminUser will hash this automatically
    const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 12) + "A1!";

    const newAdmin = await adminSettingsRepo.createAdmin({
        name: name.trim(),
        email: normalizedEmail,
        password: tempPassword,
        isSuperAdmin: false,
        isActive: true,
    });

    return {
        message: `Admin account created for ${email}.`,
        tempPassword,
        admin: {
            _id: newAdmin._id,
            name: newAdmin.name,
            email: newAdmin.email,
        },
    };
};


// GET /api/admin/settings/commission


const getCommission = async (adminId) => {
    // commissionRate lives directly on AdminUser model
    const admin = await adminSettingsRepo.findAdminCommissionById(adminId);
    return { commissionRate: admin?.commissionRate ?? 20 };
};


// PUT /api/admin/settings/commission


const updateCommission = async (adminId, commissionRate) => {
    const rate = Number.parseFloat(commissionRate);

    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
        const err = new Error("Commission rate must be between 0 and 100.");
        err.statusCode = 400;
        throw err;
    }

    await adminSettingsRepo.updateCommissionRate(adminId, rate);

    return {
        message: `Commission rate updated to ${rate}%`,
        commissionRate: rate,
    };
};

    return { getOverview, changePassword, addAdmin, getCommission, updateCommission };
};
module.exports = createAdminSettingsService;