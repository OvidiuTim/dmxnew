(() => {
  const now = new Date();
  const nextReload = new Date(now);
  nextReload.setHours(3, 0, 0, 0);
  if (nextReload.getTime() <= now.getTime()) {
    nextReload.setDate(nextReload.getDate() + 1);
  }
  window.setTimeout(() => window.location.reload(), nextReload.getTime() - now.getTime());
})();
