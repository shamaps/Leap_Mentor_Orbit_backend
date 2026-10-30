const { PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForRoles, hasPermission } = require("../../config/permissions");

describe("ROLE_PERMISSIONS invariants", () => {
    test("every permission granted to a role is a defined PERMISSIONS value", () => {
        const known = new Set(Object.values(PERMISSIONS));
        for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
            for (const p of perms) expect({ role, p, known: known.has(p) }).toEqual({ role, p, known: true });
        }
    });

    test("no role lists the same permission twice", () => {
        for (const perms of Object.values(ROLE_PERMISSIONS)) expect(new Set(perms).size).toBe(perms.length);
    });

    test("PERMISSIONS values are unique 'verb:noun' strings", () => {
        const values = Object.values(PERMISSIONS);
        expect(new Set(values).size).toBe(values.length);
        for (const v of values) expect(v).toMatch(/^[a-z]+:[a-z-]+$/);
    });

    test("every defined permission is granted to at least one role", () => {
        const granted = new Set(Object.values(ROLE_PERMISSIONS).flat());
        const orphaned = Object.values(PERMISSIONS).filter((p) => !granted.has(p));
        expect(orphaned).toEqual([]);
    });
});

describe("role separation", () => {
    const mentorOnly = [
        PERMISSIONS.MANAGE_OWN_SLOTS, PERMISSIONS.UPLOAD_VERIFICATION_DOCS, PERMISSIONS.VIEW_EARNINGS,
        PERMISSIONS.MANAGE_MENTOR_PROFILE, PERMISSIONS.MANAGE_MENTOR_REFERRALS, PERMISSIONS.VIEW_INCOMING_REQUESTS,
        PERMISSIONS.RESPOND_CONNECT_REQUEST, PERMISSIONS.WITHDRAW_EARNINGS, PERMISSIONS.VIEW_MENTOR_DASHBOARD,
    ];
    const menteeOnly = [
        PERMISSIONS.BOOK_SESSION, PERMISSIONS.SEND_CONNECT_REQUEST, PERMISSIONS.CANCEL_CONNECT_REQUEST,
        PERMISSIONS.VIEW_INVOICE, PERMISSIONS.MANAGE_MENTEE_PROFILE, PERMISSIONS.MANAGE_LEAP_REQUEST,
        PERMISSIONS.VIEW_MENTEE_DASHBOARD,
    ];
    const shared = [
        PERMISSIONS.MANAGE_SESSION, PERMISSIONS.MANAGE_GOALS, PERMISSIONS.MANAGE_ESCROW,
        PERMISSIONS.SUBMIT_FEEDBACK, PERMISSIONS.MANAGE_REPORTS,
    ];

    test.each(mentorOnly)("%s is mentor-only", (p) => {
        expect(hasPermission(["mentor"], p)).toBe(true);
        expect(hasPermission(["mentee"], p)).toBe(false);
    });

    test.each(menteeOnly)("%s is mentee-only", (p) => {
        expect(hasPermission(["mentee"], p)).toBe(true);
        expect(hasPermission(["mentor"], p)).toBe(false);
    });

    test.each(shared)("%s is available to both roles", (p) => {
        expect(hasPermission(["mentor"], p)).toBe(true);
        expect(hasPermission(["mentee"], p)).toBe(true);
    });

    test("money-moving actions stay on the right side: only mentors withdraw, only mentees book", () => {
        expect(hasPermission(["mentee"], PERMISSIONS.WITHDRAW_EARNINGS)).toBe(false);
        expect(hasPermission(["mentor"], PERMISSIONS.BOOK_SESSION)).toBe(false);
    });
});

describe("getPermissionsForRoles", () => {
    test("returns the role's permissions", () => {
        expect(getPermissionsForRoles(["mentor"]).sort()).toEqual([...ROLE_PERMISSIONS.mentor].sort());
    });

    test("de-duplicates when a user holds several roles", () => {
        const both = getPermissionsForRoles(["mentor", "mentee"]);
        expect(new Set(both).size).toBe(both.length);
        expect(both).toEqual(expect.arrayContaining([...ROLE_PERMISSIONS.mentor, ...ROLE_PERMISSIONS.mentee]));
    });

    test("ignores unknown roles (including Object.prototype names)", () => {
        expect(getPermissionsForRoles(["wizard"])).toEqual([]);
        expect(getPermissionsForRoles(["wizard", "mentee"]).sort()).toEqual([...ROLE_PERMISSIONS.mentee].sort());
    });

    test("role names that collide with Object.prototype members never grant a permission", () => {
        for (const role of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
            expect(hasPermission([role], PERMISSIONS.VIEW_EARNINGS)).toBe(false);
        }
    });

    // MINOR QUIRK (see report): ROLE_PERMISSIONS[role] is looked up without an own-property check,
    // so "constructor" resolves to Object and leaks a function into the result. It is harmless today
    // (hasPermission compares strings and roles come from a Mongoose enum) but the list should be [].
    // Remove `.failing` once getPermissionsForRoles uses Object.hasOwn / a null-prototype map.
    test.failing("getPermissionsForRoles returns [] for prototype-named roles", () => {
        expect(getPermissionsForRoles(["constructor"])).toEqual([]);
        expect(getPermissionsForRoles(["__proto__"])).toEqual([]);
    });

    test.each([[undefined], [[]]])("no roles (%p) -> no permissions", (roles) => {
        expect(getPermissionsForRoles(roles)).toEqual([]);
    });
});

describe("hasPermission", () => {
    test.each([[null], [undefined], [[]]])("false for missing roles (%p)", (roles) => {
        expect(hasPermission(roles, PERMISSIONS.BOOK_SESSION)).toBe(false);
    });

    test("false for an unknown permission string", () => {
        expect(hasPermission(["mentor"], "do:anything")).toBe(false);
    });

    test("role names are case-sensitive", () => {
        expect(hasPermission(["Mentor"], PERMISSIONS.VIEW_EARNINGS)).toBe(false);
    });

    test("true when any one of several roles grants it", () => {
        expect(hasPermission(["mentee", "mentor"], PERMISSIONS.VIEW_EARNINGS)).toBe(true);
    });
});
