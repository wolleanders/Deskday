const KEY = 'tt.theme';

export function applyTheme(mode){
  const html = document.documentElement;
  mode === 'light' ? html.setAttribute('data-theme','light')
                   : html.removeAttribute('data-theme');
  localStorage.setItem(KEY, mode);
}
export function toggleTheme(){
  const cur = localStorage.getItem(KEY) || 'dark';
  applyTheme(cur === 'light' ? 'dark' : 'light');
}
export function bootTheme(){
  applyTheme(localStorage.getItem(KEY) || 'dark');
}
