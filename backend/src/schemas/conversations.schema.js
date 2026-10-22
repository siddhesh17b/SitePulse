const { z } = require('zod');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initConversationSchema = z.object({
  siteKey: z.string({ required_error: 'siteKey and visitorId are required' })
    .trim()
    .min(1, 'siteKey and visitorId are required'),
  visitorId: z.string({ required_error: 'siteKey and visitorId are required' })
    .trim()
    .min(1, 'siteKey and visitorId are required'),
  visitorEmail: z.string({ required_error: 'Email address is required to start a conversation.' })
    .trim()
    .min(1, 'Email address is required to start a conversation.')
    .regex(EMAIL_REGEX, 'Please enter a valid email address.'),
  visitorName: z.string().trim().nullable().optional(),
  externalId: z.union([z.string(), z.number()]).transform(v => String(v).trim()).nullable().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'pending'], {
    errorMap: () => ({ message: 'Status must be open, resolved, or pending' })
  })
});

module.exports = {
  initConversationSchema,
  updateStatusSchema
};
