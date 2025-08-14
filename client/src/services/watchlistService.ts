import { authService } from "./authService";

export interface WatchlistItem {
  id: number;
  type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
  dateAdded: string;
}

class WatchlistService {
  private baseURL = "http://localhost:5000/api/watchlist";

  async getWatchlist(): Promise<WatchlistItem[]> {
    const token = authService.getToken();
    const res = await fetch(this.baseURL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch watchlist");
    const data = await res.json();
    return data.watchlist || [];
  }
}

export const watchlistService = new WatchlistService();
