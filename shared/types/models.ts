import { UserRole, BookFormat, Permission, ScanJobStatus, BookmarkType } from './enums';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  display_name: string | null;
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
  last_read_at: string;
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
