import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  if (typeof window === "undefined") return; // node-environment tests
  cleanup();
  window.localStorage.clear();
});
