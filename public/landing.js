(function(){
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals=document.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window&&!reduce){const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.16});reveals.forEach((el)=>observer.observe(el));}else reveals.forEach((el)=>el.classList.add('is-visible'));
  if(reduce)return;
})();
