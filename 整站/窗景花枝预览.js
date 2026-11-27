'use strict'

let hiddenLetterFound=false
function decoratePenPreview(){
 const page=stage.querySelector('.page')
 if(!page||page.dataset.penDecorated)return
 const index=Number(page.dataset.index)
 if(index<1||index>4)return
 const old=page.querySelector('[aria-label="桌上的眼镜和手帕"]')
 const pen=page.querySelector('[aria-label="桌上的蓝笔"]')
 const source=old?.querySelector('img')
 if(!source||!pen)return
 page.dataset.penDecorated='true'
 if(!secondEggUnlocked()){
  for(const [item,key] of [[pen,'pen'],[old,'glasses']]){
   item.addEventListener('click',event=>{
    event.stopImmediatePropagation()
    recordInteraction(key)
   },{capture:true})
  }
  return
 }
 const desk=element('div','preview-hanky-set')
 desk.addEventListener('click',event=>{
  if(event.target===desk)recordInteraction('glasses')
 })
 Object.assign(desk.style,{left:old.style.left,top:old.style.top,width:old.style.width,height:old.style.height})
 old.replaceWith(desk)
 const folded=action('打开折叠信纸',openLetter,'preview-folded-letter')
 folded.textContent=''
 folded.append(image('小信封-预览.webp'))
 folded.hidden=!hiddenLetterFound
 const original=source.cloneNode()
 original.className='preview-original'
 const cloth=image('手帕原图分层.webp?v=3')
 cloth.className='preview-hanky'
 const curl=element('span','preview-curl')
 const glasses=image('眼镜原图分层.webp')
 glasses.className='preview-glasses'
 desk.append(folded,cloth,curl,glasses,original)
 pen.classList.add('preview-draggable-pen')
 page.tabIndex=-1
 const tip=element('span','preview-pen-tip')
 pen.append(tip)
 let picked=false,hold=null,nearCorner=false,glassesMoved=false,dwell=null,overHanky=false
 let audioContext
 const waitForImage=img=>new Promise(resolve=>{
  if(img.complete){resolve(img.naturalWidth>0);return}
  img.addEventListener('load',()=>resolve(true),{once:true})
  img.addEventListener('error',()=>resolve(false),{once:true})
 })
 const materials=Promise.all([cloth,glasses].map(waitForImage)).then(results=>results.every(Boolean))
 let gripX=0,gripY=0

 function setFold(value){
  const left=[58-29*value,89-21*value],right=[58+19*value,89-39*value]
  const point=([x,y])=>x+'% '+y+'%'
  cloth.style.clipPath='polygon(0 0,100% 0,100% 45%,'+point(right)+','+point(left)+',12% 74%,0 74%)'
  curl.style.clipPath='polygon('+point(left)+','+point([58-4*value,89-38*value])+','+point(right)+')'
 }
 function cancelDwell(){
  if(dwell!==null){clearTimeout(dwell);dwell=null}
 }
 function playRustle(){
  if(!audioContext||audioContext.state!=='running')return
  const duration=.22
  const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate)
  const noise=buffer.getChannelData(0)
  for(let i=0;i<noise.length;i++)noise[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/noise.length)
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain()
  source.buffer=buffer;filter.type='bandpass';filter.frequency.value=740;gain.gain.value=.028
  source.connect(filter).connect(gain).connect(audioContext.destination)
  source.start()
 }
 function rest(){
  const pointer=hold?.id
  cancelDwell();overHanky=false
  picked=false;hold=null;nearCorner=false
  if(pointer!==undefined&&page.hasPointerCapture(pointer))page.releasePointerCapture(pointer)
  pen.classList.remove('preview-pen-held')
  pen.style.translate=''
  desk.classList.remove('preview-ready','preview-folding')
  setFold(hiddenLetterFound?1:0)
 }
 function follow(event){
  pen.style.translate=(event.clientX-hold.startX)+'px '+(event.clientY-hold.startY)+'px'
  const b=desk.getBoundingClientRect()
  const x=(event.clientX+gripX-b.left)/b.width,y=(event.clientY+gripY-b.top)/b.height
  overHanky=x>=.18&&x<=.83&&y>=.2&&y<=.91
  if(!glassesMoved){
   if(!overHanky)cancelDwell()
   else if(dwell===null){
    const timer=setTimeout(async()=>{
     const loaded=await materials
     if(dwell!==timer)return
     dwell=null
     if(!loaded||!picked||!overHanky)return
     glassesMoved=true
     desk.classList.add('preview-separated')
     rest()
     recordInteraction('egg2-move-glasses')
     prefetchImages(['cloth','hanky','cry','rain'].map(name=>'media/second-egg/'+name+'.webp'))
    },2000)
    dwell=timer
   }
   return
  }
  nearCorner=x>=.36&&x<=.83&&y>=.55&&y<=1.08
  desk.classList.toggle('preview-ready',nearCorner)
  if(hold&&!hold.lifting&&nearCorner){
   hold.lifting=true
   hold.x=event.clientX
   hold.y=event.clientY
   desk.classList.add('preview-folding')
  }
  if(!hold?.lifting){setFold(nearCorner?.12:0);return}
  const up=(hold.y-event.clientY)/b.height
  const sideways=Math.abs(event.clientX-hold.x)/b.width
  const amount=Math.max(0,Math.min(1,up*5.6+Math.min(sideways,Math.max(0,up))*2))
  setFold(.12+.88*amount)
  if(up>.036&&sideways>.007&&amount>=.24){
   hiddenLetterFound=true
   folded.hidden=false
   desk.classList.add('preview-found')
   playRustle()
   rest()
   recordInteraction('egg2-lift-hanky')
  }
 }
 function pick(event){
  if(hiddenLetterFound||picked)return
  const p=tip.getBoundingClientRect()
  gripX=p.left-event.clientX
  gripY=p.top-event.clientY
  hold={id:event.pointerId,startX:event.clientX,startY:event.clientY,lifting:false}
  picked=true
  pen.classList.add('preview-pen-held')
  page.setPointerCapture(event.pointerId)
  try{
   if(!audioContext&&typeof AudioContext==='function')audioContext=new AudioContext()
   audioContext?.resume().catch(()=>{})
  }catch{}
 }
 if(hiddenLetterFound){desk.classList.add('preview-found','preview-separated');setFold(1)}
 pen.addEventListener('click',event=>{event.stopImmediatePropagation()},{capture:true})
 pen.addEventListener('pointerdown',event=>{
  if(event.button!==0||picked||hiddenLetterFound)return
  event.preventDefault()
  event.stopPropagation()
  recordInteraction('pen')
  pick(event)
  page.focus({preventScroll:true})
 })
 page.addEventListener('pointermove',event=>{
  if(picked&&event.pointerId===hold?.id)follow(event)
 })
 page.addEventListener('pointerup',event=>{
  if(hold?.id!==event.pointerId)return
  rest()
 })
 page.addEventListener('pointercancel',rest)
 page.addEventListener('lostpointercapture',event=>{if(hold?.id===event.pointerId)rest()})
 page.addEventListener('keydown',event=>{if(event.key==='Escape'&&picked)rest()})

 function openLetter(){
  if(!hiddenLetterFound||!secondEggUnlocked()||busy)return
  show(28,'video')
  markSecondEggEntered()
 }
}
if(document.body.hasAttribute('data-full-pen-preview')){
 exploreActions.add('egg2-move-glasses')
 exploreActions.add('egg2-lift-hanky')
}
new MutationObserver(decoratePenPreview).observe(stage,{childList:true})
if(!document.body.hasAttribute('data-full-pen-preview')){
 markSecondEggUnlocked()
 show(desktop[season])
}
decoratePenPreview()
