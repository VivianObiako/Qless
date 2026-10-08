import { act, render, screen } from "@testing-library/react";
import { writeSession } from "@/lib/session";
import { useStoredNumber, useStoredValue } from "./useStoredValue";

function Value({ storageKey }: { storageKey: string }): React.JSX.Element {
  return <output>{useStoredValue(storageKey) ?? "empty"}</output>;
}

function NumberValue({ storageKey }: { storageKey: string }): React.JSX.Element {
  const value = useStoredNumber(storageKey);
  return <output>{value === null ? "none" : String(value)}</output>;
}

beforeEach(() => window.localStorage.clear());

describe("useStoredValue", () => {
  it("reads what is already stored", () => {
    window.localStorage.setItem("qless.theme", "dark");
    render(<Value storageKey="qless.theme" />);

    expect(screen.getByRole("status")).toHaveTextContent("dark");
  });

  it("updates when this tab writes the key", () => {
    render(<Value storageKey="qless.theme" />);
    expect(screen.getByRole("status")).toHaveTextContent("empty");

    act(() => writeSession("qless.theme", "light"));

    expect(screen.getByRole("status")).toHaveTextContent("light");
  });

  it("updates when another tab writes the key", () => {
    render(<Value storageKey="qless.theme" />);

    act(() => {
      window.localStorage.setItem("qless.theme", "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: "qless.theme" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent("dark");
  });
});

describe("useStoredNumber", () => {
  it("parses a stored number and ignores anything that is not one", () => {
    window.localStorage.setItem("qless.joinedAhead.a", "4");
    window.localStorage.setItem("qless.joinedAhead.b", "not-a-number");
    render(
      <>
        <NumberValue storageKey="qless.joinedAhead.a" />
        <NumberValue storageKey="qless.joinedAhead.b" />
      </>,
    );

    const [a, b] = screen.getAllByRole("status");
    expect(a).toHaveTextContent("4");
    expect(b).toHaveTextContent("none");
  });
});
