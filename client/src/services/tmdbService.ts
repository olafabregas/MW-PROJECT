// TMDB API Service for OLYMPIA
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || "your_api_key_here";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

// Image size options
export const IMAGE_SIZES = {
  poster: {
    small: "/w185",
    medium: "/w342",
    large: "/w500",
    original: "/original",
  },
  backdrop: {
    small: "/w300",
    medium: "/w780",
    large: "/w1280",
    original: "/original",
  },
};

export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  original_title: string;
  popularity: number;
  video: boolean;
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  origin_country: string[];
  original_language: string;
  original_name: string;
  popularity: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MovieDetails extends Movie {
  genres: Genre[];
  runtime: number;
  budget: number;
  revenue: number;
  production_companies: Array<{
    id: number;
    name: string;
    logo_path: string | null;
  }>;
  cast?: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }>;
  videos?: {
    results: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
    }>;
  };
}

export interface TVShowDetails extends TVShow {
  genres: Genre[];
  number_of_episodes: number;
  number_of_seasons: number;
  created_by: Array<{
    id: number;
    name: string;
    profile_path: string | null;
  }>;
  cast?: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }>;
  videos?: {
    results: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
    }>;
  };
}

export interface TMDBResponse<T> {
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface SearchResult extends Movie, TVShow {
  media_type: "movie" | "tv" | "person";
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  size: number;
  published_at: string;
}

class TMDBService {
  private async fetchFromTMDB<T = unknown>(endpoint: string): Promise<T> {
    const url = `${TMDB_BASE_URL}${endpoint}${
      endpoint.includes("?") ? "&" : "?"
    }api_key=${TMDB_API_KEY}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error("TMDB API fetch error:", error);
      throw error;
    }
  }

  // Get image URL with size
  getImageUrl(
    path: string | null,
    type: "poster" | "backdrop" = "poster",
    size: "small" | "medium" | "large" | "original" = "medium"
  ): string {
    if (!path) return "/api/placeholder/300/450"; // Fallback image
    return `${TMDB_IMAGE_BASE_URL}${IMAGE_SIZES[type][size]}${path}`;
  }

  // Popular Movies
  async getPopularMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
    return this.fetchFromTMDB<TMDBResponse<Movie>>(
      `/movie/popular?page=${page}`
    );
  }

  // Top Rated Movies
  async getTopRatedMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
    return this.fetchFromTMDB<TMDBResponse<Movie>>(
      `/movie/top_rated?page=${page}`
    );
  }

  // Now Playing Movies
  async getNowPlayingMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
    return this.fetchFromTMDB<TMDBResponse<Movie>>(
      `/movie/now_playing?page=${page}`
    );
  }

  // Upcoming Movies
  async getUpcomingMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
    return this.fetchFromTMDB<TMDBResponse<Movie>>(
      `/movie/upcoming?page=${page}`
    );
  }

  // Popular TV Shows
  async getPopularTVShows(page: number = 1): Promise<TMDBResponse<TVShow>> {
    return this.fetchFromTMDB<TMDBResponse<TVShow>>(`/tv/popular?page=${page}`);
  }

  // Top Rated TV Shows
  async getTopRatedTVShows(page: number = 1): Promise<TMDBResponse<TVShow>> {
    return this.fetchFromTMDB<TMDBResponse<TVShow>>(
      `/tv/top_rated?page=${page}`
    );
  }

  // Trending (Movies & TV)
  async getTrending(
    mediaType: "movie" | "tv" | "all" = "all",
    timeWindow: "day" | "week" = "week"
  ): Promise<{ results: (Movie | TVShow)[] }> {
    return this.fetchFromTMDB<{ results: (Movie | TVShow)[] }>(
      `/trending/${mediaType}/${timeWindow}`
    );
  }

  // Movie Details
  async getMovieDetails(movieId: number): Promise<MovieDetails> {
    return this.fetchFromTMDB<MovieDetails>(
      `/movie/${movieId}?append_to_response=credits,videos,reviews`
    );
  }

  // TV Show Details
  async getTVShowDetails(tvId: number): Promise<TVShowDetails> {
    return this.fetchFromTMDB<TVShowDetails>(
      `/tv/${tvId}?append_to_response=credits,videos,reviews`
    );
  }

  // Search Movies
  async searchMovies(
    query: string,
    page: number = 1
  ): Promise<TMDBResponse<Movie>> {
    return this.fetchFromTMDB<TMDBResponse<Movie>>(
      `/search/movie?query=${encodeURIComponent(query)}&page=${page}`
    );
  }

  // Search TV Shows
  async searchTVShows(
    query: string,
    page: number = 1
  ): Promise<TMDBResponse<TVShow>> {
    return this.fetchFromTMDB<TMDBResponse<TVShow>>(
      `/search/tv?query=${encodeURIComponent(query)}&page=${page}`
    );
  }

  // Multi Search (Movies, TV Shows, People)
  async multiSearch(
    query: string,
    page: number = 1
  ): Promise<TMDBResponse<SearchResult>> {
    return this.fetchFromTMDB<TMDBResponse<SearchResult>>(
      `/search/multi?query=${encodeURIComponent(query)}&page=${page}`
    );
  }

  // Get Genres
  async getMovieGenres(): Promise<{ genres: Genre[] }> {
    return this.fetchFromTMDB<{ genres: Genre[] }>("/genre/movie/list");
  }

  async getTVGenres(): Promise<{ genres: Genre[] }> {
    return this.fetchFromTMDB<{ genres: Genre[] }>("/genre/tv/list");
  }

  // Discover Movies with filters
  async discoverMovies(params: {
    genre?: number;
    year?: number;
    sortBy?: string;
    page?: number;
    with_genres?: string;
    primary_release_year?: number;
    sort_by?: string;
  }): Promise<TMDBResponse<Movie>> {
    const queryParams = new URLSearchParams();

    // Handle both old and new parameter names for backward compatibility
    if (params.genre)
      queryParams.append("with_genres", params.genre.toString());
    if (params.with_genres)
      queryParams.append("with_genres", params.with_genres);

    if (params.year)
      queryParams.append("primary_release_year", params.year.toString());
    if (params.primary_release_year)
      queryParams.append(
        "primary_release_year",
        params.primary_release_year.toString()
      );

    if (params.sortBy) queryParams.append("sort_by", params.sortBy);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);

    if (params.page) queryParams.append("page", params.page.toString());

    return this.fetchFromTMDB<TMDBResponse<Movie>>(
      `/discover/movie?${queryParams.toString()}`
    );
  }

  // Discover TV Shows with filters
  async discoverTVShows(params: {
    genre?: number;
    year?: number;
    sortBy?: string;
    page?: number;
    with_genres?: string;
    first_air_date_year?: number;
    sort_by?: string;
  }): Promise<TMDBResponse<TVShow>> {
    const queryParams = new URLSearchParams();

    // Handle both old and new parameter names for backward compatibility
    if (params.genre)
      queryParams.append("with_genres", params.genre.toString());
    if (params.with_genres)
      queryParams.append("with_genres", params.with_genres);

    if (params.year)
      queryParams.append("first_air_date_year", params.year.toString());
    if (params.first_air_date_year)
      queryParams.append(
        "first_air_date_year",
        params.first_air_date_year.toString()
      );

    if (params.sortBy) queryParams.append("sort_by", params.sortBy);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);

    if (params.page) queryParams.append("page", params.page.toString());

    return this.fetchFromTMDB<TMDBResponse<TVShow>>(
      `/discover/tv?${queryParams.toString()}`
    );
  }

  // Get Similar Movies
  async getSimilarMovies(movieId: number): Promise<{ results: Movie[] }> {
    return this.fetchFromTMDB<{ results: Movie[] }>(
      `/movie/${movieId}/similar`
    );
  }

  // Get Recommendations
  async getMovieRecommendations(
    movieId: number
  ): Promise<{ results: Movie[] }> {
    return this.fetchFromTMDB<{ results: Movie[] }>(
      `/movie/${movieId}/recommendations`
    );
  }

  // Get Movie Videos (Trailers, etc.)
  async getMovieVideos(movieId: number): Promise<{ results: Video[] }> {
    return this.fetchFromTMDB<{ results: Video[] }>(`/movie/${movieId}/videos`);
  }

  // Get Movie Credits (Cast & Crew)
  async getMovieCredits(movieId: number): Promise<{
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  }> {
    return this.fetchFromTMDB<{
      cast: Array<{
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }>;
      crew: Array<{
        id: number;
        name: string;
        job: string;
        department: string;
        profile_path: string | null;
      }>;
    }>(`/movie/${movieId}/credits`);
  }

  // Get Movie Reviews
  async getMovieReviews(movieId: number): Promise<{
    results: Array<{
      id: string;
      author: string;
      author_details: {
        name: string;
        username: string;
        avatar_path: string | null;
        rating: number | null;
      };
      content: string;
      created_at: string;
      updated_at: string;
    }>;
  }> {
    return this.fetchFromTMDB<{
      results: Array<{
        id: string;
        author: string;
        author_details: {
          name: string;
          username: string;
          avatar_path: string | null;
          rating: number | null;
        };
        content: string;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/movie/${movieId}/reviews`);
  }
}

export const tmdbService = new TMDBService();
export default tmdbService;
