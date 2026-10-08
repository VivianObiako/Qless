import { chairsOf, isMine, myChair, readyChairs, workerName } from "./seats";
import { entry, operator, operatorView, owner, seat } from "@/test/fixtures";

describe("chairsOf", () => {
  it("derives each chair's state from the seat and whoever is on it", () => {
    const seats = [
      seat({ id: "closed", active: false, worker: owner }),
      seat({ id: "unstaffed" }),
      seat({ id: "ready", worker: owner }),
      seat({ id: "called", worker: owner }),
      seat({ id: "serving", worker: owner }),
    ];
    const servingList = [
      entry({ id: "a", seatId: "called" }),
      entry({ id: "b", seatId: "serving", servedAt: "2026-01-01T09:06:00Z" }),
    ];

    const states = chairsOf(operatorView(seats, servingList)).map((chair) => chair.state);

    expect(states).toEqual(["closed", "unstaffed", "ready", "called", "serving"]);
  });

  it("keeps seat order and attaches the person called to each chair", () => {
    const seats = [seat({ id: "one" }), seat({ id: "two", worker: owner })];
    const called = entry({ seatId: "two", number: 7 });

    const chairs = chairsOf(operatorView(seats, [called]));

    expect(chairs.map((chair) => chair.seat.id)).toEqual(["one", "two"]);
    expect(chairs[0].entry).toBeNull();
    expect(chairs[1].entry?.number).toBe(7);
  });
});

describe("readyChairs", () => {
  it("never offers an open chair that nobody works", () => {
    const chairs = chairsOf(
      operatorView([seat({ id: "empty" }), seat({ id: "staffed", worker: owner })]),
    );

    expect(readyChairs(chairs).map((chair) => chair.seat.id)).toEqual(["staffed"]);
  });
});

describe("isMine and myChair", () => {
  const chairs = chairsOf(
    operatorView([
      seat({ id: "owner-chair", worker: owner }),
      seat({ id: "tunde-chair", worker: operator("op-tunde") }),
      seat({ id: "nobody" }),
    ]),
  );

  it("finds the owner's chair for the owner", () => {
    expect(myChair(chairs, true, null)?.seat.id).toBe("owner-chair");
  });

  it("finds an operator's chair by their id, not the owner's", () => {
    expect(myChair(chairs, false, "op-tunde")?.seat.id).toBe("tunde-chair");
  });

  it("returns nothing for an operator who works no chair", () => {
    expect(myChair(chairs, false, "op-somebody-else")).toBeNull();
  });

  it("never claims a chair nobody works", () => {
    expect(isMine(seat(), true, null)).toBe(false);
  });
});

describe("workerName", () => {
  it("uses the worker's name when there is one", () => {
    expect(workerName(seat({ worker: operator("op-1", "Kemi") }))).toBe("Kemi");
  });

  it("falls back to the role when the name is empty", () => {
    expect(workerName(seat({ worker: { type: "OWNER", name: "" } }))).toBe("Owner");
    expect(workerName(seat({ worker: { type: "OPERATOR", operatorId: "x", name: "" } }))).toBe(
      "Operator",
    );
  });

  it("says so when nobody works the chair", () => {
    expect(workerName(seat())).toBe("Nobody at it");
  });
});
