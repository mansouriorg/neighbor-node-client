import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditPostForm } from "@/components/edit-post-form";
import type { EditOwnPostReply } from "@/lib/edit-own-post-limits";
import type { Post } from "@/lib/posts";

// The panel does the sending. Here it is a stand-in that each test controls, so
// no file is written and no network is used.
const mocks = { save: vi.fn() };

beforeEach(() => {
  mocks.save.mockReset();
});

const post: Post = {
  id: "post-1",
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
};

const titleLabel = "Title";
const detailsLabel = "Details";
const areaLabel = "Street or area";

function answer(value: EditOwnPostReply | null) {
  mocks.save.mockResolvedValue(value);
}

function show(busy: boolean = false) {
  return render(
    <EditPostForm post={post} busy={busy} onSave={(fields) => mocks.save(fields)} />,
  );
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

function openForm() {
  fireEvent.click(button("Edit my post"));
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function field(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function save() {
  fireEvent.click(button("Save changes"));
}

test("starts closed: a heading, a few words, the button, and nothing is sent", () => {
  show();
  expect(screen.getByRole("heading", { level: 3, name: "Edit your post" })).toBeDefined();
  expect(screen.getByText(/Everyone will see that the post was edited, and when/)).toBeDefined();
  expect(screen.getByText(/The kind and the status stay as they are/)).toBeDefined();
  expect(button("Edit my post")).toBeDefined();
  expect(screen.queryByLabelText(titleLabel)).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});

test("the button is easy to hit with a thumb", () => {
  show();
  expect(button("Edit my post").className).toContain("h-11");
});

test("opens a form with the three texts as they are now, and focus on the title", async () => {
  show();
  openForm();
  expect(field(titleLabel).value).toBe(post.title);
  expect(field(detailsLabel).value).toBe(post.details);
  expect(field(areaLabel).value).toBe(post.area);
  const form = document.querySelector("form");
  expect(form?.getAttribute("aria-labelledby")).toBe("edit-heading");
  expect(document.getElementById("edit-heading")?.textContent).toBe("Edit your post");
  expect(screen.queryByRole("button", { name: "Edit my post" })).toBeNull();
  expect(button("Save changes")).toBeDefined();
  expect(button("Cancel")).toBeDefined();
  await waitFor(() => expect(document.activeElement).toBe(field(titleLabel)));
});

test("there is no field for the kind or the status", () => {
  show();
  openForm();
  expect(screen.getAllByRole("textbox").length).toBe(3);
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
});

test("each field has a hint with the limits, and the fields are marked as needed", () => {
  show();
  openForm();
  expect(screen.getByText(/Up to 80 characters/)).toBeDefined();
  expect(screen.getByText(/Up to 500 characters/)).toBeDefined();
  expect(screen.getByText(/no house number/)).toBeDefined();
  expect(field(titleLabel).getAttribute("aria-required")).toBe("true");
  expect(field(detailsLabel).getAttribute("aria-required")).toBe("true");
  expect(field(areaLabel).getAttribute("aria-required")).toBe("true");
  expect(field(titleLabel).getAttribute("aria-describedby")).toBe("edit-post-title-hint");
});

test("Cancel closes the form without sending, puts focus back on the button, and the next time the form starts from the post again", async () => {
  show();
  openForm();
  fill(titleLabel, "Something else entirely");
  fireEvent.click(button("Cancel"));
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(button("Edit my post")));
  openForm();
  expect(field(titleLabel).value).toBe(post.title);
});

test("pressing Save without a change says so, and sends nothing", () => {
  show();
  openForm();
  save();
  expect(screen.getByText("You have not changed anything yet. Change a text, or press Cancel.")).toBeDefined();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(field(titleLabel).value).toBe(post.title);
});

test("spaces around the same texts are not a change", () => {
  show();
  openForm();
  fill(titleLabel, `  ${post.title}  `);
  fill(areaLabel, `${post.area} `);
  save();
  expect(screen.getByText(/You have not changed anything yet/)).toBeDefined();
  expect(mocks.save).not.toHaveBeenCalled();
});

test("the message about no change goes away when a text is changed", () => {
  show();
  openForm();
  save();
  expect(screen.getByText(/You have not changed anything yet/)).toBeDefined();
  fill(areaLabel, "Fig Lane");
  expect(screen.queryByText(/You have not changed anything yet/)).toBeNull();
});

test("a text that fails the check is shown at its field, nothing is sent, and focus goes to the first problem", async () => {
  show();
  openForm();
  fill(titleLabel, "Hi");
  fill(detailsLabel, "");
  fill(areaLabel, "Olive Street 12");
  save();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.getByText("The title is too short. Use at least 5 characters.")).toBeDefined();
  expect(screen.getByText("Say a little more about it.")).toBeDefined();
  expect(screen.getByText("Write only a street or an area, without a house number.")).toBeDefined();
  expect(field(titleLabel).getAttribute("aria-invalid")).toBe("true");
  expect(field(titleLabel).getAttribute("aria-describedby")).toBe("edit-post-title-hint edit-post-title-error");
  await waitFor(() => expect(document.activeElement).toBe(field(titleLabel)));
});

test("focus goes to the first problem in page order, and a message goes away when its field is changed", async () => {
  show();
  openForm();
  fill(areaLabel, "");
  fill(detailsLabel, "short");
  save();
  await waitFor(() => expect(document.activeElement).toBe(field(detailsLabel)));
  expect(screen.getByText("Write the street or area.")).toBeDefined();
  fill(areaLabel, "Fig Lane");
  expect(screen.queryByText("Write the street or area.")).toBeNull();
  expect(field(areaLabel).getAttribute("aria-invalid")).toBeNull();
  expect(screen.getByText(/Add a few more words/)).toBeDefined();
});

test("a change that passes is handed on with clean texts, and the form is closed when the server says ok", async () => {
  answer({ status: "ok", post, reports: { total: 0, byReason: [] } });
  show();
  openForm();
  fill(titleLabel, "  Help moving a sofa and a table ");
  fill(areaLabel, " Olive Street and Fig Lane");
  save();
  await screen.findByText("Saved. Everyone now sees the new text, marked as edited.");
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save).toHaveBeenCalledWith({
    title: "Help moving a sofa and a table",
    details: post.details,
    area: "Olive Street and Fig Lane",
  });
  expect(screen.queryByRole("textbox")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(button("Edit my post")));
});

test("the saved message is a status for screen readers, and it goes away when the form is opened again", async () => {
  answer({ status: "ok", post, reports: { total: 0, byReason: [] } });
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  const saved = await screen.findByText(/Saved\. Everyone now sees the new text/);
  expect(saved.getAttribute("role")).toBe("status");
  openForm();
  expect(screen.queryByText(/Saved\. Everyone now sees the new text/)).toBeNull();
});

test("while the request is on its way the button says it is busy, a second press does nothing, and Cancel waits", async () => {
  let finish: (value: EditOwnPostReply | null) => void = () => {};
  mocks.save.mockReturnValueOnce(new Promise<EditOwnPostReply | null>((resolve) => { finish = resolve; }));
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  fireEvent.click(button("Saving..."));
  fireEvent.click(button("Saving..."));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(button("Saving...").getAttribute("aria-disabled")).toBe("true");
  expect(button("Cancel").getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(button("Cancel"));
  expect(field(areaLabel).value).toBe("Fig Lane");
  finish({ status: "ok", post, reports: { total: 0, byReason: [] } });
  await screen.findByText(/Saved\./);
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

test("when the panel is busy with another change, the buttons wait", () => {
  show(true);
  openForm();
  expect(button("Save changes").getAttribute("aria-disabled")).toBe("true");
  expect(button("Cancel").getAttribute("aria-disabled")).toBe("true");
});

test("when another change is still on its way the form says so and keeps what was typed", async () => {
  answer(null);
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Another change is still on its way.");
  expect(alert.textContent).toContain("What you wrote is still here.");
  expect(field(areaLabel).value).toBe("Fig Lane");
});

test("when the server finds a problem the browser did not, it shows it at the field and keeps what was typed", async () => {
  answer({ status: "invalid", errors: { area: "Write only a street or an area, without a house number." } });
  show();
  openForm();
  fill(titleLabel, "Help moving a sofa and a table");
  save();
  expect(await screen.findByText("Write only a street or an area, without a house number.")).toBeDefined();
  expect(field(areaLabel).getAttribute("aria-invalid")).toBe("true");
  expect(field(titleLabel).value).toBe("Help moving a sofa and a table");
  await waitFor(() => expect(document.activeElement).toBe(field(areaLabel)));
});

test("a visitor who tried too often is told how long to wait, and keeps what was typed", async () => {
  answer({ status: "limited", minutes: 12 });
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Too many tries just now.");
  expect(alert.textContent).toContain("Nothing was changed");
  expect(alert.textContent).toContain("Please wait about 12 minutes and try again.");
  expect(field(areaLabel).value).toBe("Fig Lane");
  expect(button("Save changes")).toBeDefined();
});

test("one minute is written in the singular", async () => {
  answer({ status: "limited", minutes: 1 });
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("about 1 minute and");
  expect(alert.textContent).not.toContain("1 minutes");
});

test("a failure on the server, or a request that cannot be sent, keeps the form and what was typed, and a later try can work", async () => {
  mocks.save.mockResolvedValueOnce({ status: "failed" });
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  mocks.save.mockResolvedValueOnce({ status: "ok", post, reports: { total: 0, byReason: [] } });
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  const first = await screen.findByRole("alert");
  expect(first.textContent).toContain("The change was not saved. What you wrote is still here.");
  expect(field(areaLabel).value).toBe("Fig Lane");
  save();
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  // While the request is on its way the button says "Saving...", so waiting for
  // "Save changes" means that the second try is over.
  await screen.findByRole("button", { name: "Save changes" });
  expect(screen.getByRole("alert").textContent).toContain("was not saved");
  expect(field(areaLabel).value).toBe("Fig Lane");
  save();
  await screen.findByText(/Saved\./);
  expect(mocks.save).toHaveBeenCalledTimes(3);
});

test("a link that does not fit is left to the panel: the form shows nothing of its own", async () => {
  answer({ status: "not-allowed" });
  show();
  openForm();
  fill(areaLabel, "Fig Lane");
  save();
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
  await screen.findByRole("button", { name: "Save changes" });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(field(areaLabel).value).toBe("Fig Lane");
});
