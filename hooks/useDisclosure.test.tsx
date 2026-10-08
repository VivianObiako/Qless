import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDisclosure } from "./useDisclosure";

function Menu(): React.JSX.Element {
  const { open, toggle, containerRef, triggerRef, panelId } = useDisclosure();
  return (
    <div>
      <div ref={containerRef}>
        <button ref={triggerRef} aria-expanded={open} aria-controls={panelId} onClick={toggle}>
          Account
        </button>
        {open && (
          <div id={panelId}>
            <a href="/profile">Profile</a>
          </div>
        )}
      </div>
      <p>Elsewhere</p>
    </div>
  );
}

describe("useDisclosure", () => {
  it("opens and closes from the trigger", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Account" });

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and hands focus back to the trigger", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Account" });

    await userEvent.click(trigger);
    await userEvent.tab();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on a click anywhere outside it", async () => {
    render(<Menu />);

    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    await userEvent.click(screen.getByText("Elsewhere"));

    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });
});
