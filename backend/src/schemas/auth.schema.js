const { z } = require('zod');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signupSchema = z.object({
  name: z.string({ required_error: 'Name, email, and password are required' })
    .trim()
    .min(2, 'Name must be between 2 and 100 characters')
    .max(100, 'Name must be between 2 and 100 characters'),
  email: z.string({ required_error: 'Name, email, and password are required' })
    .trim()
    .toLowerCase()
    .regex(EMAIL_REGEX, 'Please enter a valid email address'),
  password: z.string({ required_error: 'Name, email, and password are required' })
    .min(8, 'Password must be between 8 and 128 characters long')
    .max(128, 'Password must be between 8 and 128 characters long'),
  confirmPassword: z.string().optional()
}).refine((data) => {
  if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
    return false;
  }
  return true;
}, {
  message: 'Passwords do not match. Please retype your password.',
  path: ['confirmPassword']
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Email and password are required' })
    .trim()
    .min(1, 'Email and password are required'),
  password: z.string({ required_error: 'Email and password are required' })
    .min(1, 'Email and password are required')
});

module.exports = {
  signupSchema,
  loginSchema
};
