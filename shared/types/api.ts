import { UserRole, Permission, BookFormat, ApiScope, ReadStatus } from './enums';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    role: UserRole;
    display_name: string | null;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
  display_name?: string;
}

export interface UpdateUserRequest {
  role?: UserRole;
  display_name?: string;
  password?: string;
}

export interface CreateLibraryRequest {
  name: string;
  paths: string[];
  scan_schedule?: string;
}

export interface UpdateLibraryRequest {
  name?: string;
  paths?: string[];
  scan_schedule?: string;
}

export interface SetPermissionRequest {
  user_id: number;
  permission: Permission;
}

export interface BooksQuery {
  library_id?: number;
  format?: BookFormat;
  page?: number;
  limit?: number;
  sort?: 'title' | 'author' | 'created_at' | 'last_read';
  order?: 'asc' | 'desc';
}

export interface SearchQuery {
  q?: string;
  library_id?: number;
  format?: BookFormat;
  author?: string;
  rating_min?: number;
  rating_max?: number;
  tags?: string;
  read_status?: ReadStatus;
  sort?: 'relevance' | 'title' | 'author' | 'rating' | 'last_read';
  page?: number;
  limit?: number;
}

export interface SaveProgressRequest {
  position: string;
  percentage: number;
  version?: number;
  device_id?: string;
  finished?: boolean;
  last_read_at?: string;
}

export interface BatchSyncRequest {
  items: Array<{
    book_id: number;
    position: string;
    percentage: number;
    version: number;
    device_id?: string;
    finished?: boolean;
    last_read_at?: string;
    idempotency_key: string;
  }>;
}

export interface SyncResponse {
  accepted: boolean;
  conflict?: boolean;
  server_version?: number;
  server_position?: string;
  server_percentage?: number;
}

export interface CreateBookmarkRequest {
  book_id: number;
  position: string;
  label?: string;
  note?: string;
  color?: string;
  type: 'bookmark' | 'highlight' | 'note';
}

export interface UpdateBookmarkRequest {
  label?: string;
  note?: string;
  color?: string;
}

export interface SetRatingRequest {
  rating: number;
}

export interface BatchRatingRequest {
  book_ids: number[];
  rating: number;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

export interface BatchTagRequest {
  book_ids: number[];
  add_tag_ids?: number[];
  remove_tag_ids?: number[];
}

export interface UpdateMetadataRequest {
  title?: string;
  author?: string;
  description?: string;
  publisher?: string;
  publish_date?: string;
  language?: string;
}

export interface CreateTemplateRequest {
  name: string;
  pattern: string;
  field_mapping: Record<string, string>;
  example?: string;
}

export interface TemplatePreviewRequest {
  book_ids: number[];
}

export interface CreateApiTokenRequest {
  name: string;
  scopes: ApiScope[];
  expires_at?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IncrementalSyncResponse {
  progress_changes: any[];
  bookmarks_changes: any[];
  ratings_changes: any[];
  tags_changes: any[];
  server_time: string;
}

export interface ScanProgressEvent {
  jobId: number;
  libraryId: number;
  status: string;
  total: number;
  processed: number;
  currentFile?: string;
  newFiles: number;
  errors: number;
}

export interface StatsResponse {
  total_books_read: number;
  total_reading_time_seconds: number;
  total_pages_read: number;
  current_streak: number;
  longest_streak: number;
  books_finished: number;
}

export interface DailyStatsEntry {
  date: string;
  duration_seconds: number;
  pages_read: number;
  sessions: number;
}
