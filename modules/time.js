function fmt(h, h12){
  if(!h12) return {t:String(h), p:''};
  const base = h%12===0?12:h%12, p = h<12?'am':'pm';
  return {t:String(base), p};
}
export function applyHourFormat(h12,{selector}){
  document.querySelectorAll(selector).forEach(el=>{
    const h = parseInt(el.dataset.hour ?? el.textContent.trim(),10);
    if(Number.isNaN(h)) return;
    const {t,p} = fmt(h,h12);
    el.textContent = t;
    p ? el.dataset.ampm=p : el.removeAttribute('data-ampm');
  });
  localStorage.setItem('tt.hour12', h12 ? '1' : '0');
}
export function bootHours({selector}){
  // einmal data-hour füllen (falls nötig)
  document.querySelectorAll(selector).forEach(el=>{
    if(!el.dataset.hour){
      const n = parseInt(el.textContent.trim(),10);
      if(!Number.isNaN(n)) el.dataset.hour = n;
    }
  });
  const h12 = localStorage.getItem('tt.hour12') === '1';
  applyHourFormat(h12,{selector});
}
