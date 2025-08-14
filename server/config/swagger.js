const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Olympia Movie API",
      version: "1.0.0",
      description: `
        Olympia is a comprehensive movie discovery and review platform API built with Node.js, Express, and MongoDB.
        
        ## Features
        - User authentication and authorization
        - Movie data from TMDb API
        - User reviews and ratings
        - Watchlists and favorites
        - Admin dashboard and moderation
        - Real-time features with Socket.IO
        - Advanced caching and security
        
        ## Authentication
        The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-token>\`
        
        ## Rate Limiting
        Different endpoints have different rate limits:
        - General API: 100 requests per 15 minutes
        - Authentication: 5 attempts per 15 minutes
        - Search: 30 requests per minute
        - Reviews: 10 creations per hour
        
        ## Error Handling
        All endpoints return consistent error responses with the following structure:
        \`\`\`json
        {
          "success": false,
          "message": "Error description",
          "errors": [] // Optional validation errors
        }
        \`\`\`
      `,
      contact: {
        name: "Olympia API Support",
        email: "support@olympia.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:5000",
        description: "Development server",
      },
      {
        url: "https://api.olympia.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "User unique identifier",
            },
            username: {
              type: "string",
              description: "Username (3-30 characters, alphanumeric)",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            avatar: {
              type: "string",
              description: "User avatar URL",
            },
            role: {
              type: "string",
              enum: ["user", "moderator", "admin"],
              description: "User role",
            },
            preferences: {
              type: "object",
              properties: {
                darkMode: { type: "boolean" },
                language: { type: "string" },
                notifications: {
                  type: "object",
                  properties: {
                    email: { type: "boolean" },
                    push: { type: "boolean" },
                  },
                },
              },
            },
            stats: {
              type: "object",
              properties: {
                totalMoviesWatched: { type: "number" },
                totalReviews: { type: "number" },
                totalWatchTime: { type: "number" },
                favoriteGenres: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Movie: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "TMDb movie ID",
            },
            title: {
              type: "string",
              description: "Movie title",
            },
            overview: {
              type: "string",
              description: "Movie overview/plot",
            },
            poster_path: {
              type: "string",
              description: "Poster image path",
            },
            backdrop_path: {
              type: "string",
              description: "Backdrop image path",
            },
            release_date: {
              type: "string",
              format: "date",
              description: "Release date",
            },
            vote_average: {
              type: "number",
              description: "Average rating",
            },
            vote_count: {
              type: "number",
              description: "Number of votes",
            },
            genre_ids: {
              type: "array",
              items: { type: "number" },
              description: "Genre IDs",
            },
            adult: {
              type: "boolean",
              description: "Adult content flag",
            },
            original_language: {
              type: "string",
              description: "Original language",
            },
            popularity: {
              type: "number",
              description: "Popularity score",
            },
          },
        },
        Review: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Review unique identifier",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
            movieId: {
              type: "number",
              description: "TMDb movie ID",
            },
            movieTitle: {
              type: "string",
              description: "Movie title",
            },
            moviePoster: {
              type: "string",
              description: "Movie poster URL",
            },
            rating: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "User rating (1-5 stars)",
            },
            title: {
              type: "string",
              description: "Review title",
            },
            content: {
              type: "string",
              description: "Review content",
            },
            spoilerWarning: {
              type: "boolean",
              description: "Contains spoilers flag",
            },
            isApproved: {
              type: "boolean",
              description: "Moderation approval status",
            },
            likes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: { type: "string" },
                  likedAt: { type: "string", format: "date-time" },
                },
              },
            },
            dislikes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: { type: "string" },
                  dislikedAt: { type: "string", format: "date-time" },
                },
              },
            },
            comments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: { $ref: "#/components/schemas/User" },
                  content: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              description: "Error message",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                  value: { type: "string" },
                },
              },
              description: "Validation errors (if applicable)",
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              description: "Success message",
            },
            data: {
              type: "object",
              description: "Response data",
            },
          },
        },
        PaginationResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "array",
              items: { type: "object" },
            },
            pagination: {
              type: "object",
              properties: {
                currentPage: { type: "number" },
                totalPages: { type: "number" },
                totalItems: { type: "number" },
                hasNextPage: { type: "boolean" },
                hasPrevPage: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Authentication token is required or invalid",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                message: "Authentication token required",
              },
            },
          },
        },
        ForbiddenError: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                message: "Insufficient permissions",
              },
            },
          },
        },
        ValidationError: {
          description: "Input validation failed",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                message: "Validation failed",
                errors: [
                  {
                    field: "email",
                    message: "Please provide a valid email",
                    value: "invalid-email",
                  },
                ],
              },
            },
          },
        },
        NotFoundError: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                message: "Resource not found",
              },
            },
          },
        },
        RateLimitError: {
          description: "Rate limit exceeded",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                message: "Too many requests, please try again later",
                retryAfter: 900,
              },
            },
          },
        },
        ServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Error",
              },
              example: {
                success: false,
                message: "Internal server error",
              },
            },
          },
        },
      },
      parameters: {
        PageParam: {
          name: "page",
          in: "query",
          description: "Page number for pagination",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
        },
        LimitParam: {
          name: "limit",
          in: "query",
          description: "Number of items per page",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        SortParam: {
          name: "sort",
          in: "query",
          description: "Sort field",
          required: false,
          schema: {
            type: "string",
            enum: ["createdAt", "updatedAt", "rating", "title"],
            default: "createdAt",
          },
        },
        OrderParam: {
          name: "order",
          in: "query",
          description: "Sort order",
          required: false,
          schema: {
            type: "string",
            enum: ["asc", "desc"],
            default: "desc",
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization",
      },
      {
        name: "Movies",
        description: "Movie data and search (TMDb API)",
      },
      {
        name: "Users",
        description: "User profile and preferences management",
      },
      {
        name: "Reviews",
        description: "Movie reviews and ratings",
      },
      {
        name: "Watchlist",
        description: "User watchlist management",
      },
      {
        name: "Favorites",
        description: "User favorites management",
      },
      {
        name: "Admin",
        description: "Administrative functions and moderation",
      },
      {
        name: "Analytics",
        description: "Platform analytics and statistics",
      },
    ],
  },
  apis: ["./routes/*.js", "./models/*.js", "./server.js"], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info .title { color: #4169E1; }
  .swagger-ui .scheme-container { background: #1A1A1A; }
  .swagger-ui .info .description { color: #DCDCDC; }
  .swagger-ui .info { margin-bottom: 30px; }
  .swagger-ui .auth-wrapper { margin-top: 20px; }
  .swagger-ui .btn.authorize { background-color: #FFD700; color: #1A1A1A; }
  .swagger-ui .btn.authorize:hover { background-color: #9966CC; }
`;

const swaggerOptions = {
  customCss,
  customSiteTitle: "Olympia API Documentation",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: "none",
    filter: true,
    showRequestHeaders: true,
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    tryItOutEnabled: true,
  },
};

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions,
};
