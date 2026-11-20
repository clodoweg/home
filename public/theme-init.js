// Puts the stored theme on <html> before the first paint (ThemeContext takes over once React
// runs); without a stored choice, the system's. An external file: the CSP refuses inline scripts.
try {
  var stored = localStorage.getItem('app-theme-preference');
  var light =
    stored === 'light' ||
    (stored !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.classList.add(light ? 'light' : 'dark');
} catch {
  document.documentElement.classList.add('dark');
}
