export function navigateBack(
  router: { back: () => void; push: (href: string) => void },
  fallback: string,
) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallback);
}
