export function authUrl(path: string): string {
  const token = localStorage.getItem('accessToken');
  if (!token) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}token=${token}`;
}
