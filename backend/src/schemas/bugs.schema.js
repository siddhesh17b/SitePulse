const { z } = require('zod');

const createBugSchema = z.object({
  siteKey: z.string({ required_error: 'siteKey, title, and description are required' })
    .trim()
    .min(1, 'siteKey, title, and description are required'),
  title: z.string({ required_error: 'siteKey, title, and description are required' })
    .trim()
    .min(1, 'siteKey, title, and description are required'),
  description: z.string({ required_error: 'siteKey, title, and description are required' })
    .trim()
    .min(1, 'siteKey, title, and description are required'),
  userEmail: z.string().trim().nullable().optional(),
  url: z.string().trim().nullable().optional(),
  browser: z.string().trim().nullable().optional(),
  device: z.string().trim().nullable().optional()
});

module.exports = {
  createBugSchema
};
