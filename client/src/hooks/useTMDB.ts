import { useState, useEffect, useCallback } from "react";
import { tmdbService } from "../services/tmdbService";
import type { Movie, TVShow, TMDBResponse } from "../services/tmdbService";

interface UseMoviesReturn {
  movies: Movie[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export const usePopularMovies = (initialPage: number = 1): UseMoviesReturn => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);

  const fetchMovies = useCallback(
    async (page: number, append: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        const response: TMDBResponse<Movie> =
          await tmdbService.getPopularMovies(page);

        if (append) {
          setMovies((prev) => [...prev, ...response.results]);
        } else {
          setMovies(response.results);
        }

        setTotalPages(response.total_pages);
        setCurrentPage(page);
        setHasMore(page < response.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch movies");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchMovies(currentPage + 1, true);
    }
  }, [loading, hasMore, currentPage, fetchMovies]);

  const refresh = useCallback(() => {
    setMovies([]);
    setCurrentPage(initialPage);
    fetchMovies(initialPage, false);
  }, [initialPage, fetchMovies]);

  useEffect(() => {
    fetchMovies(initialPage);
  }, [fetchMovies, initialPage]);

  return {
    movies,
    loading,
    error,
    totalPages,
    currentPage,
    hasMore,
    loadMore,
    refresh,
  };
};

export const useTopRatedMovies = (initialPage: number = 1): UseMoviesReturn => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);

  const fetchMovies = useCallback(
    async (page: number, append: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        const response: TMDBResponse<Movie> =
          await tmdbService.getTopRatedMovies(page);

        if (append) {
          setMovies((prev) => [...prev, ...response.results]);
        } else {
          setMovies(response.results);
        }

        setTotalPages(response.total_pages);
        setCurrentPage(page);
        setHasMore(page < response.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch movies");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchMovies(currentPage + 1, true);
    }
  }, [loading, hasMore, currentPage, fetchMovies]);

  const refresh = useCallback(() => {
    setMovies([]);
    setCurrentPage(initialPage);
    fetchMovies(initialPage, false);
  }, [initialPage, fetchMovies]);

  useEffect(() => {
    fetchMovies(initialPage);
  }, [fetchMovies, initialPage]);

  return {
    movies,
    loading,
    error,
    totalPages,
    currentPage,
    hasMore,
    loadMore,
    refresh,
  };
};

interface UseTrendingReturn {
  items: (Movie | TVShow)[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const useTrending = (
  mediaType: "movie" | "tv" | "all" = "all",
  timeWindow: "day" | "week" = "week"
): UseTrendingReturn => {
  const [items, setItems] = useState<(Movie | TVShow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tmdbService.getTrending(mediaType, timeWindow);
      setItems(response.results);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch trending content"
      );
    } finally {
      setLoading(false);
    }
  }, [mediaType, timeWindow]);

  const refresh = useCallback(() => {
    fetchTrending();
  }, [fetchTrending]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return {
    items,
    loading,
    error,
    refresh,
  };
};

interface UseSearchReturn {
  results: Movie[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
  search: (query: string) => void;
  loadMore: () => void;
  clear: () => void;
}

export const useMovieSearch = (): UseSearchReturn => {
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");

  const search = useCallback(
    async (query: string, page: number = 1, append: boolean = false) => {
      if (!query.trim()) return;

      try {
        setLoading(true);
        setError(null);

        const response: TMDBResponse<Movie> = await tmdbService.searchMovies(
          query,
          page
        );

        if (append) {
          setResults((prev) => [...prev, ...response.results]);
        } else {
          setResults(response.results);
        }

        setTotalPages(response.total_pages);
        setCurrentPage(page);
        setHasMore(page < response.total_pages);
        setCurrentQuery(query);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore && currentQuery) {
      search(currentQuery, currentPage + 1, true);
    }
  }, [loading, hasMore, currentQuery, currentPage, search]);

  const clear = useCallback(() => {
    setResults([]);
    setCurrentQuery("");
    setCurrentPage(1);
    setTotalPages(0);
    setHasMore(false);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    totalPages,
    currentPage,
    hasMore,
    search: (query: string) => search(query, 1, false),
    loadMore,
    clear,
  };
};
