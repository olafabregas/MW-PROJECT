# Olympia Movie Platform - Server

A comprehensive Node.js/Express backend for the Olympia movie platform with advanced features including analytics, monitoring, backup management, and real-time notifications.

## 🚀 Features

### Core Features

- **User Authentication & Authorization** - JWT-based auth with role-based access control
- **Movie Database Integration** - TMDb API integration for comprehensive movie data
- **Review System** - User reviews, ratings, and engagement features
- **Real-time Features** - Socket.IO for chat, notifications, and live updates
- **Admin Dashboard** - Comprehensive administrative controls and analytics

### Advanced Features

- **Analytics Service** - Real-time dashboard statistics, user analytics, and content insights
- **Health Monitoring** - System health checks, performance metrics, and alerting
- **Backup Management** - Automated and manual database backups with restore capabilities
- **Notification System** - Real-time notifications with Socket.IO integration
- **Security Middleware** - Rate limiting, request validation, and threat detection
- **Logging System** - Comprehensive logging with Winston and log rotation
- **API Documentation** - Swagger/OpenAPI 3.0 documentation
- **Error Handling** - Custom error classes and centralized error management
- **Caching** - Redis integration for improved performance

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher) - Optional but recommended
- TMDb API Key

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd MW-PROJECT/server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the server directory:

   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000
   CLIENT_URL=http://localhost:5173

   # Database
   MONGODB_URI=mongodb://localhost:27017/olympia

   # Authentication
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-refresh-token-secret
   JWT_EXPIRE=7d
   JWT_REFRESH_EXPIRE=30d

   # External APIs
   TMDB_API_KEY=your-tmdb-api-key

   # Redis (Optional)
   REDIS_URL=redis://localhost:6379

   # Email (Optional - for notifications)
   EMAIL_FROM=noreply@olympia.com
   SMTP_HOST=your-smtp-host
   SMTP_PORT=587
   SMTP_USER=your-smtp-user
   SMTP_PASS=your-smtp-password
   ```

4. **Start the server**

   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## 📊 API Documentation

The server includes comprehensive API documentation available at:

- **Swagger UI**: `http://localhost:5000/api-docs`
- **JSON Schema**: `http://localhost:5000/api-docs.json`

## 🏗️ Project Structure

```
server/
├── config/
│   └── swagger.js          # API documentation config
├── middleware/
│   ├── auth.js            # Authentication middleware
│   ├── errorHandler.js    # Error handling middleware
│   ├── security.js        # Security middleware
│   └── validation.js      # Request validation
├── models/
│   ├── User.js           # User model with auth & preferences
│   └── Review.js         # Review model with engagement
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── movies.js         # Movie data routes
│   ├── users.js          # User management routes
│   ├── reviews.js        # Review system routes
│   ├── admin.js          # Admin dashboard routes
│   ├── system.js         # System management routes
│   └── notifications.js  # Notification routes
├── services/
│   ├── analyticsService.js    # Analytics & reporting
│   ├── notificationService.js # Real-time notifications
│   ├── backupService.js       # Database backup management
│   └── healthService.js       # System health monitoring
├── utils/
│   ├── logger.js         # Winston logging configuration
│   └── cache.js          # Redis caching utilities
├── backups/              # Database backup storage
├── logs/                 # Application logs
├── package.json
└── server.js            # Main server file
```

## 🔐 Authentication & Authorization

The system implements JWT-based authentication with refresh tokens and role-based access control:

### Roles

- **user**: Standard user with basic permissions
- **moderator**: Can moderate reviews and content
- **admin**: Full system access

### Protected Routes

Most routes require authentication. Admin routes require admin role.

## 📈 Analytics & Monitoring

### Dashboard Analytics

- Real-time user statistics
- Content engagement metrics
- Platform growth trends
- Performance indicators

### Health Monitoring

- System resource monitoring (CPU, memory, disk)
- Database health checks
- External service monitoring
- Custom health checks

### Performance Metrics

- API response times
- Database query performance
- Cache hit rates
- Error rates and tracking

## 💾 Backup Management

### Automated Backups

- **Daily backups** at 2 AM
- **Weekly full backups** on Sundays at 3 AM
- **Hourly incremental backups** during business hours
- **Monthly cleanup** of old backups

### Manual Backup Operations

- Create full database backups
- Create incremental backups
- Restore from specific backups
- Validate backup integrity
- Export collections in JSON/CSV format

### Backup Features

- Compression support
- Metadata tracking
- Backup validation
- Retention policies

## 🔔 Notification System

### Real-time Notifications

- Socket.IO integration for instant delivery
- User-specific notification channels
- Broadcast notifications for system-wide announcements

### Notification Types

- Review interactions (likes, comments)
- Social features (new followers)
- Movie recommendations
- Watchlist updates
- System notifications
- Maintenance alerts

### Notification Management

- Mark as read/unread
- Delete notifications
- Bulk operations
- Expiration handling

## 🛡️ Security Features

### Security Middleware

- Rate limiting with IP blocking
- Request validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration
- Helmet security headers

### Threat Detection

- Suspicious activity monitoring
- Failed login attempt tracking
- IP-based blocking
- Request pattern analysis

## 📝 Logging

### Log Levels

- **error**: Error messages and exceptions
- **warn**: Warning messages and degraded performance
- **info**: General application information
- **debug**: Detailed debugging information

### Log Categories

- **application**: General application logs
- **security**: Security-related events
- **database**: Database operations and performance
- **audit**: User actions and system changes

### Log Management

- Daily log rotation
- Compressed archive storage
- Configurable retention periods
- Structured logging with metadata

## 🚀 Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database
3. Set up Redis for caching
4. Configure email service
5. Set up log aggregation
6. Configure monitoring alerts

### Performance Optimization

- Enable compression middleware
- Configure Redis caching
- Optimize database indexes
- Set up connection pooling
- Configure rate limiting

### Security Hardening

- Use HTTPS in production
- Configure secure headers
- Set up IP whitelisting
- Enable audit logging
- Regular security updates

## 🔧 Development Tools

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run test       # Run test suite
npm run lint       # Run ESLint
npm run backup     # Create manual backup
npm run restore    # Restore from backup
npm run docs       # Generate API documentation
```

### Debugging

- Comprehensive error logging
- Debug mode for detailed logs
- Health check endpoints
- Performance monitoring

## 📋 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset

### Movies

- `GET /api/movies/popular` - Popular movies
- `GET /api/movies/search` - Search movies
- `GET /api/movies/:id` - Movie details
- `GET /api/movies/genres` - Movie genres

### Reviews

- `GET /api/reviews` - Get reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review
- `POST /api/reviews/:id/like` - Like review

### Admin

- `GET /api/admin/users` - User management
- `GET /api/admin/reviews` - Review moderation
- `GET /api/admin/analytics` - Analytics dashboard
- `POST /api/admin/broadcast` - Send announcements

### System Management

- `GET /api/system/health/system` - System health
- `GET /api/system/analytics/dashboard` - Dashboard analytics
- `POST /api/system/backups/create` - Create backup
- `GET /api/system/backups` - List backups

### Notifications

- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `POST /api/notifications/broadcast` - Admin broadcast

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Check the API documentation at `/api-docs`
- Review the health status at `/api/health`
- Check application logs in the `logs/` directory
- Monitor system metrics via the admin dashboard

## 🔮 Future Enhancements

- Machine learning recommendations
- Advanced analytics dashboard
- Mobile app support
- Content delivery network integration
- Advanced caching strategies
- Microservices architecture migration
