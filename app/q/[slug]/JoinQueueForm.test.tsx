import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinQueueForm } from "./JoinQueueForm";

describe("JoinQueueForm", () => {
  it("asks for a person's name by default", () => {
    render(<JoinQueueForm onJoin={jest.fn()} joining={false} />);

    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("asks a team queue for the team name, and says so when it is left empty", async () => {
    const onJoin = jest.fn();
    render(<JoinQueueForm onJoin={onJoin} joining={false} asksTeamName />);

    await userEvent.click(screen.getByRole("button", { name: "Take my number" }));

    expect(screen.getByLabelText("Team name")).toHaveAccessibleDescription("Enter your team name to join");
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("names the team that is already in line, until the name is changed", async () => {
    const onJoin = jest.fn().mockResolvedValue(false);
    render(<JoinQueueForm onJoin={onJoin} joining={false} asksTeamName joinErrorCode="team_name_taken" />);
    const input = screen.getByLabelText("Team name");

    await userEvent.type(input, " Team Alpha ");
    await userEvent.click(screen.getByRole("button", { name: "Take my number" }));

    expect(onJoin).toHaveBeenCalledWith("Team Alpha");
    expect(input).toHaveAccessibleDescription("A team called Team Alpha is already in the queue.");
    expect(screen.getByText("Already joined?")).toBeInTheDocument();

    await userEvent.type(input, "2");

    expect(input).not.toHaveAccessibleDescription();
    expect(screen.queryByText("Already joined?")).not.toBeInTheDocument();
  });
});
