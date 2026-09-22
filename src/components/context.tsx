"use client";
import { createContext, useContext } from "react";
import type { TimeZonePreference } from "@/lib/time-zone";
import type {
  Command,
  Coupon,
  DiaryEvent,
  KingdomState,
  Role,
} from "@/lib/domain";
export type Panel =
  | {
      kind:
        "status" | "settings" | "login" | "create-card" | "inbox" | "partner";
    }
  | { kind: "event"; event?: DiaryEvent }
  | { kind: "event-detail"; event: DiaryEvent }
  | { kind: "redeem"; coupon: Coupon }
  | { kind: "coupon-use"; id: string }
  | { kind: "coupon-product"; id: string }
  | { kind: "recipe-form"; id?: string }
  | { kind: "recipe-detail"; id: string }
  | { kind: "cook"; id: string }
  | { kind: "trip-form"; id?: string }
  | { kind: "trip-detail"; id: string }
  | null;
export type AppContext = {
  serverOffset: number;
  timeZonePreference: TimeZonePreference;
  displayTimeZone: string;
  localTimeZone: string;
  setTimeZonePreference: (preference: TimeZonePreference) => void;
  state: KingdomState;
  role: Role;
  busy: boolean;
  panel: Panel;
  feedback: string;
  setPanel: (panel: Panel) => void;
  mutate: (command: Command) => Promise<KingdomState | null>;
  toast: (message: string) => void;
  openTrip: (id: string) => void;
  reaction: { kind: "pat" | "hug" | "poke"; to: Role; id: string } | null;
  reactTo: (kind: "pat" | "hug" | "poke", to: Role) => void;
};
export const Context = createContext<AppContext | null>(null);
export function useKingdom() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing Kingdom context");
  return value;
}
