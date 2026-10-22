const { z } = require('zod');

const createSiteSchema = z.object({
  name: z.string({ required_error: 'Name and domain are required' })
    .trim()
    .min(1, 'Name and domain are required'),
  domain: z.string({ required_error: 'Name and domain are required' })
    .trim()
    .min(1, 'Name and domain are required')
});

const updateSiteSchema = z.object({
  name: z.string().trim().optional(),
  domain: z.string().trim().optional()
}).refine(data => Boolean((data.name && data.name.trim()) || (data.domain && data.domain.trim())), {
  message: 'At least name or domain must be provided.'
});

const deleteActionSchema = z.object({
  password: z.string({ required_error: 'Your admin account password is required to delete this website property.' })
    .min(1, 'Your admin account password is required to delete this website property.')
});

const deleteChatsSchema = z.object({
  password: z.string({ required_error: 'Your admin account password is required to delete all chats.' })
    .min(1, 'Your admin account password is required to delete all chats.')
});

module.exports = {
  createSiteSchema,
  updateSiteSchema,
  deleteActionSchema,
  deleteChatsSchema
};
