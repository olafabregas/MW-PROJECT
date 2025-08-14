const {
  body,
  param,
  query,
  validationResult,
  checkSchema,
} = require("express-validator");
const xss = require("xss");
const DOMPurify = require("isomorphic-dompurify");

// Common validation rules
const commonValidations = {
  // User validations
  username: body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage(
      "Username can only contain letters, numbers, dots, hyphens, and underscores"
    )
    .custom((value) => {
      // Check for reserved usernames
      const reserved = [
        "admin",
        "root",
        "system",
        "api",
        "www",
        "mail",
        "support",
      ];
      if (reserved.includes(value.toLowerCase())) {
        throw new Error("Username is reserved");
      }
      return true;
    }),

  email: body("email")
    .isEmail()
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
    })
    .withMessage("Please provide a valid email address")
    .isLength({ max: 254 })
    .withMessage("Email is too long"),

  password: body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  // Content validations
  reviewTitle: body("title")
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage("Review title must be between 5 and 100 characters")
    .custom((value) => {
      const sanitized = xss(value);
      if (sanitized !== value) {
        throw new Error("Title contains invalid characters");
      }
      return true;
    }),

  reviewContent: body("content")
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Review content must be between 10 and 5000 characters")
    .custom((value) => {
      const sanitized = DOMPurify.sanitize(value);
      if (sanitized.length !== value.length) {
        throw new Error("Content contains invalid HTML");
      }
      return true;
    }),

  rating: body("rating")
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5")
    .toFloat(),

  movieId: body("movieId")
    .isInt({ min: 1, max: 999999999 })
    .withMessage("Invalid movie ID")
    .toInt(),

  // Pagination validations
  page: query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Page must be between 1 and 1000")
    .toInt(),

  limit: query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  // MongoDB ObjectId validation
  objectId: param("id").isMongoId().withMessage("Invalid ID format"),

  // Search validation
  searchQuery: query("query")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters")
    .escape(),
};

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formattedErrors,
    });
  }

  next();
};

// Content sanitization middleware
const sanitizeContent = (req, res, next) => {
  // Sanitize text fields
  const textFields = ["title", "content", "description", "bio", "username"];

  textFields.forEach((field) => {
    if (req.body[field]) {
      req.body[field] = xss(req.body[field]);
    }
  });

  // Sanitize HTML fields
  const htmlFields = ["content", "description"];

  htmlFields.forEach((field) => {
    if (req.body[field]) {
      req.body[field] = DOMPurify.sanitize(req.body[field], {
        ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
        ALLOWED_ATTR: [],
      });
    }
  });

  next();
};

// Schema-based validation function
const validation = (schema) => {
  return [checkSchema(schema), validateRequest];
};

module.exports = {
  ...commonValidations,
  validateRequest,
  sanitizeContent,
  validation,
};
