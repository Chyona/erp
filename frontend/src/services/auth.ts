import { apiRequest } from './apiClient';

export type LoginResult = {
  token: string;
  expires_at: string;
  account_id: number;
  username: string;
  nickname: string;
  role: string;
  must_change_password: boolean;
};

export async function loginRequest(username: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>(
    'POST',
    '/auth/login',
    { username, password },
    { skipAuth: true, skipUnauthorizedRedirect: true }
  );
}

export async function setupPasswordRequest(password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>('POST', '/auth/setup-password', { password });
}

export async function skipPasswordSetupRequest(): Promise<LoginResult> {
  return apiRequest<LoginResult>('POST', '/auth/skip-password-setup');
}

export async function confirmPasswordRequest(password: string): Promise<void> {
  await apiRequest<null>('POST', '/auth/confirm-password', { password });
}

export async function changePasswordRequest(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await apiRequest<null>('POST', '/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword
  });
}
