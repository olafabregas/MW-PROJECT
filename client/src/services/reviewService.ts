import { authService } from "./authService";

export interface UserReview {
  id: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
    badges?: string[];
  };
  movieId: number;
  movieTitle: string;
  moviePoster?: string;
  rating: number;
  title: string;
  content: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  likes: number;
  dislikes: number;
  isLikedByCurrentUser?: boolean;
  isDislikedByCurrentUser?: boolean;
}

export interface CreateReviewData {
  movieId: number;
  movieTitle: string;
  moviePoster?: string;
  rating: number;
  title: string;
  content: string;
}

export interface UpdateReviewData {
  rating?: number;
  title?: string;
  content?: string;
}

export interface ReviewsResponse {
  reviews: UserReview[];
  totalReviews: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

class ReviewService {
  private baseURL: string;

  constructor() {
    this.baseURL = "http://localhost:5000/api";
  }

  // Make authenticated request
  private async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = authService.getToken();

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseURL}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error("Authentication required. Please log in.");
    }

    return response;
  }

  // Get reviews for a movie
  async getMovieReviews(
    movieId: number,
    page: number = 1,
    limit: number = 10,
    sort: string = "createdAt",
    order: "asc" | "desc" = "desc"
  ): Promise<ReviewsResponse> {
    const params = new URLSearchParams({
      movieId: movieId.toString(),
      page: page.toString(),
      limit: limit.toString(),
      sort,
      order,
    });

    const response = await fetch(`${this.baseURL}/reviews?${params}`);

    if (!response.ok) {
      throw new Error("Failed to fetch reviews");
    }

    return response.json();
  }

  // Get user's review for a specific movie
  async getUserMovieReview(movieId: number): Promise<UserReview | null> {
    if (!authService.isAuthenticated()) {
      return null;
    }

    try {
      const response = await this.makeRequest(
        `/reviews/user-review/${movieId}`
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch user review");
      }

      return response.json();
    } catch (error) {
      console.error("Error fetching user review:", error);
      return null;
    }
  }

  // Create a new review
  async createReview(reviewData: CreateReviewData): Promise<UserReview> {
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeRequest("/reviews", {
      method: "POST",
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create review");
    }

    return response.json();
  }

  // Update an existing review
  async updateReview(
    reviewId: string,
    reviewData: UpdateReviewData
  ): Promise<UserReview> {
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeRequest(`/reviews/${reviewId}`, {
      method: "PUT",
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update review");
    }

    return response.json();
  }

  // Delete a review
  async deleteReview(reviewId: string): Promise<void> {
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeRequest(`/reviews/${reviewId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete review");
    }
  }

  // Like a review
  async likeReview(
    reviewId: string
  ): Promise<{ likes: number; isLiked: boolean }> {
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeRequest(`/reviews/${reviewId}/like`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to like review");
    }

    return response.json();
  }

  // Dislike a review
  async dislikeReview(
    reviewId: string
  ): Promise<{ dislikes: number; isDisliked: boolean }> {
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeRequest(`/reviews/${reviewId}/dislike`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to dislike review");
    }

    return response.json();
  }

  // Get user's reviews
  async getUserReviews(
    userId?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<ReviewsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (userId) {
      params.append("userId", userId);
    }

    const response = await this.makeRequest(`/reviews/user?${params}`);

    if (!response.ok) {
      throw new Error("Failed to fetch user reviews");
    }

    return response.json();
  }

  // Report a review
  async reportReview(reviewId: string, reason: string): Promise<void> {
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required");
    }

    const response = await this.makeRequest(`/reviews/${reviewId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to report review");
    }
  }
}

export const reviewService = new ReviewService();
export default reviewService;
