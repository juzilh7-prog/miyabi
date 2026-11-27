'use strict';

(() => {
 const progress=document.getElementById('egg-progress-bar')
 const modal=document.getElementById('progress-award')
 if(!progress||!modal)return
 const awards=[
  [20,'知桔者奖','恭喜你，正式踏入桔子的世界。'],
  [40,'知桔分子奖','桔子学入门考试顺利通过。'],
  [60,'桔密知情人奖','已获得桔子内部机密查阅权限。'],
  [75,'了如桔掌奖','对桔子的了解程度已超越普通人。'],
  [90,'桔世无双奖','在桔子研究领域展现出非凡天赋。'],
  [95,'桔对了解奖','距离完全读懂一颗桔子，仅剩一步之遥。'],
  [100,'最佳剥桔人奖','不止认识桔子，也懂得桔子皮下的柔软。']
 ]
 const artwork=modal.querySelector('img')
 const heading=modal.querySelector('h2')
 const copy=modal.querySelector('p')
 const queue=[]
 let next=0
 function showNext(){
  if(modal.open||!queue.length)return
  const [threshold,name,description]=queue.shift()
  artwork.src='media/progress-awards/'+threshold+'.webp'
  heading.textContent=name
  copy.textContent=description
  modal.showModal()
 }
 function check(){
  while(next<awards.length&&progress.value>=awards[next][0]){
   queue.push(awards[next++])
  }
  showNext()
 }
 modal.querySelector('button').addEventListener('click',()=>modal.close())
 modal.addEventListener('close',showNext)
 new MutationObserver(check).observe(progress,{attributes:true,attributeFilter:['value']})
 check()
})()
