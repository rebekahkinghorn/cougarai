const page=document.body.dataset.page;
if(window.self!==window.top)document.body.classList.add('embed');
const links=[['index.html','Welcome','home'],['chatbot.html','Chatbot','chat'],['faq.html','FAQ','faq'],['calendar.html','Calendar','cal']];
document.body.insertAdjacentHTML('afterbegin',`<nav><a class="logo" href="index.html">BYU Freshman Guide</a><button id="burger" aria-label="Menu">&#9776;</button><ul id="menu">${links.map(l=>`<li><a href="${l[0]}" class="${l[2]===page?'active':''}">${l[1]}</a></li>`).join('')}</ul></nav>`);
document.getElementById('burger').onclick=()=>document.getElementById('menu').classList.toggle('open');
document.body.insertAdjacentHTML('beforeend',`
${page!=='chat'?'<button class="fab" id="fab" aria-label="Open chatbot">&#128172;</button><div class="overlay" id="chatOv"><div class="modal big"><button class="close" id="chatX">&times;</button><iframe src="chatbot.html" title="Chatbot"></iframe></div></div>':''}
<footer><button id="rep">Report an Issue</button></footer>
<div class="overlay" id="repOv"><div class="modal"><button class="close" id="repX">&times;</button><h2>Report an Issue</h2><textarea id="repTxt" rows="5" placeholder="Describe the issue..."></textarea><div id="repMsg" class="error"></div><button class="btn" id="repSend">Submit</button></div></div>`);
const $=id=>document.getElementById(id);
if($('fab')){$('fab').onclick=()=>$('chatOv').classList.add('open');$('chatX').onclick=()=>$('chatOv').classList.remove('open');}
$('rep').onclick=()=>$('repOv').classList.add('open');
$('repX').onclick=()=>$('repOv').classList.remove('open');
$('repSend').onclick=()=>{const t=$('repTxt').value.trim(),m=$('repMsg');
 if(!t){m.className='error';m.textContent='Error: your report was not received. Please enter a description and try again.';return;}
 m.className='ok';m.textContent='Thank you! Your report was received.';$('repTxt').value='';};
