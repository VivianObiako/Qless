import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

function Harness({ onConfirm }: { onConfirm: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Close the queue?"
      description="Everyone still waiting is told the queue has closed."
      confirmLabel="Close queue"
      destructive
      onConfirm={onConfirm}
    />
  );
}

describe("ConfirmDialog", () => {
  it("is an alert dialog named by its title and described by its body", () => {
    render(<Harness onConfirm={jest.fn()} />);

    const dialog = screen.getByRole("alertdialog", { name: "Close the queue?" });
    expect(dialog).toHaveAccessibleDescription("Everyone still waiting is told the queue has closed.");
  });

  it("confirms with the named action", async () => {
    const onConfirm = jest.fn();
    render(<Harness onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Close queue" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without confirming", async () => {
    const onConfirm = jest.fn();
    render(<Harness onConfirm={onConfirm} />);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("puts focus on Cancel first, so Enter never confirms by accident", () => {
    render(<Harness onConfirm={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});
