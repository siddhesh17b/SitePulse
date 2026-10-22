/**
 * Reusable Zod Validation Middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const errorMessage = firstIssue ? firstIssue.message : 'Invalid request body';
      return res.status(400).json({
        error: errorMessage,
        errors: result.error.flatten().fieldErrors
      });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const errorMessage = firstIssue ? firstIssue.message : 'Invalid query parameters';
      return res.status(400).json({
        error: errorMessage,
        errors: result.error.flatten().fieldErrors
      });
    }
    req.query = result.data;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const errorMessage = firstIssue ? firstIssue.message : 'Invalid URL parameters';
      return res.status(400).json({
        error: errorMessage,
        errors: result.error.flatten().fieldErrors
      });
    }
    req.params = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams
};
