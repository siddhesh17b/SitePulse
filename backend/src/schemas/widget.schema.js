const { z } = require('zod');

const updateConfigSchema = z.object({
  siteKey: z.string({ required_error: 'Missing siteKey or settings' })
    .trim()
    .min(1, 'Missing siteKey or settings'),
  settings: z.record(z.any(), { required_error: 'Missing siteKey or settings' })
});

module.exports = {
  updateConfigSchema
};
