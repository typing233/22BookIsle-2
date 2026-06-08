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
  ProgressSync = 'progress_sync',
  MetadataEdit = 'metadata_edit',
  MetadataRollback = 'metadata_rollback',
  TokenCreate = 'token_create',
  TokenRevoke = 'token_revoke',
}

export enum ApiScope {
  BooksRead = 'books:read',
  BooksWrite = 'books:write',
  ProgressRead = 'progress:read',
  ProgressWrite = 'progress:write',
  BookmarksRead = 'bookmarks:read',
  BookmarksWrite = 'bookmarks:write',
  TagsRead = 'tags:read',
  TagsWrite = 'tags:write',
  RatingsRead = 'ratings:read',
  RatingsWrite = 'ratings:write',
  MetadataRead = 'metadata:read',
  MetadataWrite = 'metadata:write',
  StatsRead = 'stats:read',
  SyncRead = 'sync:read',
  SyncWrite = 'sync:write',
}

export enum ReadStatus {
  Unread = 'unread',
  Reading = 'reading',
  Finished = 'finished',
}

export enum ComicViewMode {
  Single = 'single',
  Double = 'double',
}

export enum ReadingDirection {
  LTR = 'ltr',
  RTL = 'rtl',
}
