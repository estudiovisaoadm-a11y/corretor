(function(){
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals=document.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window&&!reduce){const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.16});reveals.forEach((el)=>observer.observe(el));}else reveals.forEach((el)=>el.classList.add('is-visible'));
  if(reduce)return;
  const radarStatus=document.querySelector('[data-radar-status]');
  const targets=[...document.querySelectorAll('[data-radar-target]')];
  const metrics=[...document.querySelectorAll('.radar-metrics b')];
  if(radarStatus&&targets.length){
    const scores=[92,88,84,86];
    let index=-1;
    const locate=()=>{
      index=(index+1)%targets.length;
      targets.forEach((target,i)=>target.classList.toggle('is-active',i===index));
      const name=targets[index].dataset.radarTarget;
      radarStatus.textContent=`Alvo localizado · ${name}`;
      if(metrics.length>=3){
        metrics[0].textContent=String(index+1).padStart(2,'0');
        metrics[1].textContent=String(scores[index]);
        metrics[2].textContent=`${(0.8+index*.15).toFixed(1)}s`;
      }
    };
    locate();
    window.setInterval(locate,1200);
  }
})();
