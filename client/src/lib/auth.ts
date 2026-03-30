const TOKEN_KEY = "liquid_encrypt_token";
const ORG_KEY = "liquid_encrypt_active_org";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getActiveOrgId(): string | null {
  return localStorage.getItem(ORG_KEY);
}

export function setActiveOrgId(orgId: string): void {
  localStorage.setItem(ORG_KEY, orgId);
}
