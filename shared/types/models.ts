import { UserRole, BookFormat, Permission, ScanJobStatus, BookmarkType, ApiScope } from './enums';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  display_name: string | null;
  preferences: string | null;
  created_at: string;
  updated_at: string;
}

export interface Library {
  id: number;
  name: string;
  paths: string[];
  scan_schedule: string | null;
  last_scan_at: string | null;
  last_scan_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: number;
  library_id: number;
  file_path: string;
  file_hash: string | null;
  file_size: number;
  file_mtime: string;
  format: BookFormat;
  title: string | null;
  author: string | null;
  description: string | null;
  cover_path: string | null;
  page_count: number | null;
  language: string | null;
  publisher: string | null;
  publish_date: string | null;
  metadata_raw: string | null;
  is_duplicate: boolean;
  duplicate_of: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgress {
  id: number;
  user_id: number;
  book_id: number;
  position: string;
  percentage: number;
  version: number;
  finished: boolean;
  device_id: string | null;
  last_read_at: string;
  updated_at: string | null;
}

export interface Bookmark {
  id: number;
  user_id: number;
  book_id: number;
  position: string;
  label: string | null;
  note: string | null;
  color: string | null;
  type: BookmarkType;
  created_at: string;
}

export interface LibraryPermission {
  id: number;
  user_id: number;
  library_id: number;
  permission: Permission;
  granted_by: number | null;
  created_at: string;
}

export interface ScanJob {
  id: number;
  library_id: number;
  status: ScanJobStatus;
  total_files: number;
  processed_files: number;
  new_files: number;
  updated_files: number;
  deleted_files: number;
  errors: string | null;
  checkpoint: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface UserRating {
  id: number;
  user_id: number;
  book_id: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

export interface UserTag {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export interface BookTag {
  id: number;
  user_id: number;
  book_id: number;
  tag_id: number;
  created_at: string;
}

export interface ProgressHistory {
  id: number;
  user_id: number;
  book_id: number;
  position: string;
  percentage: number;
  version: number;
  device_id: string | null;
  created_at: string;
}

export interface MetadataHistory {
  id: number;
  book_id: number;
  user_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  batch_id: string | null;
  created_at: string;
}

export interface MetadataTemplate {
  id: number;
  user_id: number;
  name: string;
  pattern: string;
  field_mapping: string;
  example: string | null;
  created_at: string;
}

export interface ApiToken {
  id: number;
  user_id: number;
  name: string;
  token_hash: string;
  scopes: ApiScope[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ReadingStat {
  id: number;
  user_id: number;
  book_id: number;
  date: string;
  duration_seconds: number;
  pages_read: number;
  sessions: number;
}
