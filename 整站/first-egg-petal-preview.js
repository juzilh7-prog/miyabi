'use strict'

const handPetalKey='egg1-hand-petal'
if(document.body.hasAttribute('data-preview-first-egg')){
 exploreActions.add('egg2-move-glasses')
 exploreActions.add('egg2-lift-hanky')
}
exploreActions.add(handPetalKey)

function addHandPetalPreview(){
 const page=stage.querySelector('.page[data-index="27"]')
 if(!page||page.querySelector('.hand-petal-preview'))return
 const girl=window.MiYaBiFirstEggLayout.find(item=>item.name==='人物与小狐狸.png')
 if(!girl)return
 const crop={x:620,y:525,w:162,h:100}
 const button=control(element('button','hand-petal-preview'),'小人手里的桔瓣',event=>{
  event.stopPropagation()
  recordInteraction(handPetalKey)
  button.setAttribute('aria-pressed','true')
 })
 applyBox(button,{
  x:girl.x+girl.w*crop.x/1312,y:girl.y+girl.h*crop.y/1199,
  w:girl.w*crop.w/1312,h:girl.h*crop.h/1199
 })
 button.setAttribute('aria-pressed',String(explored.has(handPetalKey)))
 const petal=image(girl.url)
 Object.assign(petal.style,{
  width:1312/crop.w*100+'%',height:1199/crop.h*100+'%',
  left:-crop.x/crop.w*100+'%',top:-crop.y/crop.h*100+'%'
 })
 const shape=element('span')
 shape.append(petal)
 button.append(shape)
 page.append(button)
}
new MutationObserver(addHandPetalPreview).observe(stage,{childList:true})
addHandPetalPreview()
