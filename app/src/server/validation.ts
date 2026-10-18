import { z } from "zod";

export const createPageSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  title: z.string().max(500).optional(),
  icon: z.string().max(16).nullable().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().max(500).optional(),
  icon: z.string().max(16).nullable().optional(),
  isFavorite: z.boolean().optional(),
  parentId: z.uuid().nullable().optional(),
  position: z.number().finite().optional(),
  content: z.array(z.unknown()).optional(),
});
