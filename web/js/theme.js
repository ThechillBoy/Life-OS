try {
  const choice = localStorage.getItem('lifeos.theme') || 'system';
  document.documentElement.dataset.theme = choice === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
} catch {
  document.documentElement.dataset.theme = 'light';
}
