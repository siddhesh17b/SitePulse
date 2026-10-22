const { z } = require('zod');

const trackEventSchema = z.object({
  siteKey: z.string({ required_error: 'siteKey and pathname are required' })
    .trim()
    .min(1, 'siteKey and pathname are required'),
  pathname: z.string({ required_error: 'siteKey and pathname are required' })
    .trim()
    .min(1, 'siteKey and pathname are required'),
  referrer: z.string().trim().nullable().optional(),
  browser: z.string().trim().nullable().optional(),
  os: z.string().trim().nullable().optional(),
  deviceType: z.string().trim().nullable().optional()
});

module.exports = {
  trackEventSchema
};
