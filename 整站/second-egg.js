'use strict'

let secondEggUnlockedInSession=false
let secondEggEnteredInSession=false

function markSecondEggUnlocked(){
 secondEggUnlockedInSession=true
}

function secondEggUnlocked(){
 return secondEggUnlockedInSession&&!secondEggEnteredInSession
}

function markSecondEggEntered(){
 secondEggEnteredInSession=true
}

function drawSecondEgg(page){
 const [clothBox,hankyBox,cryBox,letterBox,...content]=window.MiYaBiSecondEggLayout
 const rainBox=content.pop()
 const asset=name=>'media/second-egg/'+name
 const picture=(box,name)=>{
  const layer=applyBox(element('div','layer'),box)
  layer.append(image(asset(name)))
  return layer
 }
 page.classList.add('second-egg')
 const cloth=picture(clothBox,'cloth.png')
 const hanky=picture(hankyBox,'hanky.png')
 const crying=picture(cryBox,'cry.png')
 const words=content.map(item=>{
  const layer=text(item)
  layer.classList.add('second-egg-word')
  layer.setAttribute('aria-hidden','true')
  return layer
 })
 const rain=element('canvas','second-egg-rain')
 Object.assign(rain,{width:960,height:540})
 rain.setAttribute('aria-hidden','true')
 const wet=rain.getContext('2d')
 const mask=element('canvas')
 Object.assign(mask,{width:rain.width,height:rain.height})
 const coverage=mask.getContext('2d',{willReadFrequently:true})
 const rainImage=image(asset('rain.png'))
 const grab=control(element('button','second-egg-grab'),'拿起手帕擦一擦',()=>{})
 const held=image(asset('held.png'))
 held.className='second-egg-held'
 held.hidden=true

 const letter=applyBox(element('div','layer'),letterBox)
 const pat=control(element('button','second-egg-pat'),'摸摸桔子的头',pet)
 const letterImage=image(asset('letter.png'))
 const patImage=image(asset('pat.gif'))
 patImage.hidden=true
 pat.append(letterImage,patImage)
 letter.append(pat)
 letter.hidden=true
 const thanks=control(element('button','second-egg-thanks'),'谢谢你又一次擦掉桔汁儿，点击画面读信',revealLetter)
 const thanksText=element('span')
 thanksText.textContent='谢谢你又一次擦掉桔汁儿'
 thanks.append(thanksText)
 thanks.hidden=true
 const exit=action('回到桌面',()=>{recordInteraction('egg2-return');show(desktop[season])},'action second-egg-exit')
 exit.hidden=true
 page.append(cloth,hanky,...words,rain,crying,grab,held,letter,thanks,exit)

 let ready=false,finished=false,letterRevealed=false,pointer=null,previous=null
 let keyboardPoint=[.5,.5]
 const layers=[[cloth.firstChild,clothBox],[hanky.firstChild,hankyBox]]
 Promise.all([...layers.map(([img])=>img),rainImage].map(img=>img.decode().catch(()=>{}))).then(()=>{
  if(!page.isConnected)return
  wet.save()
  wet.filter='blur(5px)'
  for(const [img,box] of layers)if(img.naturalWidth)drawLayer(img,box)
  wet.restore()
  wet.fillStyle='#dce4e761'
  wet.fillRect(0,0,rain.width,rain.height)
  if(rainImage.naturalWidth)drawLayer(rainImage,rainBox)
  coverage.fillRect(0,0,mask.width,mask.height)
  ready=true
 })

 function drawLayer(img,box){
  const x=box.x/2,y=box.y/2,w=box.w/2,h=box.h/2
  wet.save()
  wet.translate(x+w/2,y+h/2)
  wet.rotate(box.angle||0)
  wet.drawImage(img,-w/2,-h/2,w,h)
  wet.restore()
 }

 function pet(){
  if(!letterRevealed)return
  recordInteraction('egg2-pet')
  letterImage.hidden=true
  patImage.hidden=false
  exit.hidden=false
 }
 function revealLetter(){
  recordInteraction('egg2-letter')
  letterRevealed=true
  thanks.hidden=true
  page.classList.add('second-egg-reading')
  for(const word of words)word.removeAttribute('aria-hidden')
  pat.focus({preventScroll:true})
 }
 pat.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')pet()})
 pat.addEventListener('pointerleave',event=>{
  if(event.pointerType==='mouse'){letterImage.hidden=false;patImage.hidden=true}
 })

 function brush(x,y){
  const radius=68
  const gradient=wet.createRadialGradient(x,y,radius*.52,x,y,radius)
  gradient.addColorStop(0,'#000')
  gradient.addColorStop(1,'#0000')
  for(const context of [wet,coverage]){
   context.save()
   context.globalCompositeOperation='destination-out'
   context.fillStyle=gradient
   context.fillRect(x-radius,y-radius,radius*2,radius*2)
   context.restore()
  }
 }
 function stroke(x,y){
  held.style.left=x*100+'%'
  held.style.top=y*100+'%'
  const [lastX,lastY]=previous??[x,y]
  const steps=Math.max(1,Math.ceil(Math.hypot(x-lastX,y-lastY)*55))
  for(let step=1;step<=steps;step++){
   brush((lastX+(x-lastX)*step/steps+.025)*mask.width,
    (lastY+(y-lastY)*step/steps+.06)*mask.height)
  }
  previous=[x,y]
  const pixels=coverage.getImageData(0,0,mask.width,mask.height).data
  let cleared=0,total=0
  for(let row=3;row<mask.height;row+=6){
   for(let column=3;column<mask.width;column+=6){
    if(pixels[(row*mask.width+column)*4+3]<=15)cleared++
    total++
   }
  }
  if(cleared/total<.8)return
  finished=true
  recordInteraction('egg2-wipe')
  page.classList.add('second-egg-clear')
  crying.hidden=true
  letter.hidden=false
  thanks.hidden=false
  const focused=grab===document.activeElement
  grab.hidden=true
  held.hidden=true
  page.classList.remove('second-egg-wiping')
  if(focused)thanks.focus({preventScroll:true})
 }
 function move(event){
  const box=page.getBoundingClientRect()
  stroke((event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height)
 }
 grab.addEventListener('pointerdown',event=>{
  if(!ready||finished||pointer!==null||event.button!==0)return
  pointer=event.pointerId
  grab.setPointerCapture(pointer)
  page.classList.add('second-egg-wiping')
  held.hidden=false
  move(event)
 })
 grab.addEventListener('pointermove',event=>{if(pointer===event.pointerId&&!finished)move(event)})
 for(const type of ['pointerup','pointercancel','lostpointercapture']){
  grab.addEventListener(type,event=>{
   if(pointer!==event.pointerId)return
   pointer=null
   previous=null
   held.hidden=true
   page.classList.remove('second-egg-wiping')
  })
 }
 grab.addEventListener('keydown',event=>{
  const direction={ArrowLeft:[-.055,0],ArrowRight:[.055,0],ArrowUp:[0,-.08],ArrowDown:[0,.08]}[event.key]
  if(!ready||finished||pointer!==null||!direction)return
  event.preventDefault()
  keyboardPoint=keyboardPoint.map((value,i)=>Math.max(-.03,Math.min(.99,value+direction[i])))
  held.hidden=false
  stroke(...keyboardPoint)
 })
}
