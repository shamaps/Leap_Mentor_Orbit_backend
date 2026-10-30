/**
 * @fileoverview Integration tests for the Catalog user-lifecycle repository
 * (soft-delete / restore / hard-delete of mentor and mentee profiles).
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../src/repositories/userLifecycle.repository");
const MentorProfile = require("@leapmentor/shared/models/MentorProfile");
const MenteeProfile = require("@leapmentor/shared/models/MenteeProfile");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

const newId = () => new mongoose.Types.ObjectId();

// The models hide soft-deleted documents from find(); this bypasses that hook so
// tests can see the real stored state.
const rawMentor = (user) => MentorProfile.findOne({ user }).setOptions({ ignoreIsDeleted: true }).lean();
const rawMentee = (user) => MenteeProfile.findOne({ user }).setOptions({ ignoreIsDeleted: true }).lean();

const seedBoth = async (user, extra = {}) => {
    await MentorProfile.create({ user, ...extra });
    await MenteeProfile.create({ user, ...extra });
};

describe("Catalog User Lifecycle Repository (Integration)", () => {
    describe("softDeleteProfiles", () => {
        it("should flag both profiles as deleted using the supplied timestamp", async () => {
            const user = newId();
            const at = new Date("2026-03-01T10:00:00Z");
            await seedBoth(user);

            const result = await repo.softDeleteProfiles(user, at);

            expect(result).toEqual({ mentorProfiles: 1, menteeProfiles: 1 });
            const [mentor, mentee] = [await rawMentor(user), await rawMentee(user)];
            expect(mentor.isDeleted).toBe(true);
            expect(mentor.deletedAt).toEqual(at);
            expect(mentee.isDeleted).toBe(true);
            expect(mentee.deletedAt).toEqual(at);
        });

        it("should default the timestamp to the current time", async () => {
            const user = newId();
            await MentorProfile.create({ user });
            const before = Date.now();

            await repo.softDeleteProfiles(user);

            const mentor = await rawMentor(user);
            expect(mentor.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
            expect(mentor.deletedAt.getTime()).toBeLessThanOrEqual(Date.now());
        });

        it("should keep the profile data so a restore can bring it back intact", async () => {
            const user = newId();
            await MentorProfile.create({ user, currentRole: "Staff Engineer", hourlyRate: 80, skills: ["node"] });

            await repo.softDeleteProfiles(user);

            const mentor = await rawMentor(user);
            expect(mentor.currentRole).toBe("Staff Engineer");
            expect(mentor.hourlyRate).toBe(80);
            expect(mentor.skills).toEqual(["node"]);
        });

        it("should hide the soft-deleted profiles from normal queries", async () => {
            const user = newId();
            await seedBoth(user);

            await repo.softDeleteProfiles(user);

            expect(await MentorProfile.findOne({ user })).toBeNull();
            expect(await MenteeProfile.findOne({ user })).toBeNull();
        });

        it("should only count the profile types the user actually has", async () => {
            const mentorOnly = newId();
            const menteeOnly = newId();
            await MentorProfile.create({ user: mentorOnly });
            await MenteeProfile.create({ user: menteeOnly });

            expect(await repo.softDeleteProfiles(mentorOnly)).toEqual({ mentorProfiles: 1, menteeProfiles: 0 });
            expect(await repo.softDeleteProfiles(menteeOnly)).toEqual({ mentorProfiles: 0, menteeProfiles: 1 });
        });

        it("should not touch profiles that belong to other users", async () => {
            const target = newId();
            const bystander = newId();
            await seedBoth(target);
            await seedBoth(bystander);

            await repo.softDeleteProfiles(target);

            expect((await rawMentor(bystander)).isDeleted).toBe(false);
            expect((await rawMentee(bystander)).isDeleted).toBe(false);
        });

        it("should be idempotent and keep the original deletedAt on a repeat call", async () => {
            const user = newId();
            const first = new Date("2026-03-01T10:00:00Z");
            await seedBoth(user);

            await repo.softDeleteProfiles(user, first);
            const second = await repo.softDeleteProfiles(user, new Date("2026-04-01T10:00:00Z"));

            expect(second).toEqual({ mentorProfiles: 0, menteeProfiles: 0 });
            expect((await rawMentor(user)).deletedAt).toEqual(first);
            expect((await rawMentee(user)).deletedAt).toEqual(first);
        });

        it("should report zero when the user has no profiles", async () => {
            expect(await repo.softDeleteProfiles(newId())).toEqual({ mentorProfiles: 0, menteeProfiles: 0 });
        });
    });

    describe("restoreProfiles", () => {
        it("should clear the deleted flag and timestamp on both profiles", async () => {
            const user = newId();
            await seedBoth(user, { isDeleted: true, deletedAt: new Date() });

            const result = await repo.restoreProfiles(user);

            expect(result).toEqual({ mentorProfiles: 1, menteeProfiles: 1 });
            const [mentor, mentee] = [await rawMentor(user), await rawMentee(user)];
            expect(mentor.isDeleted).toBe(false);
            expect(mentor.deletedAt).toBeNull();
            expect(mentee.isDeleted).toBe(false);
            expect(mentee.deletedAt).toBeNull();
        });

        it("should make restored profiles visible to normal queries again", async () => {
            const user = newId();
            await MentorProfile.create({ user, isDeleted: true, deletedAt: new Date() });
            expect(await MentorProfile.findOne({ user })).toBeNull();

            await repo.restoreProfiles(user);

            expect(await MentorProfile.findOne({ user })).not.toBeNull();
        });

        it("should not modify profiles that are already active", async () => {
            const user = newId();
            await seedBoth(user);

            const result = await repo.restoreProfiles(user);

            expect(result).toEqual({ mentorProfiles: 0, menteeProfiles: 0 });
        });

        it("should only restore the profiles of the requested user", async () => {
            const target = newId();
            const bystander = newId();
            await seedBoth(target, { isDeleted: true, deletedAt: new Date() });
            await seedBoth(bystander, { isDeleted: true, deletedAt: new Date() });

            await repo.restoreProfiles(target);

            expect((await rawMentor(bystander)).isDeleted).toBe(true);
            expect((await rawMentee(bystander)).isDeleted).toBe(true);
        });

        it("should round-trip with softDeleteProfiles", async () => {
            const user = newId();
            await MentorProfile.create({ user, currentRole: "Architect" });

            await repo.softDeleteProfiles(user);
            await repo.restoreProfiles(user);

            const mentor = await MentorProfile.findOne({ user }).lean();
            expect(mentor.isDeleted).toBe(false);
            expect(mentor.currentRole).toBe("Architect");
        });

        it("should report zero when the user has no profiles", async () => {
            expect(await repo.restoreProfiles(newId())).toEqual({ mentorProfiles: 0, menteeProfiles: 0 });
        });
    });

    describe("deleteProfiles", () => {
        it("should permanently remove both profiles and report the counts", async () => {
            const user = newId();
            await seedBoth(user);

            const result = await repo.deleteProfiles(user);

            expect(result).toEqual({ mentorProfiles: 1, menteeProfiles: 1 });
            expect(await rawMentor(user)).toBeNull();
            expect(await rawMentee(user)).toBeNull();
        });

        it("should also remove profiles that were already soft-deleted", async () => {
            const user = newId();
            await seedBoth(user, { isDeleted: true, deletedAt: new Date() });

            const result = await repo.deleteProfiles(user);

            expect(result).toEqual({ mentorProfiles: 1, menteeProfiles: 1 });
            expect(await rawMentor(user)).toBeNull();
            expect(await rawMentee(user)).toBeNull();
        });

        it("should only count the profile types the user actually has", async () => {
            const user = newId();
            await MenteeProfile.create({ user });

            expect(await repo.deleteProfiles(user)).toEqual({ mentorProfiles: 0, menteeProfiles: 1 });
        });

        it("should not delete profiles that belong to other users", async () => {
            const target = newId();
            const bystander = newId();
            await seedBoth(target);
            await seedBoth(bystander);

            await repo.deleteProfiles(target);

            expect(await rawMentor(bystander)).not.toBeNull();
            expect(await rawMentee(bystander)).not.toBeNull();
        });

        it("should report zero when the user has no profiles", async () => {
            expect(await repo.deleteProfiles(newId())).toEqual({ mentorProfiles: 0, menteeProfiles: 0 });
        });
    });
});
