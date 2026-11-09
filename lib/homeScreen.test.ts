import { needsHomeScreen, type DeviceFacts } from "./homeScreen";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";
const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

const tab = (userAgent: string, maxTouchPoints = 5): DeviceFacts => ({
  userAgent,
  maxTouchPoints,
  standalone: false,
  hasNotification: false,
});

describe("needsHomeScreen", () => {
  it("asks an iPhone in a browser tab", () => {
    expect(needsHomeScreen(tab(iphone))).toBe(true);
  });

  it("asks an iPad that reports itself as a Mac", () => {
    expect(needsHomeScreen(tab(ipad))).toBe(true);
  });

  it("leaves a real Mac alone", () => {
    expect(needsHomeScreen({ ...tab(ipad, 0), hasNotification: true })).toBe(false);
    expect(needsHomeScreen(tab(ipad, 0))).toBe(false);
  });

  it("leaves an iPhone already opened from the Home Screen alone", () => {
    expect(needsHomeScreen({ ...tab(iphone), standalone: true, hasNotification: true })).toBe(false);
  });

  it("leaves Android alone", () => {
    expect(needsHomeScreen(tab(android))).toBe(false);
  });
});
