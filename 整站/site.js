'use strict'
const {pages,assets,food,extra,music,cookies}=window.MiYaBi
const stage=document.querySelector('#stage')
const reduced=matchMedia('(prefers-reduced-motion: reduce)')
const audio=new Audio()
audio.loop=true
const secondEggMusic=new Audio()
secondEggMusic.loop=true
secondEggMusic.volume=.55
let resumeDeskMusic=false
const collected=new Set()
const exploreActions=new Set([
 'cover','pen','glasses','lamp','album-switch','album-save',
 'egg1-open','egg1-read','egg1-return','egg2-wipe','egg2-letter','egg2-pet','egg2-return'
])
for(const [index,page] of pages.entries()){
 if(index>=1&&index<=17||index>=21&&index<=28)exploreActions.add('page-'+index)
 if(page.items.some(item=>item.name==='桔瓣.png'&&!item.hidden))exploreActions.add('petal-'+index)
 if(index>=14&&index<=17){
  exploreActions.add('food-switch-'+index)
 }
 if(index>=22&&index<=26)exploreActions.add('video-'+index)
}
exploreActions.add('page-28')
const explored=new Set()
function recordInteraction(key){
 if(!exploreActions.has(key)||explored.has(key))return
 explored.add(key)
 const label=document.getElementById('egg-progress-label')
 const bar=document.getElementById('egg-progress-bar')
 if(!label||!bar)return
 const percent=Math.floor(explored.size*100/exploreActions.size)
 label.textContent='目前已触发 '+percent+'%'
 bar.value=percent
}
const desktop=[2,3,4,1]
const wrap=(n,count)=>((n%count)+count)%count
let current=0,season=3,book=0,sky=1,windowPhoto=null,track=0,lampOn=false,hasSwitched=false,hasPoured=false,unlocked=false,busy=false,fade=0
let video=null
let videoPausedDeskMusic=false
let pitchContext,pitchModule,pitchConnection,localPitchVideo
let localPitchSource
function prepareLocalPitch(){
 if(window.MiYaBiPitch?.localVideo)return Promise.resolve()
 if(!localPitchSource){
  localPitchSource=new Promise((resolve,reject)=>{
   const script=document.createElement('script')
   script.src='../../整站/video-pitch.js'
   script.onload=()=>window.MiYaBiPitch?.localVideo?resolve():reject(new Error('缺少本地变声视频'))
   script.onerror=()=>reject(new Error('无法读取本地变声视频'))
   document.head.append(script)
  }).catch(error=>{
   localPitchSource=undefined
   throw error
  })
 }
 return localPitchSource
}
function pitchedSource(asset,semitones){
 if(!semitones||location.protocol!=='file:')return asset.url
 const encoded=window.MiYaBiPitch?.localVideo
 if(!encoded)return asset.url
 if(!localPitchVideo){
  const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0))
  localPitchVideo=URL.createObjectURL(new Blob([bytes],{type:asset.mime}))
 }
 return localPitchVideo
}
function fallbackPitch(context,semitones){
 const processor=context.createScriptProcessor(2048,2,2)
 const windowSize=Math.round(context.sampleRate*.065),length=windowSize+8
 const buffers=[new Float32Array(length),new Float32Array(length)]
 const step=(1-2**(semitones/12))/windowSize
 let cursor=0,phase=0
 function sample(buffer,offset){
  const position=cursor-2-offset*windowSize+length,index=Math.floor(position),fraction=position-index
  return buffer[index%length]*(1-fraction)+buffer[(index+1)%length]*fraction
 }
 processor.onaudioprocess=event=>{
  const input=event.inputBuffer,output=event.outputBuffer
  const channels=buffers.map((_,k)=>[input.getChannelData(Math.min(k,input.numberOfChannels-1)),output.getChannelData(k)])
  for(let i=0;i<output.length;i++){
   const other=(phase+.5)%1,weight=.5-.5*Math.cos(2*Math.PI*phase)
   channels.forEach(([from,to],k)=>{
    const buffer=buffers[k];buffer[cursor]=from[i]
    to[i]=sample(buffer,phase)*weight+sample(buffer,other)*(1-weight)
   })
   cursor=(cursor+1)%length;phase=(phase+step+1)%1
  }
 }
 return processor
}
async function connectPitch(node,semitones){
 if(!semitones||pitchConnection?.node===node)return
 if(location.protocol==='file:'&&!window.MiYaBiPitch?.localVideo)return
 pitchContext??=new AudioContext()
 await pitchContext.resume()
 if(!node.isConnected||pitchConnection?.node===node)return
 let processor
 try{
  if(!pitchModule){
   const url=URL.createObjectURL(new Blob([window.MiYaBiPitch.processor],{type:'text/javascript'}))
   pitchModule=Promise.resolve().then(()=>pitchContext.audioWorklet.addModule(url)).finally(()=>URL.revokeObjectURL(url))
  }
  await pitchModule
  processor=new AudioWorkletNode(pitchContext,'video-pitch',{outputChannelCount:[2]})
  processor.parameters.get('semitones').value=semitones
 }catch{processor=fallbackPitch(pitchContext,semitones)}
 if(!node.isConnected||pitchConnection?.node===node)return
 const source=pitchContext.createMediaElementSource(node)
 source.connect(processor).connect(pitchContext.destination)
 pitchConnection={node,source,processor}
}
const foodIndex=[0,0,0,0]

function animate(el,frames,duration){
 if(reduced.matches)return Promise.resolve()
 return el.animate(frames,{duration,easing:'ease-in-out'}).finished.catch(()=>{})
}
function element(tag,cls=''){
 const el=document.createElement(tag)
 el.className=cls
 if(tag==='button')el.type='button'
 return el
}
function applyBox(el,i){
 Object.assign(el.style,{left:i.x/19.2+'%',top:i.y/10.8+'%',width:i.w/19.2+'%',height:i.h/10.8+'%',rotate:(i.angle||0)+'rad'})
 return el
}
function displayImageUrl(url){return window.MiYaBiCompactImages?.[url]??url}
function image(url){const el=new Image();el.alt='';el.src=displayImageUrl(url);return el}
const prefetchedImages=new Set()
function prefetchImages(urls){
 if(navigator.connection?.saveData)return
 for(const source of urls){
  const url=displayImageUrl(source)
  if(!url||prefetchedImages.has(url))continue
  prefetchedImages.add(url)
  const hint=document.createElement('link')
  hint.rel='prefetch'
  hint.as='image'
  hint.href=url
  document.head.append(hint)
 }
}
function prefetchNextPage(index){
 const next=index===0?1:index>=5&&index<=12?5+(index-4)%8:null
 if(next===null||navigator.connection?.saveData)return
 const prefetch=()=>{
  if(current!==index)return
  const urls=pages[next].items.filter(item=>!item.hidden).map(item=>assets[item.assetId]?.url)
  prefetchImages(urls.filter(url=>/\.(webp|png|jpe?g)$/i.test(url||'')))
 }
 if(document.readyState!=='complete')window.addEventListener('load',prefetch,{once:true})
 else if(window.requestIdleCallback)window.requestIdleCallback(prefetch)
 else window.setTimeout(prefetch,350)
}
function control(el,label,handler){
 el.setAttribute('aria-label',label)
 el.addEventListener('click',handler)
 return el
}
function action(label,handler,cls='action'){
 const el=control(element('button',cls),label,handler)
 el.textContent=label
 return el
}
function text(i,handler){
 const el=applyBox(element(handler?'button':'div','layer text'),i)
 if(handler)control(el,i.text,handler)
 const font={wenkai:'"LXGW WenKai",KaiTi,serif',rounded:'YouYuan,"Microsoft YaHei",sans-serif',serif:'SimSun,serif',sans:'"Microsoft YaHei",sans-serif',kai:'KaiTi,serif',fangsong:'FangSong,serif'}
 const size=(i.font||48)*i.w/(i.baseWidth||i.w),lh=i.lineHeight??1.2
 Object.assign(el.style,{fontFamily:font[i.family]??'system-ui',fontSize:size/19.2+'cqw',lineHeight:lh,fontWeight:i.weight??400,color:i.color})
 if(i.yaw||i.pitch)el.style.transform='perspective('+Math.max(180,Math.hypot(i.w,i.h)*.95)/19.2+'cqw) rotateX('+(i.pitch??0)+'deg) rotateY('+(i.yaw??0)+'deg)'
 const dip=i.w*(i.curve??0)/100
 if(!dip){el.textContent=i.text;return el}
 const ns='http://www.w3.org/2000/svg'
 const svg=document.createElementNS(ns,'svg')
 svg.setAttribute('viewBox',[0,0,i.w,i.h].join(' '))
 svg.style.fontSize=size+'px'
 const defs=document.createElementNS(ns,'defs')
 svg.append(defs)
 i.text.split('\n').forEach((line,k)=>{
  const id='curve-'+i.id+'-'+k,y=size*(1+k*lh)+Math.max(0,-dip)
  const path=document.createElementNS(ns,'path')
  path.id=id;path.setAttribute('d','M 0 '+y+' Q '+i.w/2+' '+(y+2*dip)+' '+i.w+' '+y)
  defs.append(path)
  const node=document.createElementNS(ns,'text'),content=document.createElementNS(ns,'textPath')
  node.setAttribute('text-anchor','middle')
  content.setAttribute('href','#'+id);content.setAttribute('startOffset','50%');content.textContent=line
  node.append(content);svg.append(node)
 })
 el.append(svg)
 return el
}
function artwork(i,handler,label=i.name){
 const el=applyBox(element(handler?'button':'div','layer'+(handler?' hot':'')),i)
 if(handler)control(el,label,handler)
 if(assets[i.assetId])el.append(image(assets[i.assetId].url))
 return el
}
function media(i,asset=assets[i.assetId],asVideo=false){
 const el=applyBox(element('div','layer media'),i)
 el.style.clipPath='polygon('+i.points.map(([x,y])=>x*100+'% '+y*100+'%').join(',')+')'
 if(!asset)return el
 const node=asVideo?element('video'):image(asset.url)
 const semitones=Number(i.videoPitch?.[i.assetId])||0
 if(asVideo){
  node.src=pitchedSource(asset,semitones);node.playsInline=true;node.preload='metadata'
 }
 const m=i.mediaFraming?.[i.assetId]??{}
 const ratio=asset.w/asset.h,w=Math.max(i.w,i.h*ratio),h=w/ratio
 Object.assign(node.style,{width:w/i.w*100+'%',height:h/i.h*100+'%',left:(50+(m.x??0)-w/i.w*50)+'%',top:(50+(m.y??0)-h/i.h*50)+'%',transform:'rotate('+(m.rotation??0)+'deg) scale('+((m.scale??100)/100)+')'})
 el.append(node)
 if(asVideo){
  const toggle=action('▶',async()=>{
   if(!node.paused&&!node.ended){node.pause();return}
   toggle.disabled=true
   try{
    node.muted=false
    const playback=node.play()
    connectPitch(node,semitones).catch(error=>console.error('视频变音不可用',error))
    await playback
   }catch(error){
    console.error('视频播放失败',error)
    toggle.title='视频无法播放，请重试'
   }finally{toggle.disabled=false}
  },'video-toggle')
  toggle.setAttribute('aria-label','播放视频')
  if(semitones&&location.protocol==='file:'&&!window.MiYaBiPitch?.localVideo){
   toggle.disabled=true
   prepareLocalPitch().then(()=>{
    if(node.isConnected)node.src=pitchedSource(asset,semitones)
   }).catch(error=>{
    console.warn('本地变声素材无法载入，使用原声音轨',error)
   }).finally(()=>{toggle.disabled=false})
  }
  for(const type of ['play','pause','ended'])node.addEventListener(type,()=>{
   const playing=!node.paused&&!node.ended
   toggle.textContent=playing?'Ⅱ':'▶'
   toggle.setAttribute('aria-label',playing?'暂停视频':'播放视频')
   if(video!==node)return
   if(playing){
    if(type==='play')recordInteraction('video-'+current)
    if(!audio.paused){
     videoPausedDeskMusic=true
     cancelAnimationFrame(fade)
     audio.pause()
    }
   }else resumeMusicAfterVideo()
  })
  el.append(toggle);video=node
 }
 return el
}
function resumeMusicAfterVideo(){
 if(!videoPausedDeskMusic)return
 videoPausedDeskMusic=false
 audio.play().catch(console.error)
}
function setBackground(on,duration=260){
 cancelAnimationFrame(fade)
 if(!audio.src)return
 if(on&&audio.paused)audio.play().catch(console.error)
 const start=performance.now(),from=audio.volume,to=on?.55:0
 function tick(now){
  const t=Math.min(1,(now-start)/duration)
  audio.volume=from+(to-from)*t
  if(t<1)fade=requestAnimationFrame(tick)
  else if(!on)audio.pause()
 }
 fade=requestAnimationFrame(tick)
}
function playTrack(index,intro=false){
 cancelAnimationFrame(fade)
 audio.src=music[index]
 audio.volume=intro?.2:.55
 audio.play().then(()=>{if(intro&&audio.src.endsWith(music[index]))setBackground(true,650)}).catch(console.error)
}
function back(){
 if(current>=22&&current<=26){show(21);return}
 if(current>=5&&current<=12){
  const nextSeason=Math.floor(book/2)
  if(nextSeason!==season)windowPhoto=null
  season=nextSeason
 }
 show(desktop[season])
}
function collect(at){
 if(unlocked||busy)return
 collected.add(at)
 recordInteraction('petal-'+at)
 if(collected.size===17){
  prefetchImages(['media/first-egg/cover.webp',...window.MiYaBiFirstEggLayout.map(item=>item.url)])
 }
 if(collected.size!==19)return
 unlocked=true
 const bits=[]
 for(let i=0;i<64;i++){
  const bit=element('i','confetti')
  Object.assign(bit.style,{left:'25%',top:'10%',background:['#f69742','#f9d673','#a4b772','#d76b64','#e9b9a0'][i%5]})
  stage.append(bit);bits.push(bit)
 }
 busy=true
 Promise.all(bits.map((bit,i)=>animate(bit,[{transform:'none',opacity:1},{transform:'translate('+((i%11)-4)*7+'cqw,'+(-6-i%8)+'cqw) rotate(260deg)',offset:.45},{transform:'translate('+((i%11)-4)*9+'cqw,44cqw) rotate(620deg)',opacity:0}],920+i%11*20))).then(()=>{
  bits.forEach(bit=>bit.remove());busy=false;show(27)
  markSecondEggUnlocked()
 })
}
function baseLayer(i,index){
 if(i.type==='text')return text(i,i.text==='回到窗前'?back:null)
 if(i.type==='mask')return media(i,assets[i.assetId],index>=22&&index<=26)
 if(i.name==='桔瓣.png'){
  const orange=artwork(i,()=>{collect(index);sync()},'收集桔瓣')
  function sync(){
   const found=collected.has(index)
   orange.classList.toggle('orange-found',found)
   orange.setAttribute('aria-label',found?'桔瓣已收集':'收集桔瓣')
  }
  sync()
  return orange
 }
 if(i.name==='返回箭头.png')return artwork(i,back,'回到窗前')
 return artwork(i)
}
function makeLamp(i,page){
 const lamp=applyBox(element('div','layer lamp'+(lampOn?' lit':'')),i)
 const body=image(assets[i.assetId].url);body.className='body'
 const chain=element('div','chain');chain.append(image(assets[i.assetId].url))
 const pull=control(element('button','pull'),'拉台灯链条',e=>{if(e.detail===0)fire(true)})
 lamp.append(body,chain,pull)
 let origin=null,stretch=1
 const draw=s=>{stretch=s;chain.style.transform='scaleY('+s+')'}
 pull.onpointerdown=e=>{if(busy||e.button!==0)return;origin=e.clientY;pull.setPointerCapture(e.pointerId)}
 pull.onpointermove=e=>{if(origin!==null)draw(1+Math.min(.65,Math.max(0,(e.clientY-origin)/(lamp.clientHeight*.17))))}
 pull.onpointerup=()=>{if(origin!==null){origin=null;fire(stretch<1.04)}}
 pull.onpointercancel=()=>{origin=null;draw(1)}
 async function fire(tap){
  if(busy)return
  busy=true
  page.querySelector('.paper')?.remove()
  await animate(chain,[{transform:'scaleY('+stretch+')'},{transform:'scaleY('+(tap?1.42:.97)+')',offset:.55},{transform:'scaleY(1)'}],tap?330:260)
  draw(1)
  if(lampOn){
   hasSwitched=true
   recordInteraction('lamp')
  }
  track=wrap(track+1,3);playTrack(track)
  lampOn=true;lamp.classList.add('lit');page.classList.add('reading')
  pull.querySelector('.pull-hint')?.remove()
  if(!hasSwitched){
   const hint=element('span','pull-hint action');hint.textContent='再拉一次换歌';pull.append(hint)
  }
  const items=pages[18+track].items
  const paperItem=items.find(item=>item.name==='歌名纸条.png'),label=items.find(item=>item.type==='text')
  const paper=artwork(paperItem);paper.classList.add('paper')
  const line=text(label);Object.assign(line.style,{left:(label.x-paperItem.x)/paperItem.w*100+'%',top:(label.y-paperItem.y)/paperItem.h*100+'%',width:label.w/paperItem.w*100+'%',height:label.h/paperItem.h*100+'%'})
  paper.append(line,action('回到桌面',()=>{
   if(busy)return
   page.classList.remove('reading');paper.remove();pull.querySelector('.pull-hint')?.remove()
  }))
  page.append(paper)
  const a=lamp.getBoundingClientRect(),b=paper.getBoundingClientRect()
  const x=a.left+a.width*.38-b.left-b.width/2,y=a.top+a.height*.54-b.top-b.height/2
  await animate(paper,[{opacity:0,transform:'translate('+x+'px,'+y+'px) rotate(17deg) scale(.24)'},{opacity:1,transform:'translate(-2%,3%) rotate(-3deg) scale(1.02)',offset:.8},{opacity:1,transform:'none'}],480)
  busy=false
 }
 return lamp
}
function homeLayer(i,page){
 if(i.name==='蓝笔.png'){
  return artwork(i,event=>{
   recordInteraction('pen')
   animate(event.currentTarget,[
   {transform:'translateY(0)'},
   {transform:'translateY(-.25cqw)'},
   {transform:'translateY(0)'}
   ],240)
  },'桌上的蓝笔')
 }
 if(i.name==='眼镜纸片.png'){
  return artwork(i,event=>{
   recordInteraction('glasses')
   if(secondEggUnlocked()){
    if(busy)return
    show(28)
    markSecondEggEntered()
   }
   else{
    const angle=i.angle||0
    animate(event.currentTarget,[{rotate:angle+'rad'},{rotate:(angle+.07)+'rad'},{rotate:angle+'rad'}],300)
   }
  },'桌上的眼镜和手帕')
 }
 if(i.name==='台灯.png')return makeLamp(i,page)
 if(i.name==='饼干盘.png'){
  const plate=artwork(i)
  cookies.forEach((clip,k)=>{
   const category=[0,3,1,2][k]
   const label=['巧克力','薄荷','原味','橙子'][category]
   const button=control(element('button','cookie'),label,()=>show(14+category))
   Object.assign(button.style,{clipPath:clip,backgroundImage:'url('+assets[i.assetId].url+')'})
   plate.append(button)
  })
  return plate
 }
 const go={'相框.png':()=>show(13),'茶壶.png':()=>show(21),'笔记本.png':()=>{book=0;show(5)}}
 const el=artwork(i,go[i.name])
 if(i.name==='背景.png'&&current===1){el.style.left='0%';el.style.top='0%'}
 if(i.name==='窗外风景.png'&&windowPhoto){el.firstChild.src=displayImageUrl(windowPhoto.url);el.firstChild.className='window-photo'}
 if(go[i.name])shrinkHit(el)
 return el
}
const hitOutlines=new Map()
function shrinkHit(el){
 const img=el.firstChild
 if(!img)return
 let outline=hitOutlines.get(img.src)
 if(!outline){
  outline=measureHitOutline(img).catch(()=>null)
  hitOutlines.set(img.src,outline)
 }
 outline.then(clip=>{if(clip)el.style.clipPath=clip})
}
async function measureHitOutline(img){
 await img.decode()
 const c=document.createElement('canvas');c.width=128;c.height=Math.max(1,Math.round(128*img.naturalHeight/img.naturalWidth))
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height)
 const {data}=ctx.getImageData(0,0,c.width,c.height),left=[],right=[]
 for(let y=0;y<c.height;y++){
  let a=0,b=c.width-1
  while(a<c.width&&data[(y*c.width+a)*4+3]<65)a++
  while(b>=a&&data[(y*c.width+b)*4+3]<65)b--
  if(a<=b){left.push(a/c.width*100+'% '+y/c.height*100+'%');right.push((b+1)/c.width*100+'% '+y/c.height*100+'%')}
 }
 return left.length>2?'polygon('+left.concat(right.reverse()).join(',')+')':null
}
const albumItems=pages[13].items.filter(i=>!i.hidden)
const slots=albumItems.filter(i=>i.type==='mask').sort((a,b)=>a.x-b.x)
const skies=slots.map(i=>assets[i.assetId]).concat(extra)
function drawAlbum(page){
 const frames=albumItems.filter(i=>i.name==='空相框.png').sort((a,b)=>a.x-b.x)
 const center=frames.find(i=>i.w===Math.max(...frames.map(i=>i.w)))
 const ends=frames.filter(i=>i!==center).sort((a,b)=>a.x-b.x)
 const places=[ends[0],center,ends[1]]
 const cards=skies.map(()=>{
  const card=applyBox(element('div','album-card'),center)
  const frame=artwork(center);frame.style.inset='0';frame.style.width='100%';frame.style.height='100%'
  card.append(frame);card.hidden=true
  return card
 })
 const mountedPhotos=new Set()
 function mountPhoto(index){
  if(mountedPhotos.has(index))return
  mountedPhotos.add(index)
  const slot=slots[1],photo=media(slot,skies[index])
  Object.assign(photo.style,{left:(slot.x-center.x)/center.w*100+'%',top:(slot.y-center.y)/center.h*100+'%',width:slot.w/center.w*100+'%',height:slot.h/center.h*100+'%'})
  cards[index].prepend(photo)
 }
 let date,status
 for(const i of albumItems){
  if(i.type==='mask'||i.name==='空相框.png'||i.name==='景色照片-冬.png')continue
  if(i.name.includes('切换箭头')){
   const button=artwork(i,()=>roll(i.name.startsWith('左')?-1:1),i.name.startsWith('左')?'上一张照片':'下一张照片')
   button.style.zIndex=12;page.append(button);continue
  }
  if(i.name==='左下角下午茶.png'){
   const tea=artwork(i,()=>{if(busy)return;windowPhoto=skies[sky];status.hidden=false;status.textContent='已设为窗外景色 · '+windowPhoto.date;recordInteraction('album-save')},'设为窗外景色')
   tea.style.zIndex=12
   const label=element('span','tea-label');label.textContent='设为窗外景色';tea.append(label);page.append(tea);continue
  }
  if(i.text==='日期'){
   date=text(i);date.classList.add('album-date');date.style.left='26.614583%';date.style.width='49.010417%';date.style.zIndex=12;page.append(date);continue
  }
  const layer=baseLayer(i,13)
  if(i.name==='桔瓣.png'||i.text==='回到窗前'||i.name==='返回箭头.png')layer.style.zIndex=12
  page.append(layer)
 }
 status=element('div','layer action');Object.assign(status.style,{left:'3%',bottom:'3%',zIndex:13,pointerEvents:'none'});status.hidden=true;page.append(status)
 page.append(...cards)
 const transform=(k,out=0)=>{
  const i=places[k]
  return 'translate('+((i.x-center.x)/center.w*100+out*95)+'%,'+((i.y-center.y)/center.h*100)+'%) scale('+i.w/center.w+','+i.h/center.h+')'
 }
 const order=()=>[-1,0,1].map(k=>wrap(sky+k,skies.length))
 function paint(){
  const visible=order()
  visible.forEach(mountPhoto)
  cards.forEach((card,k)=>{const at=visible.indexOf(k);card.hidden=at<0;if(at>=0){card.style.transform=transform(at);card.style.zIndex=at===1?11:10}})
  date.textContent=skies[sky].date
 }
 async function roll(step){
  if(busy)return
  busy=true
  const old=order();sky=wrap(sky+step,skies.length);const next=order()
  next.forEach(mountPhoto)
  await Promise.all([...new Set([...old,...next])].map(k=>{
   const from=old.indexOf(k),to=next.indexOf(k),edge=step===1?2:0
   const card=cards[k],start=from<0?transform(edge,step):transform(from),end=to<0?transform(2-edge,-step):transform(to)
   card.hidden=false;card.style.transform=end;card.style.zIndex=to===1?11:10
   return animate(card,[{transform:start},{transform:end}],320)
  }))
  paint();busy=false
  recordInteraction('album-switch')
 }
 paint()
}
function drawFood(page,index){
 const category=index-14,records=food[category],labels={}
 let slot,shown
 for(const i of pages[index].items.filter(i=>!i.hidden)){
  if(i.type==='mask'){slot=media(i,null);page.append(slot);continue}
  if(i.name.includes('切换箭头')){
   const direction=i.name.startsWith('左')?-1:1
   const button=artwork(i,()=>roll(direction),direction===1?'下一条美食':'上一条美食')
   button.style.zIndex=5;page.append(button);continue
  }
  const layer=baseLayer(i,index)
  const field={'美食名称':'name','日期':'date','一句话':'note'}[i.text]
  if(field)labels[field]=layer
  if(field==='note')Object.assign(layer.style,{left:'46.354167%',top:'88.8%',width:'47.5%',height:'auto',rotate:'0deg',lineHeight:1.26,whiteSpace:'normal'})
  if(i.name==='背景.png')layer.style.left='0%'
  page.append(layer)
 }
 function words(record){for(const [field,el] of Object.entries(labels))el.textContent=record[field]}
 function photo(record){const el=image(record.url);el.style.objectFit='cover';return el}
 shown=photo(records[foodIndex[category]]);slot.append(shown);words(records[foodIndex[category]])
 async function roll(step){
  if(busy||records.length<2)return
  busy=true
  const index=wrap(foodIndex[category]+step,records.length),record=records[index],incoming=photo(record)
  try{
   await incoming.decode()
   slot.append(incoming)
   const leaving=shown.animate([{transform:'none'},{transform:'translateX('+(-step*100)+'%)'}],{duration:reduced.matches?0:300,fill:'forwards',easing:'ease-in-out'})
   await Promise.all([leaving.finished,animate(incoming,[{transform:'translateX('+(step*100)+'%)'},{transform:'none'}],300)])
   shown.remove();shown=incoming;foodIndex[category]=index;words(record)
   recordInteraction('food-switch-'+(category+14))
  }catch(error){incoming.remove();console.error(error)}
  finally{busy=false}
 }
}
function drawTea(page){
 const cups=[]
 let pot
 for(const i of pages[21].items.filter(i=>!i.hidden)){
  if(i.name==='茶壶.png'){
   pot=artwork(i,()=>{},'拖动茶壶倒茶');pot.className='layer drag-pot';page.append(pot);continue
  }
  if(i.name==='杯碟.png'){
   const cup=artwork(i,()=>{},'杯子 '+(cups.length+1)),fill=element('span','tea-fill')
   cup.append(fill);cups.push(cup);page.append(cup);continue
  }
  page.append(baseLayer(i,21))
 }
 if(!hasPoured){
  const hint=element('div','action guide');hint.textContent='拖动茶壶倒水到杯子里';page.append(hint)
 }
 const stream=element('div','stream');stream.hidden=true;page.append(stream)
 let gesture=null
 function mouth(cup){
  const r=cup.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(cup).transform)
  const p=new DOMPoint(-cup.offsetWidth*.015,-cup.offsetHeight*.14).matrixTransform(matrix)
  return {x:r.left+r.width/2+p.x,y:r.top+r.height/2+p.y}
 }
 function target(){
  const p=pot.getBoundingClientRect(),x=p.left+p.width*.084,y=p.top+p.height*.28
  return cups.find(cup=>{
   const m=mouth(cup)
   return Math.hypot((x-m.x)/(cup.offsetWidth*.18),(y-m.y)/(cup.offsetHeight*.11))<=1
  })
 }
 async function pour(cup){
  if(busy)return
  busy=true
  const destination=22+cups.indexOf(cup)
  try{
   const pouring=playPour(cup)
   let fallback
   try{
    await Promise.race([pouring,new Promise(resolve=>{fallback=setTimeout(resolve,1350)})])
   }finally{
    clearTimeout(fallback)
   }
  }catch(error){
   console.warn('倒茶动画未完成',error)
  }finally{
   stream.hidden=true
   hasPoured=true
   busy=false
  }
  show(destination,'video')
 }
 async function playPour(cup){
  const rect=page.getBoundingClientRect(),m=mouth(cup),gap=Math.max(14,rect.height*.065)
  const ox=pot.offsetWidth*.48,oy=pot.offsetHeight*.55,sx=pot.offsetWidth*.084-ox,sy=pot.offsetHeight*.28-oy
  const rad=-28*Math.PI/180
  const dx=m.x-rect.left-pot.offsetLeft-ox-(sx*Math.cos(rad)-sy*Math.sin(rad))
  const dy=m.y-gap-rect.top-pot.offsetTop-oy-(sx*Math.sin(rad)+sy*Math.cos(rad))
  const from=pot.style.transform||'none',to='translate('+dx+'px,'+dy+'px) rotate(-28deg)'
  pot.style.transform=to
  await animate(pot,[{transform:from},{transform:to}],220)
  if(!page.isConnected)return
  Object.assign(stream.style,{left:m.x-rect.left+'px',top:m.y-rect.top-gap+'px',height:gap+'px'})
  stream.hidden=false
  const fill=cup.querySelector('.tea-fill');fill.style.transform='scale(1)'
  await Promise.all([animate(fill,[{transform:'scale(.05)'},{transform:'scale(1)'}],850),animate(stream,[{scale:'1 0'},{scale:'1 1'}],200)])
 }
 pot.onpointerdown=e=>{if(busy||e.button!==0)return;gesture={x:e.clientX,y:e.clientY};pot.setPointerCapture(e.pointerId)}
 pot.onpointermove=e=>{
  if(!gesture)return
  pot.style.transform='translate('+(e.clientX-gesture.x)+'px,'+(e.clientY-gesture.y)+'px)'
  const cup=target()
  if(cup){gesture=null;pour(cup)}
 }
 pot.onpointerup=()=>{if(!gesture)return;gesture=null;pot.style.transform=''}
 pot.onpointercancel=()=>{if(!gesture)return;gesture=null;pot.style.transform=''}
 cups.forEach(cup=>cup.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pour(cup)}})
}
function prepareEggCard(page,scene){
 const intro=element('div','egg-intro')
 intro.setAttribute('aria-hidden','true')
 const card=element('div','egg-card')
 const inside=scene.cloneNode(true)
 const front=element('div','egg-card-front')
 const title=element('span')
 title.textContent='最后一瓣\n留给你'
 const hint=element('span','egg-card-hint')
 hint.textContent='点击打开'
 front.append(title,hint)
 const cover=element('div','egg-card-cover')
 cover.append(front,element('div','egg-card-back'))
 card.append(inside,cover)
 intro.append(card)
 page.append(intro)
 return async ()=>{
  try{
   if(reduced.matches)return
   hint.hidden=true
   await cover.animate([{transform:'rotateX(0deg)'},{transform:'rotateX(148deg)'}],
    {duration:1550,easing:'cubic-bezier(.35,0,.2,1)',fill:'forwards'}).finished
   await card.animate([
    {transform:'rotateX(15deg) rotateZ(-4deg) scale(1)'},
    {transform:'rotateX(0deg) rotateZ(0deg) scale(1.724138)'}
   ],{duration:1150,easing:'ease-in-out',fill:'forwards'}).finished
  }finally{
   intro.remove()
  }
 }
}
function drawEgg(page){
 const items=window.MiYaBiFirstEggLayout
 const scene=element('div','first-egg-scene')
 for(const item of items.filter(item=>item.url&&!item.hidden)){
  const layer=applyBox(element('div','layer'),item)
  layer.append(image(item.url))
  scene.append(layer)
 }
 const groups=['叮咚','回望','幸运值','虽然没有真正的奖励'].map(prefix=>items.find(item=>item.text?.trimStart().startsWith(prefix)))
 const words=groups.map(item=>text(item))
 words.forEach(word=>word.hidden=true)
 const button=action('回到起点',event=>{event.stopPropagation();recordInteraction('egg1-return');goCover()},'action egg-back first-egg-return')
 button.hidden=true
 page.append(scene,...words,button)
 page.tabIndex=0
 page.setAttribute('aria-label','彩蛋，点击打开贺卡')
 const openCard=prepareEggCard(page,scene)
 let phase='closed'
 async function reveal(word){
  word.hidden=false
  await animate(word,[{opacity:0},{opacity:1}],550)
 }
 async function next(){
  if(phase==='closed'){
   phase='opening'
   await openCard()
   await reveal(words[0])
   await reveal(words[1])
   recordInteraction('egg1-open')
   phase='ready'
   page.setAttribute('aria-label','彩蛋，点击继续')
   return
  }
  if(phase!=='ready')return
  phase='ending'
  const openingWords=words.slice(0,2)
  await Promise.all([
   animate(scene,[{filter:'blur(0)'},{filter:'blur(10px)'}],520).then(()=>scene.classList.add('first-egg-soft')),
   ...openingWords.map(async word=>{
    await animate(word,[{opacity:1,filter:'blur(0)'},{opacity:0,filter:'blur(10px)'}],520)
    word.hidden=true
   })
  ])
  await reveal(words[2])
  await reveal(words[3])
  recordInteraction('egg1-read')
  button.hidden=false
 }
 page.onclick=next
 page.onkeydown=event=>{
  if(event.target===page&&(event.key==='Enter'||event.key===' ')){
   event.preventDefault()
   next()
  }
 }
}
function goCover(){
 cancelAnimationFrame(fade);audio.pause();audio.currentTime=0
 season=3;track=0;lampOn=false;hasSwitched=false
 show(0)
}
function updateSecondEggMusic(previous,index,page){
 if(previous===28&&index!==28){
  secondEggMusic.pause()
  secondEggMusic.currentTime=0
  if(resumeDeskMusic)audio.play().catch(console.error)
  resumeDeskMusic=false
 }
 if(index!==28||previous===28)return
 resumeDeskMusic=!audio.paused
 cancelAnimationFrame(fade)
 audio.pause()
 if(!secondEggMusic.src)secondEggMusic.src='media/second-egg/sheng-xia.mp3'
 const start=()=>secondEggMusic.play().catch(error=>{
  if(error.name!=='NotAllowedError')console.error('第二彩蛋音乐无法播放',error)
 })
 start()
 const retry=()=>{
  if(index===current&&secondEggMusic.paused)start()
  page.removeEventListener('pointerdown',retry)
  page.removeEventListener('keydown',retry)
 }
 page.addEventListener('pointerdown',retry)
 page.addEventListener('keydown',retry)
}
function show(index,transition){
 if(busy)return
 const previous=current
 const old=stage.querySelector('.page')
 if(video){
  video.pause();video=null
  if(pitchConnection){pitchConnection.source.disconnect();pitchConnection.processor.disconnect();pitchConnection=null}
  resumeMusicAfterVideo()
 }
 current=index
 window.MiYaBiVisitTime.enter(index)
 const page=element('section','page')
 page.dataset.index=index
 page.setAttribute('aria-label',index===28?'第二个彩蛋':pages[index].name)
 if(index===13)drawAlbum(page)
 else if(index>=14&&index<=17)drawFood(page,index)
 else if(index===21)drawTea(page)
 else if(index===27)drawEgg(page)
 else if(index===28)drawSecondEgg(page)
 else for(const i of pages[index].items.filter(i=>!i.hidden)){
  if(index===0&&i.name==='MiYaBi标题.png'){
   const title=artwork(i,()=>{if(busy)return;track=0;playTrack(0,true);show(1,'radial');recordInteraction('cover')},'MiYaBi，进入冬季桌面')
   page.append(title);animate(title,[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],1050)
  }else if(index>=1&&index<=4)page.append(homeLayer(i,page))
  else if(index>=5&&index<=12&&i.name==='小狐狸侧贴.png'){
   const fox=artwork(i,()=>{if(busy)return;book=wrap(book+1,8);show(5+book,'book')},'下一跨页')
   shrinkHit(fox);page.append(fox)
  }else page.append(baseLayer(i,index))
 }
 if(index>=5&&index<=12){
  const spread=element('div','book-spread')
  Object.assign(spread.style,{position:'absolute',inset:'0'})
  spread.append(...[...page.children].slice(1))
  page.append(spread)
 }
 if(transition==='radial'&&old&&!reduced.matches){
  busy=true;page.classList.add('radial');stage.append(page)
  animate(page,[{'--spread':-24},{'--spread':100}],650).then(()=>{page.classList.remove('radial');old.remove();busy=false})
 }else{
  stage.replaceChildren(page)
  if(transition==='video')animate(page,[{opacity:0},{opacity:1}],300)
  if(transition==='book'&&old&&!reduced.matches){
   const desk=page.firstElementChild
   desk.style.visibility='hidden'
   old.inert=true
   old.style.pointerEvents='none'
   stage.prepend(old)
   busy=true
   Promise.all([
    animate(old.lastElementChild,[{opacity:1},{opacity:0}],280),
    animate(page.lastElementChild,[{opacity:0},{opacity:1}],280)
   ]).then(()=>{desk.style.visibility='';old.remove();busy=false})
  }
 }
 if(index===27)page.focus({preventScroll:true})
 recordInteraction('page-'+index)
 updateSecondEggMusic(previous,index,page)
 prefetchNextPage(index)
}
show(document.body.hasAttribute('data-preview-first-egg')?27:document.body.hasAttribute('data-preview-second-egg')?28:0)
