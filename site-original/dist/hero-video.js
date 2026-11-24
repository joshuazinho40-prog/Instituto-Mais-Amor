// A user gesture starts playback with sound. Native media controls remain available.
const video=document.querySelector('#inclusion-video');
if(video){
 const frame=video.closest('.video-frame');
 // Keep the original picture intact in a horizontal composition. A small canvas
 // reuses decoded frames for the soft background, without a second media stream.
 const stage=document.createElement('div');stage.className='hero-video-stage';
 video.before(stage);stage.append(video);
 const backdrop=document.createElement('canvas');backdrop.className='hero-video-backdrop';backdrop.setAttribute('aria-hidden','true');stage.prepend(backdrop);
 const context=backdrop.getContext('2d',{alpha:false});let frameCallback=null,animationCallback=null;
 const needsBackdrop=()=>video.videoWidth&&video.videoHeight&&Math.abs(video.videoWidth/video.videoHeight-16/9)>.02;
 function drawBackdrop(){
  if(!context||video.readyState<2||!needsBackdrop())return;
  const scale=Math.min(256/video.videoWidth,256/video.videoHeight),w=Math.max(1,Math.round(video.videoWidth*scale)),h=Math.max(1,Math.round(video.videoHeight*scale));
  if(backdrop.width!==w||backdrop.height!==h){backdrop.width=w;backdrop.height=h;}
  try{context.drawImage(video,0,0,w,h);stage.classList.add('has-video-frame');}catch{/* The brand-colored background remains visible until a frame can be drawn. */}
 }
 function stopBackdrop(){if(frameCallback!==null){video.cancelVideoFrameCallback?.(frameCallback);frameCallback=null;}if(animationCallback!==null){cancelAnimationFrame(animationCallback);animationCallback=null;}}
 function animateBackdrop(){
  if(video.paused||video.ended||!needsBackdrop())return;
  if(video.requestVideoFrameCallback){if(frameCallback!==null)return;frameCallback=video.requestVideoFrameCallback(()=>{frameCallback=null;drawBackdrop();animateBackdrop();});}
  else if(animationCallback===null)animationCallback=requestAnimationFrame(()=>{animationCallback=null;drawBackdrop();animateBackdrop();});
 }
 video.addEventListener('loadeddata',drawBackdrop);video.addEventListener('seeked',drawBackdrop);
 video.addEventListener('play',()=>{drawBackdrop();animateBackdrop();});
 video.addEventListener('pause',()=>{stopBackdrop();drawBackdrop();});video.addEventListener('ended',()=>{stopBackdrop();drawBackdrop();});
 video.addEventListener('emptied',()=>{stopBackdrop();stage.classList.remove('has-video-frame');});
 const button=document.createElement('button');button.type='button';button.className='hero-video-play';button.setAttribute('aria-label','Reproduzir vídeo de apresentação do Instituto Mais Amor');
 const icon=document.createElement('span');icon.className='hero-video-play-icon';icon.textContent='▶';icon.setAttribute('aria-hidden','true');const text=document.createElement('span');text.className='hero-video-play-text';text.textContent='Clique para assistir';button.append(icon,text);stage.append(button);
 const message=document.createElement('p');message.className='hero-video-status';message.setAttribute('role','status');message.hidden=true;frame.after(message);
 let started=false;
 const update=()=>{button.hidden=started||!video.paused;frame.classList.toggle('hero-video-started',started);};
 button.addEventListener('click',async()=>{button.disabled=true;message.hidden=true;try{await video.play();}catch{message.textContent='Não foi possível iniciar o vídeo agora. Tente novamente ou use os controles do player.';message.hidden=false;}finally{button.disabled=false;update();}});
 video.addEventListener('play',()=>{started=true;update();});video.addEventListener('ended',()=>{started=false;update();});video.addEventListener('pause',update);
 video.addEventListener('error',()=>{stopBackdrop();message.textContent='O vídeo não pôde ser carregado. Tente atualizar a página.';message.hidden=false;started=false;update();});
 async function configure(){try{const response=await fetch('/api/midia/chamada',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(!data.configurado||!data.url)return;
  const apply=()=>{video.pause();video.removeAttribute('poster');video.querySelectorAll('source,track').forEach(node=>node.remove());video.src=data.url;video.preload='metadata';video.setAttribute('aria-label','Vídeo de apresentação enviado para o Instituto Mais Amor');video.load();started=false;update();const caption=document.querySelector('.campaign-caption');if(caption)caption.hidden=true;};
  if(video.paused&&!started)apply();else video.addEventListener('ended',apply,{once:true});
 }catch{/* The original configured video stays usable if the descriptor cannot load. */}}
 configure();update();
}
