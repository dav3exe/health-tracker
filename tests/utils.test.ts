import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps our custom font size alongside a colour", () => {
    expect(cn("text-body text-primary")).toBe("text-body text-primary");
  });

  it("lets a later custom font size override an earlier one", () => {
    expect(cn("text-label", "text-hero")).toBe("text-hero");
  });
});
