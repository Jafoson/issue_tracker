import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/auth", () => ({
  signIn: mock(),
  signOut: mock(),
}));

import { signOut } from "@/auth";
import { logout } from "@/features/auth/actions";

const mockSignOut = signOut as ReturnType<typeof mock>;

describe("logout()", () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("ruft signOut mit redirect:false auf", async () => {
    await logout();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
  });

  it("gibt keinen Wert zurück", async () => {
    const result = await logout();
    expect(result).toBeUndefined();
  });
});
