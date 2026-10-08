import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("is found by its accessible name and fires on click", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Call next</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Call next" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and announces itself busy while loading, so a double tap cannot fire twice", async () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Call next
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Call next" });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not mark itself busy when it is not loading", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-busy");
  });
});
