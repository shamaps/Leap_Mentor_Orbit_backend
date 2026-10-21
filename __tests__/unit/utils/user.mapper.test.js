const { toUserDTO } = require("../../../utils/mappers/user.mapper");

describe("toUserDTO permissions", () => {
    it("returns backend-computed permissions for the user's role", () => {
        const dto = toUserDTO({ _id: "u1", roles: ["mentor"], name: "M", email: "m@test.com" });
        expect(dto.permissions).toContain("withdraw:earnings");
        expect(dto.permissions).not.toContain("view:invoice");
        expect(dto).not.toHaveProperty("password");
    });
});
