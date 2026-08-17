import { describe, it, expect } from "vitest";
import { GET } from "./route";

const request = new Request("http://localhost/icons/192");

/**
 * Only the allowlisted sizes rasterise. Anything else must 404 rather than let
 * a crawler make us render arbitrary dimensions on demand.
 */
describe("GET /icons/[size]", () => {
  it.each(["192", "512"])("serves %s as a PNG", async (size) => {
    const response = await GET(request, { params: Promise.resolve({ size }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it.each([
    ["999", "an unlisted numeric size"],
    ["64", "a plausible but unlisted icon size"],
    ["192x192", "the manifest's sizes syntax"],
    ["", "an empty segment"],
    ["../192", "a traversal attempt"],
    ["192.png", "a file extension"],
    [" 192", "leading whitespace"],
  ])("404s on %j (%s)", async (size) => {
    const response = await GET(request, { params: Promise.resolve({ size }) });

    expect(response.status).toBe(404);
  });
});
