import { UserRole, Permission, BookFormat } from './enums';

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
  q: string;
  library_id?: number;
  limit?: number;
}

export interface SaveProgressRequest {
  position: string;
  percentage: number;
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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
