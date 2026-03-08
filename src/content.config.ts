import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const events = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/events" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      eventDate: z.coerce.date().optional(),
      featuredImage: image().optional(),
      featuredImageAlt: z.string().optional(),
      pinned: z.boolean().optional().default(false),
      draft: z.boolean().optional().default(false),
    }),
});

const stories = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/stories" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      featuredImage: image().optional(),
      featuredImageAlt: z.string().optional(),
      pinned: z.boolean().optional().default(false),
      draft: z.boolean().optional().default(false),
    }),
});

const jobs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/jobs" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      department: z.string(),
      reportsTo: z.string(),
      employmentType: z.enum(["full-time", "part-time"]),
      wage: z.string(),
      ageRequirement: z.number().optional(),
      featuredImage: image().optional(),
      featuredImageAlt: z.string().optional(),
      pinned: z.boolean().optional().default(false),
      draft: z.boolean().optional().default(false),
    }),
});

export const collections = { events, stories, jobs };
