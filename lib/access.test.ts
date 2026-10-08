import { classifyUnauthorized } from "./access";
import { ApiError, getMyQueues } from "./api";

jest.mock("./api", () => {
  const actual = jest.requireActual<typeof import("./api")>("./api");
  return { ...actual, getMyQueues: jest.fn() };
});

const mockedGetMyQueues = jest.mocked(getMyQueues);

describe("classifyUnauthorized", () => {
  it("says the queue is not permitted when the session still resolves", async () => {
    mockedGetMyQueues.mockResolvedValueOnce({
      role: "OWNER",
      queues: [],
      principalId: "owner-1",
      archived: [],
      displayName: "Ada",
    });

    await expect(classifyUnauthorized("token")).resolves.toBe("not-permitted");
  });

  it("says the session ended when the session itself is rejected", async () => {
    mockedGetMyQueues.mockRejectedValueOnce(new ApiError("UNAUTHORIZED", "no", 401));

    await expect(classifyUnauthorized("token")).resolves.toBe("session-ended");
  });

  it("refuses to decide on a network or server failure", async () => {
    mockedGetMyQueues.mockRejectedValueOnce(new ApiError("INTERNAL", "boom", 500));
    await expect(classifyUnauthorized("token")).resolves.toBeNull();

    mockedGetMyQueues.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(classifyUnauthorized("token")).resolves.toBeNull();
  });
});
