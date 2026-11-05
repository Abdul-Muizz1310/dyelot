import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Request, test } from "@playwright/test";
import { decodeSpec } from "@/spec";
import {
  aiSettings,
  answerAuthorize,
  answerExchange,
  answerModels,
  answerOpenRouter,
  answerShared,
  BRIEF_OUT,
  chatReply,
  expectBriefLines,
  type OpenRouterCall,
  openAiSettings,
  openAt,
  recordRequests,
  runBrief,
  sharedOk,
  TEST_KEY,
  TEXT_SLUGS,
} from "./ai-support";
import { button, inputsPanel } from "./studio-support";

// The visitor key's flows of docs/specs/04-ai.md, section 14.11 (Task 4.10a): the PKCE sign-in from
// the studio through /connect and /connect/callback (R4-33, 10.4, 13.6), the key's own calls to
// OpenRouter (R4-34) and I-M4-05, the key never reaching dyelot's origin. OpenRouter's sign-in, its
// code exchange and its chat calls are intercepted; nothing reaches the network.

test.use({ viewport: { width: 1280, height: 800 } });

const KEY_STORAGE = "dyelot:openrouter-key";
const CONNECTED = "Your OpenRouter key is connected for this tab.";
const REMEMBERED = "Your OpenRouter key is remembered on this device.";
const DISCONNECTED = "Disconnected. The key is gone from this browser.";
const WARNING =
  "A remembered key stays in this browser until you disconnect, and anyone who uses this browser can use it. Without this, the key is gone when you close the tab.";
const SENTENCES = {
  "not-started":
    "This sign-in did not start here, so dyelot did not use it. Start again from Connect.",
  "state-mismatch":
    "This sign-in does not match the one dyelot started, so dyelot did not use it. Start again from Connect.",
  denied: "OpenRouter did not return a key. You can start again, or keep using dyelot without one.",
  "exchange-failed": "OpenRouter did not accept the sign-in. Start again from Connect.",
  "storage-refused":
    "This browser would not keep the key. Allow this site to store data, or connect without Remember on this device.",
} as const;
/** 13.6's line when the callback cannot load the AI layer (controller ruling on Task 4.10a's review). */
const CALLBACK_LOAD_FAILED = "This page could not finish the sign-in. Start again from Connect.";
const CONNECT_STORAGE = "dyelot:connect";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const connectLink = (page: Page) =>
  page.getByRole("link", { name: "Connect your OpenRouter key", exact: true });
const rememberBox = (page: Page) =>
  page.getByRole("checkbox", { name: "Remember on this device", exact: true });
// Next.js keeps its own route announcer (role "alert") outside main.
const callbackAlert = (page: Page) => page.getByRole("main").getByRole("alert");

/** The two stores' copies of the key. */
const storedKeys = (page: Page) =>
  page.evaluate(
    (name) => ({ session: sessionStorage.getItem(name), local: localStorage.getItem(name) }),
    KEY_STORAGE,
  );

/** The studio's written hash. */
async function studioHash(page: Page): Promise<string> {
  await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#s=/);
  return page.evaluate(() => window.location.hash);
}

/** Opens the studio, then /connect from AI settings; returns the studio's hash. */
async function connectFromStudio(page: Page): Promise<string> {
  await openAt(page);
  const hash = await studioHash(page);
  await openAiSettings(page);
  await expect(aiSettings(page)).toContainText("No OpenRouter key connected.");
  await connectLink(page).click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(
    page.getByRole("heading", { name: "Connect your OpenRouter key", exact: true }),
  ).toBeVisible();
  return hash;
}

/** The callback address OpenRouter returns to, with `state` (the authorize URL's own by default). */
const callbackFor =
  (page: Page, state?: string) =>
  (authorize: URL): string =>
    `${new URL(page.url()).origin}/connect/callback?code=C&state=${state ?? authorize.searchParams.get("state")}`;

/** Signs in from the studio (F-KEY4-01's steps) and returns the calls it made. */
async function signIn(page: Page, options: { remember: boolean }) {
  const opened = await answerAuthorize(page, callbackFor(page));
  const exchanges = await answerExchange(page, () => ({ status: 200, body: { key: TEST_KEY } }));
  const hash = await connectFromStudio(page);
  if (options.remember) await rememberBox(page).check();
  await button(page, "Continue to OpenRouter").click();
  await page.waitForURL((url) => url.pathname === "/studio" && url.hash === hash);
  return { opened, exchanges, hash };
}

/**
 * Intercepts every request to `origin` (E3: the flows assert by intercepting every request) and
 * hands each on unchanged. Registered after the flow's own answers, it sees each request first;
 * `fallback` then passes it to them, or to the server. It returns the requests it saw.
 */
async function interceptOrigin(page: Page, origin: string): Promise<Request[]> {
  const seen: Request[] = [];
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      seen.push(route.request());
      await route.fallback();
    },
  );
  return seen;
}

/**
 * The forms the key could travel in: its text, URL-encoded, and base64 and base64url. Each encoding
 * is taken at the three byte alignments, so the key is found inside a longer encoded value too
 * (Basic credentials, a token), keeping only the characters the key's own bytes decide.
 */
function keyForms(key: string): string[] {
  const forms = new Set([key, encodeURIComponent(key)]);
  const length = Buffer.byteLength(key);
  for (let pad = 0; pad < 3; pad++) {
    const bytes = Buffer.concat([Buffer.alloc(pad, 0x20), Buffer.from(key)]);
    for (const encoding of ["base64", "base64url"] as const) {
      // Character i covers bits 6i to 6i + 6: the key alone decides those inside its bytes.
      const text = bytes.toString(encoding);
      forms.add(text.slice(Math.ceil((pad * 4) / 3), Math.floor(((pad + length) * 8) / 6)));
    }
  }
  return [...forms];
}

/** The base64url SHA-256 of a verifier: its S256 challenge. */
const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/** Stores the visitor's key in session storage before the page's scripts run. */
async function withKey(page: Page): Promise<void> {
  await page.addInitScript(([name, key]) => sessionStorage.setItem(name, key), [
    KEY_STORAGE,
    TEST_KEY,
  ] as const);
}

/** Polls the hash until its spec's `meta.createdWith` is `value`. */
async function expectCreatedWith(page: Page, value: string): Promise<void> {
  await expect
    .poll(async () => {
      const hash = await page.evaluate(() => window.location.hash);
      return hash.startsWith("#s=") ? decodeSpec(hash.slice(3)).meta.createdWith : null;
    })
    .toBe(value);
}

test.describe("13.6 the connect pages", () => {
  test("F-KEY4-01 the sign-in from the studio keeps the key for the tab and returns to the same design", async ({
    page,
  }) => {
    const { opened, exchanges } = await signIn(page, { remember: false });
    expect(opened).toHaveLength(1);
    const [authorize] = opened;
    if (authorize === undefined) throw new Error("F-KEY4-01: no sign-in opened");
    expect(`${authorize.origin}${authorize.pathname}`).toBe("https://openrouter.ai/auth");
    const origin = new URL(page.url()).origin;
    expect(authorize.searchParams.get("callback_url")).toBe(`${origin}/connect/callback`);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("key_label")).toBe("dyelot");
    expect(authorize.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(exchanges).toHaveLength(1);
    const body = exchanges[0]?.body ?? {};
    expect(body).toEqual({
      code: "C",
      code_verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      code_challenge_method: "S256",
    });
    expect(challengeOf(String(body.code_verifier))).toBe(
      authorize.searchParams.get("code_challenge"),
    );
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText(CONNECTED);
    await expect(inputsPanel(page).getByRole("button", { name: "Disconnect" })).toBeVisible();
    expect(await storedKeys(page)).toEqual({ session: TEST_KEY, local: null });
  });

  test("F-KEY4-02 a callback with another state is refused with no exchange", async ({ page }) => {
    const other = "A".repeat(22);
    await answerAuthorize(page, callbackFor(page, other));
    const exchanges = await answerExchange(page, () => ({ status: 200, body: { key: TEST_KEY } }));
    await connectFromStudio(page);
    await button(page, "Continue to OpenRouter").click();
    await expect(callbackAlert(page)).toContainText(SENTENCES["state-mismatch"]);
    expect(exchanges).toEqual([]);
    expect(await storedKeys(page)).toEqual({ session: null, local: null });
    // The query is gone from the address bar (R4-33).
    expect(new URL(page.url()).search).toBe("");
  });

  test("F-KEY4-03 with a key, Read the brief goes to OpenRouter with it and not to the shared route", async ({
    page,
  }) => {
    await withKey(page);
    await answerModels(page);
    const calls = await answerOpenRouter(page, () => chatReply(BRIEF_OUT));
    const shared = await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await runBrief(page, "a key holder's tea room");
    await expectBriefLines(page, ["Made with your OpenRouter key (test/text-1:free)."]);
    await expectCreatedWith(page, "visitor-key");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(calls[0]?.body.model).toBe(TEXT_SLUGS[0]);
    expect(shared).toEqual([]);
  });

  test("F-KEY4-04 no request to dyelot's origin carries the key, and the page never shows it", async ({
    page,
    baseURL,
  }) => {
    const requests = recordRequests(page);
    const logged: string[] = [];
    page.on("console", (message) => logged.push(message.text()));
    await answerModels(page);
    await answerOpenRouter(page, () => chatReply(BRIEF_OUT));
    // Every request to the page's origin is intercepted (decision E3), not only observed.
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const intercepted = await interceptOrigin(page, origin);
    await signIn(page, { remember: false });
    await expect(page.locator("body")).not.toContainText(TEST_KEY);
    await runBrief(page, "a key that stays home");
    await expectBriefLines(page, ["Made with your OpenRouter key (test/text-1:free)."]);
    await openAiSettings(page);
    await expect(page.locator("body")).not.toContainText(TEST_KEY);
    expect(new URL(page.url()).origin).toBe(origin);
    const own = requests.filter((request) => new URL(request.url()).origin === origin);
    expect(own.length).toBeGreaterThan(0);
    const paths = (list: readonly Request[]) => list.map((each) => new URL(each.url()).pathname);
    expect(paths(intercepted)).toEqual(
      expect.arrayContaining(["/studio", "/connect", "/api/ai/models"]),
    );
    // Playwright routes no redirect's target, so the callback that OpenRouter's redirect opens is
    // read from the observed requests; every other request to the origin was intercepted.
    const routed = new Set(intercepted);
    expect(paths(own.filter((request) => !routed.has(request)))).toEqual(["/connect/callback"]);
    // The key in any of its forms: its text, URL-encoded, base64 or base64url.
    const forms = keyForms(TEST_KEY);
    expect(forms.length).toBeGreaterThan(2);
    const holdsKey = (part: string) => forms.some((form) => part.includes(form));
    // The forms find the key where an encoding hid it, as Basic credentials would.
    expect(holdsKey(`Basic ${Buffer.from(`user:${TEST_KEY}`).toString("base64")}`)).toBe(true);
    expect(holdsKey(`?k=${Buffer.from(`ab${TEST_KEY}`).toString("base64url")}`)).toBe(true);
    for (const request of [...intercepted, ...own]) {
      const headers = JSON.stringify(await request.allHeaders());
      const leak = [request.url(), headers, request.postData() ?? ""].some(holdsKey);
      expect(leak, request.url()).toBe(false);
    }
    // The browser shell never logs it (R4-29).
    expect(logged.filter(holdsKey)).toEqual([]);
    // The key did reach OpenRouter, so the check above looked for a value that was in play.
    const toOpenRouter = requests.filter((request) =>
      request.url().startsWith("https://openrouter.ai/api/v1/chat/completions"),
    );
    expect(toOpenRouter.length).toBeGreaterThan(0);
  });

  test("F-KEY4-05 a remembered key lives in local storage only, and Disconnect removes it", async ({
    page,
  }) => {
    await answerAuthorize(page, callbackFor(page));
    await answerExchange(page, () => ({ status: 200, body: { key: TEST_KEY } }));
    const hash = await connectFromStudio(page);
    await expect(rememberBox(page)).toHaveAccessibleDescription(WARNING);
    await expect(page.getByText(WARNING, { exact: true })).toBeVisible();
    await rememberBox(page).check();
    await button(page, "Continue to OpenRouter").click();
    await page.waitForURL((url) => url.pathname === "/studio" && url.hash === hash);
    expect(await storedKeys(page)).toEqual({ session: null, local: TEST_KEY });
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText(REMEMBERED);
    await inputsPanel(page).getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(aiSettings(page)).toContainText(DISCONNECTED);
    // Focus moves to the link that takes Disconnect's place, which the key's line describes.
    await expect(connectLink(page)).toBeFocused();
    await expect(connectLink(page)).toHaveAccessibleDescription(DISCONNECTED);
    expect(await storedKeys(page)).toEqual({ session: null, local: null });
  });

  test("F-KEY4-06 a refused key stops after one call, and the shared quota answers", async ({
    page,
  }) => {
    await withKey(page);
    await answerModels(page);
    const calls = await answerOpenRouter(page, () => ({
      status: 401,
      body: { error: { message: "No auth credentials found", code: 401 } },
    }));
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await runBrief(page, "a refused key at the harbor");
    await expectBriefLines(page, [
      "OpenRouter refused your key, so dyelot used its shared quota.",
      "Made with dyelot's shared AI (test/text-1:free).",
    ]);
    expect(calls).toHaveLength(1);
    await expect(inputsPanel(page)).not.toContainText("No auth credentials found");
  });

  test("F-KEY4-07 a callback with no code says OpenRouter returned no key, with both links", async ({
    page,
  }) => {
    await page.goto("/connect/callback");
    await expect(
      page.getByRole("heading", { name: "Connecting your OpenRouter key", exact: true }),
    ).toBeVisible();
    await expect(callbackAlert(page)).toContainText(SENTENCES.denied);
    await expect(page.getByRole("link", { name: "Start again", exact: true })).toHaveAttribute(
      "href",
      "/connect",
    );
    await expect(
      page.getByRole("link", { name: "Back to the studio", exact: true }),
    ).toHaveAttribute("href", "/studio");
    const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(result.violations).toEqual([]);
  });

  test("the connect page reads as 13.6 writes it, and names its two errors", async ({ page }) => {
    await page.goto("/connect");
    for (const text of [
      "dyelot can send its model actions through your own OpenRouter account instead of its shared quota.",
      "Your browser talks to OpenRouter directly. The key never reaches dyelot's server, its logs or its traces.",
      "dyelot asks only for free models, whose names end in :free.",
      "OpenRouter will ask you to sign in and to approve a key for dyelot.",
    ]) {
      await expect(page.getByText(text, { exact: true })).toBeVisible();
    }
    await expect(rememberBox(page)).not.toBeChecked();
    await expect(
      page.getByRole("link", { name: "Back to the studio", exact: true }),
    ).toHaveAttribute("href", "/studio");
    const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(result.violations).toEqual([]);

    // Session storage that refuses the record.
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      };
    });
    await button(page, "Continue to OpenRouter").click();
    await expect(callbackAlert(page)).toHaveText(
      "This browser blocks the storage the sign-in needs. Allow site data for dyelot and try again.",
    );
    // No Web Crypto, as on a page served over plain HTTP from another host.
    await page.evaluate(() => {
      Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    });
    await button(page, "Continue to OpenRouter").click();
    await expect(callbackAlert(page)).toHaveText(
      "This browser cannot make a secure sign-in here. Open dyelot over HTTPS and try again.",
    );
    expect(new URL(page.url()).pathname).toBe("/connect");
  });

  test("each other failure of the callback shows its sentence with the two links", async ({
    page,
  }) => {
    // not-started: a code with no sign-in begun in this tab.
    await page.goto("/connect/callback?code=C&state=AAAAAAAAAAAAAAAAAAAAAA");
    await expect(callbackAlert(page)).toContainText(SENTENCES["not-started"]);
    await expect(page.getByRole("link", { name: "Start again", exact: true })).toBeVisible();

    // exchange-failed: OpenRouter refuses the code.
    await answerAuthorize(page, callbackFor(page));
    let answer: () => { status: number; body: unknown } = () => ({ status: 403, body: {} });
    const exchanges: OpenRouterCall[] = await answerExchange(page, () => answer());
    await page.goto("/connect");
    await button(page, "Continue to OpenRouter").click();
    await expect(callbackAlert(page)).toContainText(SENTENCES["exchange-failed"]);
    expect(exchanges).toHaveLength(1);

    // storage-refused: the visitor chose Remember and local storage refuses the key.
    answer = () => ({ status: 200, body: { key: TEST_KEY } });
    await page.addInitScript((name) => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (this === window.localStorage && key === name) {
          throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        }
        setItem.call(this, key, value);
      };
    }, KEY_STORAGE);
    await page.goto("/connect");
    await rememberBox(page).check();
    await button(page, "Continue to OpenRouter").click();
    await expect(callbackAlert(page)).toContainText(SENTENCES["storage-refused"]);
    expect(await storedKeys(page)).toEqual({ session: null, local: null });
    await expect(page.getByRole("link", { name: "Back to the studio", exact: true })).toBeVisible();
  });
  test("the callback says it is checking, then that it connected, before it returns", async ({
    page,
  }) => {
    // Each text the callback's status shows reaches the test as it changes, even while the page
    // is leaving (Playwright's own reads wait for a pending navigation to finish).
    const texts: string[] = [];
    await page.exposeFunction("__statusText", (text: string) => texts.push(text));
    await page.addInitScript(() => {
      if (window.location.pathname !== "/connect/callback") return;
      let last: string | null = null;
      new MutationObserver(() => {
        const text = document.querySelector('main [role="status"]')?.textContent ?? null;
        if (text === null || text === last) return;
        last = text;
        (window as unknown as { __statusText(text: string): void }).__statusText(text);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    await answerAuthorize(page, callbackFor(page));
    await answerExchange(page, async () => {
      await answered;
      return { status: 200, body: { key: TEST_KEY } };
    });
    await page.goto("/connect");
    await button(page, "Continue to OpenRouter").click();
    await expect.poll(() => texts).toEqual(["Checking the sign-in…"]);
    answer();
    await page.waitForURL((url) => url.pathname === "/studio");
    expect(texts).toEqual(["Checking the sign-in…", "Connected. Returning to the studio…"]);
  });

  test("a callback that cannot load the AI layer asks to start again and drops the sign-in record", async ({
    page,
  }) => {
    await page.goto("/connect");
    await page.evaluate(([name, record]) => sessionStorage.setItem(name, record), [
      CONNECT_STORAGE,
      JSON.stringify({ v: 1, verifier: "v".repeat(43), state: "A".repeat(22), remember: false }),
    ] as const);
    // Only the AI layer's chunk fails: it is the one that holds the prompts.
    await page.route("**/_next/static/**/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes("Never write a color value")) await route.abort("failed");
      else await route.fulfill({ response, body });
    });
    await page.goto(`/connect/callback?code=C&state=${"A".repeat(22)}`);
    await expect(callbackAlert(page)).toContainText(CALLBACK_LOAD_FAILED);
    await expect(page.getByRole("link", { name: "Start again", exact: true })).toBeVisible();
    expect(await page.evaluate((name) => sessionStorage.getItem(name), CONNECT_STORAGE)).toBeNull();
    expect(new URL(page.url()).search).toBe("");
  });

  test("a second press while the sign-in page opens starts nothing", async ({ page }) => {
    // The second press comes from inside the page as soon as the browser starts the navigation
    // to OpenRouter (the Navigation API's `navigate` event): Playwright's own actions wait for a
    // pending navigation to finish.
    await page.addInitScript(() => {
      const host = window as unknown as {
        navigation?: EventTarget;
        __secondPress?: boolean;
      };
      host.navigation?.addEventListener("navigate", (event) => {
        const to = (event as unknown as { destination: { url: string } }).destination.url;
        if (!to.startsWith("https://openrouter.ai/auth") || host.__secondPress !== undefined)
          return;
        host.__secondPress = false;
        setTimeout(() => {
          pressContinue();
          host.__secondPress = true;
        }, 50);
      });
      function pressContinue() {
        [...document.querySelectorAll("button")]
          .find((each) => each.textContent === "Continue to OpenRouter")
          ?.click();
      }
    });
    const opened: URL[] = [];
    // The sign-in page takes a second to answer, then answers 204 and the page stays.
    await page.route("https://openrouter.ai/auth?**", async (route) => {
      opened.push(new URL(route.request().url()));
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.fulfill({ status: 204 }).catch(() => {});
    });
    await page.goto("/connect");
    await button(page, "Continue to OpenRouter").click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __secondPress?: boolean }).__secondPress),
      )
      .toBe(true);
    await page.waitForTimeout(1_500);
    // One sign-in opened, and the stored record is still the one its address carries.
    expect(opened).toHaveLength(1);
    const record = await page.evaluate((name) => sessionStorage.getItem(name), CONNECT_STORAGE);
    expect(JSON.parse(record ?? "{}").state).toBe(opened[0]?.searchParams.get("state"));
  });

  test("Continue to OpenRouter works again 5 s after a sign-in page that does not open", async ({
    page,
  }) => {
    const opened: string[] = [];
    // A 204 answer ends the navigation and leaves this page where it is.
    await page.route("https://openrouter.ai/auth?**", async (route) => {
      opened.push(route.request().url());
      await route.fulfill({ status: 204 });
    });
    await page.goto("/connect");
    await button(page, "Continue to OpenRouter").click();
    await expect.poll(() => opened.length).toBe(1);
    // Playwright's locators wait for that navigation to finish, which a 204 never does; the page
    // itself is idle, so it is read and pressed through the page.
    const disabled = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("button")]
            .find((each) => each.textContent === "Continue to OpenRouter")
            ?.getAttribute("aria-disabled") ?? null,
      );
    const press = () =>
      page.evaluate(() => {
        [...document.querySelectorAll("button")]
          .find((each) => each.textContent === "Continue to OpenRouter")
          ?.click();
      });
    // Until 5 s have passed the navigation may still be on its way: a press starts nothing.
    expect(await disabled()).toBe("true");
    await press();
    await page.waitForTimeout(500);
    expect(opened).toHaveLength(1);
    // The page is still here after 5 s, so the button works again.
    await expect.poll(disabled, { timeout: 10_000 }).toBeNull();
    await press();
    await expect.poll(() => opened.length).toBe(2);
    expect(new URL(page.url()).pathname).toBe("/connect");
  });
});
