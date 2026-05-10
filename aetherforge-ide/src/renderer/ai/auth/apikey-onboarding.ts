import { getProvider } from '../registry';

export function openSignupUrl(providerId: string): void {
  const url = getProvider(providerId)?.signupUrl;
  if (!url) {
    return;
  }
  void window.electronAPI?.openExternalUrl?.(url);
}
