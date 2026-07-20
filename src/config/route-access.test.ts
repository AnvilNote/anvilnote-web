import { describe, expect, it } from "vitest";
import {
  isDesktopOnlyRoute,
  isPublicWebRoute,
  stripLocalePrefix,
} from "./route-access";

describe("stripLocalePrefix", () => {
  it("strips a known locale prefix", () => {
    expect(stripLocalePrefix("/en/documents")).toBe("/documents");
    expect(stripLocalePrefix("/zh-TW/settings")).toBe("/settings");
  });

  it("leaves the root locale path as /", () => {
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/zh-TW")).toBe("/");
  });

  it("leaves non-locale paths untouched", () => {
    expect(stripLocalePrefix("/_next/static/example.js")).toBe("/_next/static/example.js");
    expect(stripLocalePrefix("/favicon-dark.svg")).toBe("/favicon-dark.svg");
  });
});

describe("isPublicWebRoute", () => {
  it("treats locale roots as public", () => {
    expect(isPublicWebRoute("/en")).toBe(true);
    expect(isPublicWebRoute("/zh-TW")).toBe(true);
  });

  it("treats privacy and terms as public", () => {
    expect(isPublicWebRoute("/en/privacy")).toBe(true);
    expect(isPublicWebRoute("/en/terms")).toBe(true);
    expect(isPublicWebRoute("/en/download")).toBe(false);
  });

  it("does not treat desktop-only routes as public", () => {
    expect(isPublicWebRoute("/en/documents")).toBe(false);
    expect(isPublicWebRoute("/zh-TW/settings")).toBe(false);
  });
});

describe("isDesktopOnlyRoute", () => {
  it("flags documents, including nested document ids", () => {
    expect(isDesktopOnlyRoute("/en/documents")).toBe(true);
    expect(isDesktopOnlyRoute("/en/documents/abc")).toBe(true);
  });

  it("flags settings and templates", () => {
    expect(isDesktopOnlyRoute("/zh-TW/settings")).toBe(true);
    expect(isDesktopOnlyRoute("/ja/templates")).toBe(true);
  });

  it("does not flag public routes", () => {
    expect(isDesktopOnlyRoute("/en")).toBe(false);
    expect(isDesktopOnlyRoute("/en/privacy")).toBe(false);
    expect(isDesktopOnlyRoute("/en/terms")).toBe(false);
    expect(isDesktopOnlyRoute("/en/download")).toBe(false);
  });

  it("does not flag Next.js internals or static assets", () => {
    expect(isDesktopOnlyRoute("/_next/static/example.js")).toBe(false);
    expect(isDesktopOnlyRoute("/favicon-dark.svg")).toBe(false);
  });

  it("does not false-positive on paths that merely start with a similar word", () => {
    expect(isDesktopOnlyRoute("/en/documentation")).toBe(false);
  });
});
