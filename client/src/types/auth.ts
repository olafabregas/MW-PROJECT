export interface User {
  id: string;
  username: string;
  email: string;
  role: "user" | "moderator" | "admin";
  avatar?: string;
  isEmailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  preferences?: {
    theme: "light" | "dark";
    emailNotifications: boolean;
    pushNotifications: boolean;
    language: string;
  };
  badges?: string[];
  stats?: {
    totalReviews: number;
    totalLikes: number;
    moviesWatched: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  message?: string;
}

export interface TokenPayload {
  userId: string;
  username?: string;
  email?: string;
  role?: string;
  avatar?: string;
  isEmailVerified?: boolean;
  iat: number;
  exp: number;
}

export interface AuthError {
  message: string;
  field?: string;
  code?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
