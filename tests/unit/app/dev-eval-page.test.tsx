import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// R4-32 of docs/specs/04-ai.md: the on-device eval page exists under `pnpm dev` only. Anywhere else
// it calls notFound(), so a production build answers 404 (F-SEC4-05 checks the build itself).

vi.mock("@/features/ai/eval/EvalRunner", () => ({
  EvalRunner: () => <p>the eval runner</p>,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

/** What the page threw, or null when it rendered. */
async function thrownBy(): Promise<unknown> {
  const { default: Page } = await import("@/app/dev/on-device-eval/page");
  try {
    Page();
    return null;
  } catch (error) {
    return error;
  }
}

describe("R4-32 the on-device eval page", () => {
  it.each(["production", "test"])(
    "R4-32 calls notFound() when NODE_ENV is %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      const error = await thrownBy();
      expect((error as { digest?: unknown } | null)?.digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    },
  );

  it.each(["production", "test"])(
    "R4-32 names nothing of the page in its metadata when NODE_ENV is %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      const { generateMetadata } = await import("@/app/dev/on-device-eval/page");
      expect(generateMetadata()).toEqual({});
    },
  );

  it("R4-32 takes its title, and stays out of search, under pnpm dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { generateMetadata } = await import("@/app/dev/on-device-eval/page");
    expect(generateMetadata()).toEqual({
      title: "On-device evaluation",
      robots: { index: false, follow: false },
    });
  });

  it("R4-32 renders its heading and the runner under pnpm dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { default: Page } = await import("@/app/dev/on-device-eval/page");
    render(Page());
    expect(
      screen.getByRole("heading", { level: 1, name: "On-device evaluation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("the eval runner")).toBeInTheDocument();
  });
});
