import type {
  User,
  LoginCredentials,
  RegisterCredentials,
} from "../types/auth";

class AuthService {
  private baseURL: string;
  private tokenKey = "auth_token";
  private refreshTokenKey = "refresh_token";

  constructor() {
    this.baseURL = "http://localhost:5000/api";
  }

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Get stored refresh token
  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  // Store tokens
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.tokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  // Clear stored tokens
  clearTokens(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // Get current user from token
  getCurrentUser(): User | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        id: payload.userId,
        username: payload.username || "",
        email: payload.email || "",
        role: payload.role || "user",
        avatar: payload.avatar || "",
        isEmailVerified: payload.isEmailVerified || false,
      };
    } catch {
      return null;
    }
  }

  // Make authenticated request
  private async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = this.getToken();

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      console.log(`Making request to: ${this.baseURL}${url}`);

      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers,
      });

      console.log(`Response status: ${response.status}`);

      // Handle token expiration
      if (response.status === 401 && token) {
        console.log("Token expired, attempting refresh...");
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry with new token
          const newToken = this.getToken();
          return fetch(`${this.baseURL}${url}`, {
            ...options,
            headers: {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
        } else {
          // Refresh failed, logout user
          this.logout();
          throw new Error("Session expired. Please log in again.");
        }
      }

      return response;
    } catch (error) {
      console.error(`Request failed for ${this.baseURL}${url}:`, error);
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to server. Please check if the server is running on http://localhost:5000"
        );
      }
      throw error;
    }
  }

  // Refresh access token
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
        return true;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }

    return false;
  }

  // Register new user
  async register(
    userData: RegisterCredentials
  ): Promise<{ user: User; accessToken: string }> {
    try {
      console.log("Attempting to register user...");

      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      console.log(`Register response status: ${response.status}`);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Registration failed" }));
        // If backend sent validation errors, join them into a single string
        if (error.errors && Array.isArray(error.errors)) {
          const messages = error.errors
            .map((e: any) => e.msg || e.message)
            .join("\n");
          throw new Error(messages || error.message || "Registration failed");
        }
        throw new Error(error.message || "Registration failed");
      }

      const data = await response.json();
      console.log("Registration successful");

      // Store tokens
      this.setTokens(data.tokens.accessToken, data.tokens.refreshToken);

      return {
        user: data.user,
        accessToken: data.tokens.accessToken,
      };
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to server. Please check if the server is running on http://localhost:5000"
        );
      }
      throw error;
    }
  }

  // Login user
  async login(
    credentials: LoginCredentials
  ): Promise<{ user: User; accessToken: string }> {
    try {
      console.log("Attempting to login user...");

      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      console.log(`Login response status: ${response.status}`);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Login failed" }));
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      console.log("Login successful");

      // Store tokens
      this.setTokens(data.tokens.accessToken, data.tokens.refreshToken);

      return {
        user: data.user,
        accessToken: data.tokens.accessToken,
      };
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to server. Please check if the server is running on http://localhost:5000"
        );
      }
      throw error;
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      await this.makeRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.clearTokens();
    }
  }

  // Get user profile
  async getProfile(): Promise<User> {
    const response = await this.makeRequest("/auth/me");

    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }

    const data = await response.json();
    return data.user;
  }

  // Update user profile
  async updateProfile(profileData: Partial<User>): Promise<User> {
    const response = await this.makeRequest("/users/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error("Failed to update profile");
    }

    const data = await response.json();
    return data.user;
  }

  // Change password
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const response = await this.makeRequest("/users/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to change password");
    }
  }
}

export const authService = new AuthService();
export default authService;
