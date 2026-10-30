const ids = require("../../utils/cloudinaryPublicId");

describe("cloudinaryPublicId", () => {
    beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000));

    test("profilePictureId is one stable slot per user (no timestamp)", () => {
        expect(ids.profilePictureId("u1")).toBe("leapmentor/profiles/user-u1");
    });

    test("resumeId strips the extension and appends a timestamp", () => {
        expect(ids.resumeId("u1", "cv.pdf")).toBe("leapmentor/verification-docs/resumes/u1/cv_1700000000000");
    });

    test("workExperienceId lives under work-experience/{userId}", () => {
        expect(ids.workExperienceId("u1", "offer.pdf"))
            .toBe("leapmentor/verification-docs/work-experience/u1/offer_1700000000000");
    });

    test("noteId prefixes the filename with the uploader's id", () => {
        expect(ids.noteId("req9", "u1", "Meeting.TXT")).toBe("leapmentor/notes/req9/u1_meeting_1700000000000");
    });

    test("reportScreenshotId has a fixed 'screenshot' name", () => {
        expect(ids.reportScreenshotId("req9", "u1")).toBe("leapmentor/reports/req9/u1_screenshot_1700000000000");
    });

    test("only the final extension is stripped", () => {
        expect(ids.resumeId("u1", "my.cv.v2.pdf")).toBe("leapmentor/verification-docs/resumes/u1/my.cv.v2_1700000000000");
    });

    test("the filename part is lower-cased and capped at 80 characters", () => {
        const id = ids.resumeId("u1", `${"A".repeat(200)}.pdf`);
        const name = id.split("/").pop().replace(/_1700000000000$/, "");
        expect(name).toBe("a".repeat(80));
    });

    // KNOWN BUG (see report): sanitise() calls String#replaceAll with *strings* such as
    // "[^a-z0-9._-]", which replaceAll treats literally, so nothing is ever replaced.
    // The comments say these should be regexes. Remove `.failing` once sanitise() is fixed.
    describe("filename sanitising (intended behaviour)", () => {
        test.failing("unsafe characters and spaces become hyphens", () => {
            expect(ids.resumeId("u1", "My Résumé (final).pdf"))
                .toBe("leapmentor/verification-docs/resumes/u1/my-r-sum-final_1700000000000");
        });

        test.failing("a path-traversal style filename cannot add path segments to the public_id", () => {
            const id = ids.noteId("req9", "u1", "../../etc/passwd.txt");
            expect(id.split("/")).toHaveLength(4); // leapmentor / notes / req9 / <file>
        });
    });
});
