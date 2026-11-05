import { handoffConfig, handoffInitScript, runHandoff, type HandoffConfig, type HandoffWindow } from "./handoff";

const config: HandoffConfig = { site: "https://lessqueues.com", legacyHosts: ["qless-indol.vercel.app"] };

function fakeWindow(url: string, referrer = ""): HandoffWindow & { clicked: HTMLAnchorElement[]; replaced: string[] } {
  const parsed = new URL(url);
  const clicked: HTMLAnchorElement[] = [];
  const replaced: string[] = [];
  // Live, like the browser's: replacing the URL drops the fragment at once.
  const location = { hostname: parsed.hostname, pathname: parsed.pathname, search: parsed.search, hash: parsed.hash };
  return {
    location,
    localStorage: window.localStorage,
    document: {
      referrer,
      createElement: () => {
        const link = document.createElement("a");
        link.click = () => clicked.push(link);
        return link;
      },
    },
    history: {
      replaceState: (_data, _unused, next) => {
        replaced.push(next);
        location.hash = "";
      },
    },
    clicked,
    replaced,
  };
}

function handOver(): string {
  const old = fakeWindow("https://qless-indol.vercel.app/q/ade-s-barbershop?x=1");
  runHandoff(config, old);
  return old.clicked[0].href;
}

beforeEach(() => window.localStorage.clear());

describe("on an old address", () => {
  it("moves to the same path on the new one, carrying only this site's entries, sending only its origin", () => {
    window.localStorage.setItem("qless.session.token", "tok");
    window.localStorage.setItem("other.app", "keep out");
    const old = fakeWindow("https://qless-indol.vercel.app/q/ade-s-barbershop?x=1");

    runHandoff(config, old);

    const link = old.clicked[0];
    expect(link.href.startsWith("https://lessqueues.com/q/ade-s-barbershop?x=1#qless-handoff=")).toBe(true);
    expect(link.referrerPolicy).toBe("origin");
    const carried = JSON.parse(decodeURIComponent(link.href.split("#qless-handoff=")[1]));
    expect(carried).toEqual({ "qless.session.token": "tok" });
  });

  it("still moves on, with no fragment, when there is nothing to carry", () => {
    expect(handOver()).toBe("https://lessqueues.com/q/ade-s-barbershop?x=1");
  });
});

describe("on the new address", () => {
  function arrive(href: string, referrer: string): ReturnType<typeof fakeWindow> {
    window.localStorage.clear();
    const win = fakeWindow(href, referrer);
    runHandoff(config, win);
    return win;
  }

  it("stores what arrived from an old address and wipes the fragment", () => {
    window.localStorage.setItem("qless.customer.ade-s-barbershop", "ticket");
    const href = handOver();

    const win = arrive(href, "https://qless-indol.vercel.app/");

    expect(window.localStorage.getItem("qless.customer.ade-s-barbershop")).toBe("ticket");
    expect(win.replaced).toEqual(["/q/ade-s-barbershop?x=1"]);
  });

  it("never overwrites what the new address already holds", () => {
    window.localStorage.setItem("qless.session.token", "old");
    const href = handOver();
    window.localStorage.clear();
    window.localStorage.setItem("qless.session.token", "current");
    runHandoff(config, fakeWindow(href, "https://qless-indol.vercel.app/"));

    expect(window.localStorage.getItem("qless.session.token")).toBe("current");
  });

  it("keeps a session whole: an existing sign-in takes no role from the old one", () => {
    window.localStorage.setItem("qless.session.token", "old");
    window.localStorage.setItem("qless.session.role", "OWNER");
    window.localStorage.setItem("qless.customer.shop", "ticket");
    const href = handOver();
    window.localStorage.clear();
    window.localStorage.setItem("qless.session.token", "current");
    runHandoff(config, fakeWindow(href, "https://qless-indol.vercel.app/"));

    expect(window.localStorage.getItem("qless.session.role")).toBeNull();
    expect(window.localStorage.getItem("qless.customer.shop")).toBe("ticket");
  });

  it("refuses a crafted link that did not come from an old address, and still wipes it", () => {
    const planted = encodeURIComponent(JSON.stringify({ "qless.session.token": "attacker" }));

    for (const referrer of ["", "https://evil.test/", "https://lessqueues.com/"]) {
      const win = arrive(`https://lessqueues.com/#qless-handoff=${planted}`, referrer);
      expect(window.localStorage.getItem("qless.session.token")).toBeNull();
      expect(win.replaced).toEqual(["/"]);
    }
  });

  it("only ever writes this site's keys, and only strings", () => {
    const sneaky = encodeURIComponent(JSON.stringify({ "other.app": "x", "qless.theme": 5 }));
    arrive(`https://lessqueues.com/#qless-handoff=${sneaky}`, "https://qless-indol.vercel.app/");

    expect(window.localStorage.length).toBe(0);
  });

  it("does nothing without a handoff fragment", () => {
    const win = arrive("https://lessqueues.com/q/x#top", "https://qless-indol.vercel.app/");
    expect(win.replaced).toEqual([]);
  });
});

describe("configuration", () => {
  it("is off unless both the site and an old host are set", () => {
    expect(handoffConfig(undefined, "a.test")).toBeNull();
    expect(handoffConfig("https://lessqueues.com", " , ")).toBeNull();
    expect(handoffConfig("https://lessqueues.com/", "a.test, b.test")).toEqual({
      site: "https://lessqueues.com",
      legacyHosts: ["a.test", "b.test"],
    });
  });

  it("inlines a script that runs on its own", () => {
    window.localStorage.setItem("qless.theme", "dark");
    const script = handoffInitScript({ site: "https://lessqueues.com", legacyHosts: ["localhost"] });
    const clicked: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.href);
    });

    new Function(script)();

    click.mockRestore();
    expect(clicked[0]).toMatch(/^https:\/\/lessqueues\.com\/#qless-handoff=/);
  });
});
