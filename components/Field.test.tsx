import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field } from "./Field";

describe("Field", () => {
  it("wires the label to the input so it can be found and typed into by name", async () => {
    render(<Field label="Your name" />);
    const input = screen.getByLabelText("Your name");

    await userEvent.type(input, "Bisi");

    expect(input).toHaveValue("Bisi");
  });

  it("describes the input with its hint", () => {
    render(<Field label="Queue name" hint="Customers see this" />);

    expect(screen.getByLabelText("Queue name")).toHaveAccessibleDescription("Customers see this");
  });

  it("marks the input invalid and reads the error instead of the hint", () => {
    render(<Field label="Recovery code" hint="Eight characters" error="That code does not match" />);
    const input = screen.getByLabelText("Recovery code");

    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("That code does not match");
    expect(screen.queryByText("Eight characters")).not.toBeInTheDocument();
  });

  it("is not marked invalid without an error", () => {
    render(<Field label="Queue name" />);

    expect(screen.getByLabelText("Queue name")).not.toHaveAttribute("aria-invalid");
  });
});
