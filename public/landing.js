(function(){
  const root=document.documentElement, reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals=document.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window&&!reduce){const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.16});reveals.forEach((el)=>observer.observe(el));}else reveals.forEach((el)=>el.classList.add('is-visible'));
  if(reduce)return;
  const visual=document.querySelector('.landing-visual'),layers=visual?visual.querySelectorAll('[data-depth]'):[];
  let raf=0;
  function render(){raf=0;layers.forEach((layer)=>{const depth=Number(layer.dataset.depth)||0;layer.style.setProperty('--shift-y',Math.round(window.scrollY*depth*.08));});}
  window.addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(render)},{passive:true});window.addEventListener('resize',render,{passive:true});render();
  if(visual){visual.addEventListener('pointermove',(event)=>{const rect=visual.getBoundingClientRect();visual.style.setProperty('--mx',((event.clientX-rect.left)/rect.width-.5)*10);visual.style.setProperty('--my',((event.clientY-rect.top)/rect.height-.5)*8);});visual.addEventListener('pointerleave',()=>{visual.style.setProperty('--mx',0);visual.style.setProperty('--my',0);});}
})();
