const { z } = require('zod');

const createFeedbackSchema = z.object({
  siteKey: z.string({ required_error: 'siteKey, rating, and comment are required' })
    .trim()
    .min(1, 'siteKey, rating, and comment are required'),
  rating: z.union([z.number(), z.string()])
    .transform(v => parseInt(v, 10))
    .refine(v => !isNaN(v) && v >= 1 && v <= 5, {
      message: 'Rating must be an integer between 1 and 5'
    }),
  comment: z.string({ required_error: 'siteKey, rating, and comment are required' })
    .trim()
    .min(1, 'siteKey, rating, and comment are required'),
  userEmail: z.string().trim().nullable().optional()
});

module.exports = {
  createFeedbackSchema
};
