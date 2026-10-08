import { deriveBoardRows } from "./board";

const counter = { number: 10, seatId: "s1", seatName: "Chair 1" };

describe("deriveBoardRows", () => {
  it("compresses everyone between the next call and you into one span", () => {
    const rows = deriveBoardRows({
      serving: [counter],
      seatCount: 1,
      waitingNumbers: [11, 12, 13, 14, 15, 16],
      myNumber: 15,
    });

    expect(rows).toEqual([
      { label: "10", status: "At the counter", kind: "serving" },
      { label: "11", status: "Called next", kind: "next" },
      { label: "12 – 14", status: "Waiting", kind: "waiting" },
      { label: "15", status: "You", kind: "you" },
      { label: "16", status: "Waiting", kind: "waiting" },
    ]);
  });

  it("names the chair only when the queue has more than one", () => {
    const [single] = deriveBoardRows({
      serving: [counter],
      seatCount: 1,
      waitingNumbers: [11],
      myNumber: 11,
    });
    const [multi] = deriveBoardRows({
      serving: [counter],
      seatCount: 2,
      waitingNumbers: [11],
      myNumber: 11,
    });

    expect(single.status).toBe("At the counter");
    expect(multi.status).toBe("Chair 1");
  });

  it("shows one waiting row, not a span, when one person is in between", () => {
    const rows = deriveBoardRows({
      serving: [],
      seatCount: 1,
      waitingNumbers: [11, 12, 13],
      myNumber: 13,
    });

    expect(rows.map((row) => row.label)).toEqual(["11", "12", "13"]);
  });

  it("collapses to the counter and you when you are next", () => {
    const rows = deriveBoardRows({
      serving: [counter],
      seatCount: 1,
      waitingNumbers: [11, 12, 13],
      myNumber: 11,
      collapsed: true,
    });

    expect(rows).toEqual([
      { label: "10", status: "At the counter", kind: "serving" },
      { label: "11", status: "You — next", kind: "you" },
    ]);
  });

  it("in a draw, shows the drawn number and a count, never a run of numbers", () => {
    const rows = deriveBoardRows({
      serving: [],
      seatCount: 1,
      waitingNumbers: [11, 12, 13, 14],
      myNumber: 13,
      draw: { upNextNumber: 12 },
    });

    expect(rows).toEqual([
      { label: "12", status: "Up next", kind: "next" },
      { label: "13", status: "You", kind: "you" },
      { label: "+2", status: "Still in the draw", kind: "waiting" },
    ]);
  });

  it("in a draw, does not show you twice when you are the one drawn", () => {
    const rows = deriveBoardRows({
      serving: [],
      seatCount: 1,
      waitingNumbers: [11, 12],
      myNumber: 12,
      draw: { upNextNumber: 12 },
    });

    expect(rows.filter((row) => row.label === "12")).toHaveLength(1);
  });
});
