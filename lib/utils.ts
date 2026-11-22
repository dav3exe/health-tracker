import { createCn } from "cn/config";

// `cn` merges Tailwind classes so a component's defaults can be overridden
// (e.g. <Button className="text-hero">). shadcn/ui components rely on it.
//
// Why the custom config: the merger only knows Tailwind's built-in sizes. Our
// type scale (text-body, text-label, …) looked like COLOURS to it, so
// cn("text-body text-primary") silently dropped text-body and the text shrank
// back to 16px. Registering our sizes as font sizes fixes that.
// tests/utils.test.ts guards it.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["small", "label", "body", "title", "reading", "hero"] },
      ],
    },
  },
});
