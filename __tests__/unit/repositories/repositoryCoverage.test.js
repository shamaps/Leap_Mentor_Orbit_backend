const mockQuery = () => {
    const query = {};
    ["select", "sort", "skip", "limit", "lean", "setOptions", "populate", "session"].forEach((method) => {
        query[method] = jest.fn(() => query);
    });
    return query;
};

jest.mock("../../../models/User", () => ({
    aggregate: jest.fn(), countDocuments: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndDelete: jest.fn(), findByIdAndUpdate: jest.fn(), findOneAndUpdate: jest.fn(),
}));
jest.mock("../../../models/AdminUser", () => ({ findOne: jest.fn(), findById: jest.fn() }));
jest.mock("../../../models/MentorProfile", () => ({
    aggregate: jest.fn(), countDocuments: jest.fn(), create: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findOne: jest.fn(), findOneAndDelete: jest.fn(), findOneAndUpdate: jest.fn(),
}));
jest.mock("../../../models/MenteeProfile", () => ({
    create: jest.fn(), find: jest.fn(), findOne: jest.fn(), findOneAndDelete: jest.fn(), findOneAndUpdate: jest.fn(),
}));
jest.mock("../../../models/ConnectRequest", () => ({
    countDocuments: jest.fn(), deleteMany: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndDelete: jest.fn(), findByIdAndUpdate: jest.fn(), findOneAndUpdate: jest.fn(), updateMany: jest.fn(),
}));
jest.mock("../../../models/Wallet", () => ({ aggregate: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../../../models/Report", () => ({ countDocuments: jest.fn(), find: jest.fn(), findById: jest.fn() }));
jest.mock("../../../models/Transaction", () => ({ countDocuments: jest.fn(), create: jest.fn(), find: jest.fn() }));
jest.mock("../../../models/Goal", () => ({ create: jest.fn(), findById: jest.fn(), findOne: jest.fn() }));
jest.mock("../../../models/Milestone", () => ({
    create: jest.fn(), find: jest.fn(), findById: jest.fn(), findByIdAndDelete: jest.fn(), findOne: jest.fn(),
}));
jest.mock("../../../models/Feedback", () => ({ aggregate: jest.fn(), create: jest.fn(), find: jest.fn(), findById: jest.fn(), findOne: jest.fn() }));
jest.mock("../../../models/Note", () => ({ create: jest.fn(), find: jest.fn(), findById: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock("../../../models/PrivateNote", () => ({ create: jest.fn(), find: jest.fn(), findById: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock("../../../models/Availability", () => ({ findOne: jest.fn() }));
jest.mock("../../../utils/withTransaction", () => ({ withTransaction: jest.fn(async (callback) => callback({ id: "mongo-session" })) }));
jest.mock("../../../utils/logger", () => ({ debug: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/escapeRegex", () => ({ escapeRegex: (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }));
jest.mock("../../../repositories/userSearch.repository", () => ({ findUsersByName: jest.fn() }));

const User = require("../../../models/User");
const AdminUser = require("../../../models/AdminUser");
const MentorProfile = require("../../../models/MentorProfile");
const MenteeProfile = require("../../../models/MenteeProfile");
const ConnectRequest = require("../../../models/ConnectRequest");
const Wallet = require("../../../models/Wallet");
const Report = require("../../../models/Report");
const Transaction = require("../../../models/Transaction");
const Goal = require("../../../models/Goal");
const Milestone = require("../../../models/Milestone");
const Feedback = require("../../../models/Feedback");
const Note = require("../../../models/Note");
const PrivateNote = require("../../../models/PrivateNote");
const Availability = require("../../../models/Availability");
const { findUsersByName } = require("../../../repositories/userSearch.repository");
const { withTransaction } = require("../../../utils/withTransaction");
const admin = require("../../../repositories/admin.repository");
const reports = require("../../../repositories/adminReports.repository");
const goals = require("../../../repositories/goal.repository");
const feedback = require("../../../repositories/feedback.repository");
const notes = require("../../../repositories/note.repository");
const verification = require("../../../repositories/adminVerification.repository");
const menteeProfiles = require("../../../repositories/menteeProfile.repository");
const mentorProfiles = require("../../../repositories/mentorProfile.repository");
const payments = require("../../../repositories/adminPayments.repository");
const mentorSearch = require("../../../repositories/mentorSearch.repository");
const sessions = require("../../../repositories/session.repository");
const privateNotes = require("../../../repositories/privateNote.repository");

const id = (value) => ({ toHexString: () => value });
const resolved = (mock, value = []) => mock.mockResolvedValue(value);

beforeEach(() => {
    jest.clearAllMocks();
    [AdminUser.findOne, AdminUser.findById, User.aggregate, User.countDocuments, User.find,
        User.findById, User.findByIdAndDelete, User.findByIdAndUpdate, User.findOneAndUpdate,
        MentorProfile.aggregate, MentorProfile.countDocuments, MentorProfile.find, MentorProfile.findById,
        MentorProfile.findOne, MentorProfile.findOneAndDelete, MentorProfile.findOneAndUpdate,
        MenteeProfile.find, MenteeProfile.findOne, MenteeProfile.findOneAndDelete, MenteeProfile.findOneAndUpdate,
        ConnectRequest.countDocuments, ConnectRequest.deleteMany, ConnectRequest.find, ConnectRequest.findById,
        ConnectRequest.findByIdAndDelete, ConnectRequest.findByIdAndUpdate, ConnectRequest.findOneAndUpdate,
        ConnectRequest.updateMany, Wallet.aggregate, Wallet.findOne, Wallet.findOneAndUpdate,
        Report.countDocuments, Report.find, Report.findById, Transaction.countDocuments, Transaction.create,
        Transaction.find, Goal.create, Goal.findById, Goal.findOne, Milestone.create, Milestone.find,
        Milestone.findById, Milestone.findByIdAndDelete, Milestone.findOne, Feedback.aggregate,
        Feedback.create, Feedback.find, Feedback.findById, Feedback.findOne, Note.create, Note.find,
        Note.findById, Note.findByIdAndDelete, PrivateNote.create, PrivateNote.find, PrivateNote.findById,
        PrivateNote.findByIdAndDelete, Availability.findOne].forEach((mock) => mock.mockReturnValue(mockQuery()));
    resolved(findUsersByName, []);
    resolved(User.aggregate);
    resolved(MentorProfile.aggregate);
    resolved(Wallet.aggregate);
    resolved(Feedback.aggregate);
    [User.countDocuments, MentorProfile.countDocuments, ConnectRequest.countDocuments, Report.countDocuments,
        Transaction.countDocuments].forEach((mock) => resolved(mock, 0));
    [ConnectRequest.deleteMany, User.findByIdAndDelete, MentorProfile.findOneAndDelete,
        MenteeProfile.findOneAndDelete, ConnectRequest.updateMany, User.findByIdAndUpdate,
        MentorProfile.findOneAndUpdate, MenteeProfile.findOneAndUpdate, Wallet.findOneAndUpdate].forEach((mock) => resolved(mock, {}));
});

describe("repository query coverage", () => {
    test("admin repository delegates every query with its filters and transaction context", async () => {
        const userId = id("u1");
        const since = new Date("2026-01-01");
        const document = { save: jest.fn().mockResolvedValue("saved") };
        AdminUser.findOne.mockReturnValue("admin-query");
        User.countDocuments.mockReturnValue(mockQuery());

        expect(admin.findAdminByEmail("a@example.com")).toBe("admin-query");
        expect(await admin.saveAdmin(document)).toBe("saved");
        admin.countAllUsers({ roles: ["mentor"] });
        expect(User.countDocuments).toHaveBeenCalledWith({ roles: ["mentor"] });
        expect(User.countDocuments.mock.results[0].value.setOptions).toHaveBeenCalledWith({ ignoreIsDeleted: true });
        admin.countAllUsers();
        expect(User.countDocuments).toHaveBeenLastCalledWith({});
        admin.aggregateUserGrowth(since);
        expect(User.aggregate).toHaveBeenCalledWith(expect.arrayContaining([{ $match: { createdAt: { $gte: since } } }]));
        admin.aggregateMentorIndustries();
        expect(MentorProfile.aggregate).toHaveBeenCalledWith(expect.arrayContaining([{ $limit: 12 }]));

        findUsersByName.mockResolvedValueOnce([{ _id: id("u1") }, { _id: id("u2") }]);
        expect(await admin.findUserIdsByName("Ann")).toEqual(["u1", "u2"]);
        expect(findUsersByName).toHaveBeenCalledWith("Ann", { includeDeleted: true });
        admin.countUsers({ status: "active" });
        expect(User.countDocuments).toHaveBeenLastCalledWith({ status: "active" }, { ignoreIsDeleted: true });
        admin.findUsers({ roles: ["mentor"] }, 5, 10);
        expect(User.find.mock.results.at(-1).value.select).toHaveBeenCalledWith("-password");
        admin.findMentorProfilesByUserIds([userId]);
        expect(MentorProfile.find).toHaveBeenCalledWith({ user: { $in: [userId] } });
        admin.findMenteeProfilesByUserIds([userId]);
        expect(MenteeProfile.find).toHaveBeenCalledWith({ user: { $in: [userId] } });
        admin.findUserById(userId);
        expect(User.findById.mock.results.at(-1).value.setOptions).toHaveBeenCalledWith({ ignoreIsDeleted: true });
        admin.findMentorProfileByUser(userId);
        admin.findMenteeProfileByUser(userId);
        admin.countCompletedSessions(userId);
        expect(ConnectRequest.countDocuments).toHaveBeenCalledWith({ $or: [{ mentor: userId }, { mentee: userId }], status: "completed" });
        await admin.hardDeleteUser(userId);
        expect(ConnectRequest.deleteMany).toHaveBeenCalledWith({ $or: [{ mentor: userId }, { mentee: userId }] });
        admin.findUserByIdRaw(userId);
        admin.blockUserById(userId);
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, expect.objectContaining({ isDeleted: true }), { new: true });
        admin.unblockUserById(userId);
        expect(User.findOneAndUpdate).toHaveBeenCalledWith({ _id: userId }, { isDeleted: false, deletedAt: null }, { new: true, ignoreIsDeleted: true });
        await admin.cascadeDeleteUser(userId);
        expect(withTransaction).toHaveBeenCalledWith(expect.any(Function), "admin.deleteUser");
        expect(ConnectRequest.updateMany).toHaveBeenCalledWith(
            { $or: [{ mentor: userId }, { mentee: userId }], status: "pending" },
            expect.objectContaining({ $set: expect.objectContaining({ status: "cancelled" }) }),
            { session: { id: "mongo-session" } },
        );
        admin.countEngagementsByStatus("pending");
        admin.countEngagements({ mentor: userId });
        admin.findEngagements({ status: "pending" }, 2, 4);
        expect(ConnectRequest.find.mock.results.at(-1).value.populate).toHaveBeenCalledWith("mentor", "name email");
        findUsersByName.mockResolvedValueOnce([{ _id: "same" }]);
        User.find.mockReturnValueOnce(Object.assign(mockQuery(), { lean: jest.fn().mockResolvedValue([{ _id: "same" }, { _id: "email" }]) }));
        expect(await admin.findUserIdsBySearchTerm("ann+")).toEqual(["same", "email"]);
        expect(User.find).toHaveBeenLastCalledWith({ email: { $regex: "ann\\+", $options: "i" } }, null, { ignoreIsDeleted: true });
    });

    test("admin reports and payments cover counts, search, populated lists, writes, and date filters", async () => {
        const start = new Date("2026-02-01"); const end = new Date("2026-03-01");
        reports.countAllReports(); reports.countPendingReports(); reports.countResolvedToday(start);
        expect(Report.countDocuments).toHaveBeenCalledWith({ status: { $in: ["open", "under_review"] } });
        findUsersByName.mockResolvedValueOnce([{ _id: "r1" }]);
        expect(await reports.findUserIdsByName("R")).toEqual(["r1"]);
        reports.countReports({ status: "resolved" }); reports.findReports({}, 1, 5);
        expect(Report.find.mock.results[0].value.sort).toHaveBeenCalledWith({ createdAt: -1 });
        reports.findMyProfileSkills("m1");
        reports.findReportById("r1"); reports.findReportByIdWithSession("r1"); reports.findReportByIdWithSessionAndParticipants("r1");
        expect(Report.findById.mock.results[2].value.populate).toHaveBeenCalledWith(expect.objectContaining({ path: "connectRequest" }));
        const saved = { save: jest.fn().mockResolvedValue("saved") };
        expect(await reports.saveReport(saved)).toBe("saved");
        reports.findMenteeWallet("m1"); expect(Wallet.findOne).toHaveBeenCalledWith({ user: "m1" });
        expect(await reports.saveWallet(saved)).toBe("saved");
        Transaction.create.mockResolvedValue("created"); expect(await reports.createRefundTransaction({ amount: 1 })).toBe("created");
        expect(await reports.saveConnectRequest(saved)).toBe("saved");
        reports.deleteConnectRequestById("c1");

        payments.findAdminCommissionRate("a1"); payments.findCompletedPaidSessions(); payments.sumAllWalletEscrows(); payments.countRefundedRequests();
        payments.findCompletedSessionsInRange(start, end); payments.findCompletedSessionsSince(start);
        expect(ConnectRequest.find).toHaveBeenNthCalledWith(2, { status: "completed", completedAt: { $gte: start, $lt: end } });
        findUsersByName.mockResolvedValueOnce([{ _id: "u1" }]);
        expect(await payments.findUserIdsByName("U")).toEqual(["u1"]);
        payments.countTransactions({ type: "refund" }); payments.findTransactions({}, 3, 9);
        expect(Transaction.find.mock.results[0].value.populate).toHaveBeenCalledWith("user", "name email");
    });

    test("goal, feedback, note, and private note expose their CRUD and lookup query shapes", async () => {
        goals.findSessionById("c1"); goals.findGoalBySession("c1"); goals.findGoalById("g1"); goals.findGoalByIdLean("g1");
        Goal.create.mockResolvedValue("goal"); expect(await goals.createGoal({ title: "Goal" })).toBe("goal");
        goals.findMilestonesByGoal("g1"); goals.findLastMilestone("g1"); goals.findMilestoneById("m1");
        Milestone.create.mockResolvedValue("milestone"); expect(await goals.createMilestone({ title: "Step" })).toBe("milestone");
        goals.deleteMilestoneById("m1");

        feedback.findSessionById("c1"); feedback.findSessionForRead("c1"); feedback.findExistingFeedback({ from: "u1" });
        Feedback.create.mockResolvedValue("feedback"); expect(await feedback.createFeedback({ rating: 5 })).toBe("feedback");
        feedback.findFeedbackById("f1"); feedback.findFeedbackBySession("c1"); feedback.findAllFeedbackForMentor("m1");
        feedback.computeMentorAvgRating("m1"); feedback.updateMentorAvgRating("m1", 4.5);
        expect(Feedback.findById.mock.results[0].value.populate).toHaveBeenCalledWith("from", "name email");

        notes.findSessionParticipants("c1"); Note.create.mockResolvedValue("note");
        expect(await notes.createNote({ title: "Note" })).toBe("note");
        notes.findNoteByIdPopulated("n1"); notes.findSharedNotes("c1"); notes.findPrivateNotes("c1", "u1");
        notes.findNoteById("n1"); notes.deleteNoteById("n1");
        expect(Note.find).toHaveBeenNthCalledWith(2, { connectRequest: "c1", uploadedBy: "u1", isPrivate: true });

        privateNotes.findSessionParticipants("c1"); PrivateNote.create.mockResolvedValue("private");
        expect(await privateNotes.createNote({ title: "Private" })).toBe("private");
        privateNotes.findNotesByUser("c1", "u1"); privateNotes.findNoteById("p1"); privateNotes.deleteNoteById("p1");
        expect(PrivateNote.find).toHaveBeenCalledWith({ connectRequest: "c1", author: "u1" });
    });

    test("verification and profile repositories cover search defaults, populated reads, create and updates", async () => {
        findUsersByName.mockResolvedValueOnce([{ _id: "mentor-id" }]);
        expect(await verification.findMentorUserIdsByName("M")).toEqual(["mentor-id"]);
        expect(findUsersByName).toHaveBeenCalledWith("M", { roles: ["mentor"], includeDeleted: true });
        verification.findAllMentorProfiles(); verification.findAllMentorProfiles({ verificationStatus: "pending" }, 4, 6);
        expect(MentorProfile.find.mock.results.at(-1).value.skip).toHaveBeenCalledWith(4);
        verification.countMentorProfiles(); verification.findMentorProfileById("p1"); verification.findMentorProfileDocumentById("p1");

        menteeProfiles.findProfileByUser("u1"); menteeProfiles.findProfileByUserPopulated("u1");
        MenteeProfile.create.mockResolvedValue("mentee-profile"); expect(await menteeProfiles.createProfile({ user: "u1" })).toBe("mentee-profile");
        menteeProfiles.updateProfileByUser("u1", { bio: "updated" }); menteeProfiles.findPublicProfileByUser("u1");
        expect(MenteeProfile.findOneAndUpdate).toHaveBeenCalledWith({ user: "u1" }, { $set: { bio: "updated" } }, { new: true, runValidators: true });

        mentorProfiles.findProfileByUser("u2"); mentorProfiles.findProfileByUserPopulated("u2");
        MentorProfile.create.mockResolvedValue("mentor-profile"); expect(await mentorProfiles.createProfile({ user: "u2" })).toBe("mentor-profile");
        mentorProfiles.updateProfileByUser("u2", { bio: "updated" }); mentorProfiles.findPublicProfileByUser("u2");
        expect(MentorProfile.findOneAndUpdate).toHaveBeenCalledWith({ user: "u2" }, { $set: { bio: "updated" } }, { new: true, runValidators: true });
    });

    test("mentor search covers Atlas success, fallback, and profile filters", async () => {
        User.aggregate.mockResolvedValueOnce([{ _id: "atlas" }]);
        expect(await mentorSearch.findMentorUsersByName("Ann")).toEqual([{ _id: "atlas" }]);
        User.aggregate.mockRejectedValueOnce(new Error("no Atlas index"));
        const fallbackQuery = mockQuery(); fallbackQuery.lean.mockResolvedValue([{ _id: "regex" }]);
        User.find.mockReturnValueOnce(fallbackQuery);
        expect(await mentorSearch.findMentorUsersByName("A.+")).toEqual([{ _id: "regex" }]);
        expect(User.find).toHaveBeenCalledWith({ name: { $regex: "A\\.\\+", $options: "i" }, roles: { $in: ["mentor"] } });
        mentorSearch.countPublishedMentors(); mentorSearch.findPublishedMentors(2, 5);
        const pipeline = [{ $match: { industry: "tech" } }]; mentorSearch.runAtlasPipeline(pipeline);
        expect(MentorProfile.aggregate).toHaveBeenCalledWith(pipeline);
        mentorSearch.findProfilesByUserIds(["u1"], { yearsOfExperience: { $gte: 5 } });
        expect(MentorProfile.find).toHaveBeenLastCalledWith({ user: { $in: ["u1"] }, isProfilePublished: true, isProfileComplete: true, yearsOfExperience: { $gte: 5 } });
        mentorSearch.countByFilter({ industry: "tech" }); mentorSearch.findByFilter({ industry: "tech" }, 0, 4);
    });

    test("session repository covers lean, document, transaction, populated, and availability reads", () => {
        const mongoSession = { id: "session" };
        sessions.findSessionForRead("c1"); sessions.findSessionDocument("c1");
        sessions.findSessionDocumentWithSession("c1", mongoSession);
        expect(ConnectRequest.findById.mock.results[1].value.session).toHaveBeenCalledWith(mongoSession);
        sessions.findSessionPopulated("c1"); sessions.findMentorAvailability("mentor");
        expect(Availability.findOne).toHaveBeenCalledWith({ mentor: "mentor" });
    });

    test("hard delete logs individual settled failures and still completes", async () => {
        User.findByIdAndDelete.mockRejectedValueOnce(new Error("user delete failed"));
        await expect(admin.hardDeleteUser(id("u-fail"))).resolves.toBeUndefined();
        expect(require("../../../utils/logger").error).toHaveBeenCalledWith("hardDeleteUser partial failure", expect.objectContaining({ error: "user delete failed" }));
    });
});
