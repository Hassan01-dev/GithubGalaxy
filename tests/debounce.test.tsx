import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useDebounced } from "@/hooks/useDebounced";
import { searchLocal } from "@/components/explorer/SearchBox";
import { repo } from "./fixtures";

it("only emits the last value after the quiet period", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebounced(v, 450), { initialProps: { v: "r" } });
  rerender({ v: "ru" });
  rerender({ v: "rus" });
  act(() => void vi.advanceTimersByTime(449));
  expect(result.current).toBe("r");
  act(() => void vi.advanceTimersByTime(1));
  expect(result.current).toBe("rus");
  vi.useRealTimers();
});

it("local search ranks name matches above topic and description", () => {
  const a = repo({ id: 1, fullName: "x/other", name: "other", topics: ["rocket"], stars: 9 });
  const b = repo({ id: 2, fullName: "acme/rocket", name: "rocket", topics: [], stars: 1 });
  const c = repo({ id: 3, fullName: "y/z", name: "z", topics: [], description: "a rocket thing", stars: 99 });
  expect(searchLocal([a, c, b], "rocket").map((r) => r.id)).toEqual([2, 1, 3]);
  expect(searchLocal([a], "r")).toEqual([]);
});
