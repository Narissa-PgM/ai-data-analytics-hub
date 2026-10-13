
/* Visual kit behaviour: numbered pins <-> legend highlight, enlarge dialog. No motion. */
(function(){
  var body=document.getElementById('modalBody');if(!body)return;
  function activate(root,n){
    var cur=root.querySelector('li[data-vzpin].on');var was=cur&&cur.dataset.vzpin===n;
    root.querySelectorAll('[data-vzpin].on').forEach(function(e){e.classList.remove('on')});
    if(!was)root.querySelectorAll('[data-vzpin="'+n+'"]').forEach(function(e){e.classList.add('on')});
  }
  body.addEventListener('click',function(e){
    var eb=e.target.closest('.vz-enlarge');
    if(eb&&body.contains(eb)){
      var f=eb.closest('.vz-fig'),svg=f&&f.querySelector('svg');if(!svg)return;
      var t=f.querySelector('.vz-fig-title'),dlg=document.createElement('dialog');
      dlg.className='graphic-viewer';dlg.setAttribute('aria-label','Enlarged graphic');
      dlg.innerHTML='<div class="graphic-viewer-bar"><strong></strong><label>Zoom <select aria-label="Zoom"><option value="100">Fit</option><option value="130">130%</option><option value="170">170%</option></select></label><button type="button">Close ×</button></div><div class="graphic-canvas"></div>';
      dlg.querySelector('strong').textContent=t?t.textContent:'Graphic';
      var clone=svg.cloneNode(true);clone.style.cssText='display:block;width:100%;height:auto;min-width:0';
      dlg.querySelector('.graphic-canvas').appendChild(clone);
      dlg.querySelector('select').addEventListener('change',function(ev){clone.style.width=ev.target.value+'%'});
      dlg.querySelector('button').addEventListener('click',function(){dlg.close()});
      dlg.addEventListener('keydown',function(ev){ev.stopPropagation()});
      dlg.addEventListener('close',function(){dlg.remove();eb.focus()});
      document.body.appendChild(dlg);dlg.showModal();return;
    }
    var p=e.target.closest('[data-vzpin]');
    if(p&&body.contains(p)){var root=p.closest('.vz-sec')||body;activate(root,p.dataset.vzpin);}
  });
  body.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[data-vzpin]')){e.preventDefault();e.target.click();}
  });
})();

