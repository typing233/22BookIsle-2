export enum UserRole {
  Admin = 'admin',
  User = 'user',
}

export enum BookFormat {
  EPUB = 'epub',
  PDF = 'pdf',
  CBZ = 'cbz',
}

export enum Permission {
  Read = 'read',
  Write = 'write',
  Manage = 'manage',
}

export enum ScanJobStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum BookmarkType {
  Bookmark = 'bookmark',
  Highlight = 'highlight',
  Note = 'note',
}

export enum AuditAction {
  Login = 'login',
  LoginFailed = 'login_failed',
  UserCreate = 'user_create',
  UserUpdate = 'user_update',
  UserDelete = 'user_delete',
  LibraryCreate = 'library_create',
  LibraryUpdate = 'library_update',
  LibraryDelete = 'library_delete',
  PermissionChange = 'permission_change',
  ScanStart = 'scan_start',
  ScanComplete = 'scan_complete',
}
