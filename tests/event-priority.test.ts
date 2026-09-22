import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSeed, applyCommand, type DiaryEvent } from "../src/lib/domain";
import { prioritizedPlans } from "../src/lib/event-priority";
const event = (id: string, date: string, countdown = true): DiaryEvent => ({
  id,
  date,
  countdown,
  annual: false,
  title: id,
  theme: 3,
  mood: 0,
  note: "",
  photoId: null,
  author: "blue",
  createdAt: date + "T12:00:00Z",
  updatedAt: date + "T12:00:00Z",
});
test("manual future pin wins; automatic pin uses the nearest plan and ignores expired pins", () => {
  const events = [
    event("later", "2027-03-01"),
    event("soon", "2027-01-03", false),
    event("past", "2026-12-01"),
  ];
  assert.equal(
    prioritizedPlans(events, "later", "2027-01-01").pinned?.id,
    "later",
  );
  assert.deepEqual(
    prioritizedPlans(events, "later", "2027-01-01").upcoming.map((e) => e.id),
    ["later", "soon"],
  );
  assert.equal(prioritizedPlans(events, null, "2027-01-01").pinned?.id, "soon");
  assert.equal(
    prioritizedPlans(events, "past", "2027-01-01").pinned?.id,
    "soon",
  );
  assert.equal(prioritizedPlans([], null, "2027-01-01").pinned, undefined);
});
test("saving first countdown does not turn automatic priority into a manual pin", () => {
  let state = makeSeed(false);
  const { id, ...fields } = event("later", "2027-03-01");
  state = applyCommand(state, { type: "event.save", event: fields }, "blue");
  assert.equal(state.pinnedEventId, null);
  state = applyCommand(
    state,
    { type: "event.pin", id: state.events[0].id },
    "blue",
  );
  const pinned = state.pinnedEventId;
  state = applyCommand(
    state,
    { type: "event.save", event: { ...fields, date: "2027-01-03" } },
    "red",
  );
  assert.equal(state.pinnedEventId, pinned);
});
