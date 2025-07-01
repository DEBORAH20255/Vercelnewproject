// Theme Toggle Script for Vercel-compatible static or Next.js projects

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function getTheme() {
  return localStorage.getItem('theme') || 'dark';
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
  updateToggleButton(next);
}

function updateToggleButton(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
  }
}

// Initialize theme on page load
if (typeof window !== "undefined") {
  document.addEventListener('DOMContentLoaded', () => {
    const theme = getTheme();
    setTheme(theme);
    updateToggleButton(theme);

    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  });
}