// services/payments-service/src/config/container.js
// Dependency wiring for the payments service only (subset of the monolith's config/container.js).
const logger = require("@leapmentor/shared/utils/logger");

// ── Repositories (service-owned)
const adminPaymentsRepo = require("../repositories/adminPayments.repository");
const earningsRepo = require("../repositories/earnings.repository");
const invoiceRepo = require("../repositories/invoice.repository");
// ── Repository shared with engagement (phase 1, see ARCHITECTURE.md 4a)
const escrowRepo = require("@leapmentor/shared/repositories/escrow.repository");

// ── Service factories
const createAdminPaymentsService = require("../services/adminPayments.service");
const createEarningsService = require("../services/earnings.service");
const createEscrowService = require("../services/escrow.service");
const createInvoiceService = require("../services/invoice.service");
const createWalletWithdrawalService = require("../services/walletWithdrawal.service");
const { createInternalEscrowService } = require("../services/internalEscrow.service");
const internalEscrowRepo = require("../repositories/internalEscrow.repository");
const createWalletOperationsService = require("../services/walletOperations.service");

// ── Controller factories
const createAdminPaymentsController = require("../controllers/admin/adminPayments.controller");
const createEarningsController = require("../controllers/earnings.controller");
const createEscrowController = require("../controllers/escrow.controller");
const createInvoiceController = require("../controllers/invoice.controller");

// ── Wire services
const adminPaymentsService = createAdminPaymentsService(adminPaymentsRepo, { logger });
const earningsService = createEarningsService(earningsRepo, { logger });
const internalEscrowService = createInternalEscrowService(internalEscrowRepo, { logger });
const walletOperationsService = createWalletOperationsService(internalEscrowRepo);
const escrowService = createEscrowService(escrowRepo, { logger, internalEscrowService });
const invoiceService = createInvoiceService(invoiceRepo, { logger });
const walletWithdrawalService = createWalletWithdrawalService(earningsRepo, { logger });

// ── Wire controllers
module.exports = {
    adminPaymentsController: createAdminPaymentsController(adminPaymentsService, { logger }),
    earningsController: createEarningsController(earningsService, walletWithdrawalService, { logger }),
    escrowController: createEscrowController(escrowService, { logger }),
    internalEscrowService,
    walletOperationsService,
    invoiceController: createInvoiceController(invoiceService, { logger }),
};
