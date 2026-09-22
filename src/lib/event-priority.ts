import { daysUntil, nextOccurrence, type DiaryEvent } from "./domain";
export function prioritizedPlans(
  events: DiaryEvent[],
  pinnedId: string | null,
  current: string,
) {
  const upcoming = events
    .filter(
      (e) =>
        daysUntil(e, current) > 0 ||
        (e.countdown && daysUntil(e, current) === 0),
    )
    .sort(
      (a, b) =>
        nextOccurrence(a, current).localeCompare(nextOccurrence(b, current)) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const pinned = upcoming.find((e) => e.id === pinnedId) || upcoming[0];
  return {
    pinned,
    upcoming: pinned
      ? [pinned, ...upcoming.filter((e) => e.id !== pinned.id)]
      : upcoming,
  };
}
