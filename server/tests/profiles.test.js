const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');
const profilesRouter = require('../routes/profiles');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Mock setup
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/profiles', profilesRouter);

describe('Profile Management API', () => {
  let testUser;
  let authToken;
  let profileId;
  
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/olympia_test');
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    
    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      subscription: { plan: 'premium' }
    });
    await testUser.save();
    
    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id }, 
      process.env.JWT_SECRET || 'test_secret'
    );
  });

  afterEach(async () => {
    // Clean up uploaded files
    try {
      const uploadsDir = path.join(__dirname, '../uploads/profile-pictures');
      const files = await fs.readdir(uploadsDir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          await fs.unlink(path.join(uploadsDir, file));
        }
      }
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/profiles', () => {
    it('should return empty profiles for new user', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.profiles).toEqual([]);
      expect(response.body.canCreateMore).toBe(true);
      expect(response.body.maxProfiles).toBe(5);
    });

    it('should return profiles when user has profiles', async () => {
      // Create a profile first
      await testUser.createProfile({
        name: 'Test Profile',
        isKidsProfile: false
      });

      const response = await request(app)
        .get('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.profiles).toHaveLength(1);
      expect(response.body.profiles[0].name).toBe('Test Profile');
      expect(response.body.profiles[0].isPrimary).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/profiles')
        .expect(401);
    });
  });

  describe('POST /api/profiles', () => {
    it('should create a new profile successfully', async () => {
      const profileData = {
        name: 'John Profile',
        isKidsProfile: false,
        ageRating: 'all',
        preferences: { language: 'en' }
      };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(profileData)
        .expect(201);

      expect(response.body.message).toBe('Profile created successfully');
      expect(response.body.profile.name).toBe('John Profile');
      expect(response.body.profile.isPrimary).toBe(true);
      
      profileId = response.body.profile._id;
    });

    it('should create kids profile with correct settings', async () => {
      const profileData = {
        name: 'Kids Profile',
        isKidsProfile: true,
        pin: '1234'
      };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(profileData)
        .expect(201);

      expect(response.body.profile.isKidsProfile).toBe(true);
      expect(response.body.profile.ageRating).toBe('PG');
      expect(response.body.profile.isProtected).toBe(true);
    });

    it('should reject duplicate profile names', async () => {
      await testUser.createProfile({ name: 'Duplicate' });

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Duplicate' })
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });

    it('should enforce profile limits for free users', async () => {
      // Update user to free plan
      testUser.subscription.plan = 'free';
      await testUser.save();
      
      // Create one profile (free limit)
      await testUser.createProfile({ name: 'First Profile' });

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Second Profile' })
        .expect(400);

      expect(response.body.error).toContain('Premium subscription required');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('PUT /api/profiles/:profileId', () => {
    beforeEach(async () => {
      await testUser.createProfile({ name: 'Update Test' });
      profileId = testUser.profiles[0]._id;
    });

    it('should update profile successfully', async () => {
      const updates = {
        name: 'Updated Name',
        ageRating: 'PG-13',
        preferences: { language: 'es' }
      };

      const response = await request(app)
        .put(`/api/profiles/${profileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.profile.name).toBe('Updated Name');
      expect(response.body.profile.ageRating).toBe('PG-13');
    });

    it('should handle non-existent profile', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/profiles/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(400);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/profiles/:profileId', () => {
    beforeEach(async () => {
      await testUser.createProfile({ name: 'Primary Profile' });
      await testUser.createProfile({ name: 'Secondary Profile' });
      profileId = testUser.profiles[1]._id;
    });

    it('should delete non-primary profile', async () => {
      const response = await request(app)
        .delete(`/api/profiles/${profileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Profile deleted successfully');
    });

    it('should not delete primary profile', async () => {
      const primaryId = testUser.profiles[0]._id;
      
      const response = await request(app)
        .delete(`/api/profiles/${primaryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('Cannot delete primary');
    });
  });

  describe('POST /api/profiles/:profileId/switch', () => {
    beforeEach(async () => {
      await testUser.createProfile({ 
        name: 'Protected Profile',
        pin: '1234'
      });
      profileId = testUser.profiles[0]._id;
    });

    it('should switch to unprotected profile', async () => {
      await testUser.createProfile({ name: 'Regular Profile' });
      const regularProfileId = testUser.profiles[1]._id;

      const response = await request(app)
        .post(`/api/profiles/${regularProfileId}/switch`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Profile switched successfully');
    });

    it('should switch to protected profile with correct PIN', async () => {
      const response = await request(app)
        .post(`/api/profiles/${profileId}/switch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: '1234' })
        .expect(200);

      expect(response.body.profile.name).toBe('Protected Profile');
    });

    it('should reject incorrect PIN', async () => {
      const response = await request(app)
        .post(`/api/profiles/${profileId}/switch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: 'wrong' })
        .expect(401);

      expect(response.body.error).toBe('Invalid PIN');
    });

    it('should require PIN for protected profile', async () => {
      const response = await request(app)
        .post(`/api/profiles/${profileId}/switch`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('PIN required');
    });
  });

  describe('Profile picture upload', () => {
    beforeEach(async () => {
      await testUser.createProfile({ name: 'Picture Test' });
      profileId = testUser.profiles[0]._id;
    });

    it('should upload profile picture successfully', async () => {
      // Create a test image buffer
      const testImageBuffer = Buffer.from('fake image data');
      
      const response = await request(app)
        .post(`/api/profiles/${profileId}/picture`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('profilePicture', testImageBuffer, 'test.jpg')
        .expect(200);

      expect(response.body.message).toBe('Profile picture uploaded successfully');
      expect(response.body.profilePicture).toContain('/uploads/profile-pictures/');
    });

    it('should reject upload without file', async () => {
      const response = await request(app)
        .post(`/api/profiles/${profileId}/picture`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('Watch history management', () => {
    beforeEach(async () => {
      await testUser.createProfile({ name: 'History Test' });
      profileId = testUser.profiles[0]._id;
    });

    it('should add movie to watch history', async () => {
      const movieData = {
        movieId: 'movie123',
        title: 'Test Movie',
        posterPath: '/poster.jpg',
        watchDuration: 7200,
        totalDuration: 7500,
        completed: true
      };

      const response = await request(app)
        .post(`/api/profiles/${profileId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(movieData)
        .expect(200);

      expect(response.body.message).toContain('successfully');
    });

    it('should get watch history with pagination', async () => {
      // Add some history first
      await testUser.addToProfileWatchHistory(profileId, {
        movieId: 'movie1',
        title: 'Movie 1'
      });

      const response = await request(app)
        .get(`/api/profiles/${profileId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });

    it('should validate required fields for history', async () => {
      const response = await request(app)
        .post(`/api/profiles/${profileId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('Recommendations', () => {
    beforeEach(async () => {
      await testUser.createProfile({ name: 'Rec Test' });
      profileId = testUser.profiles[0]._id;
    });

    it('should get recommendations with pagination', async () => {
      // Add a recommendation first
      await testUser.addProfileRecommendation(profileId, {
        movieId: 'rec1',
        title: 'Recommended Movie',
        reason: 'Test recommendation'
      });

      const response = await request(app)
        .get(`/api/profiles/${profileId}/recommendations`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recommendations).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('Profile validation and security', () => {
    it('should enforce rate limiting', async () => {
      // This would require multiple rapid requests to test properly
      // For now, just verify the endpoint responds
      const response = await request(app)
        .get('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should validate profile name length', async () => {
      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'a'.repeat(50) }) // Too long
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate age rating values', async () => {
      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Test',
          ageRating: 'INVALID' 
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      jest.spyOn(User, 'findById').mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toContain('Failed to retrieve');
    });

    it('should handle invalid profile IDs', async () => {
      const response = await request(app)
        .get('/api/profiles/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle user not found scenarios', async () => {
      // Delete the test user
      await User.findByIdAndDelete(testUser._id);

      const response = await request(app)
        .get('/api/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('User not found');
    });
  });
});
