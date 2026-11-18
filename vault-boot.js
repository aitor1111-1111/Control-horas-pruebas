/* Secure local vault bootstrap. Loaded before the application module. */
import './crypto-vault.js';
(() => {
'use strict';
const KEYS=['horas_productividad_v1','horas_productividad_rates_v1','horas_productividad_planned_v1'];
const VAULT_KEY='control_horas_encrypted_v1';
const native={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem};
let vault=null, master=null, values={}, queue=Promise.resolve(), lastActivity=Date.now(), lockTimer=null, saveError=null, revision=0, savedRevision=0;
const $=id=>document.getElementById(id);
function screen(){
 if($('vaultScreen')) return;
 const el=document.createElement('section'); el.id='vaultScreen'; el.innerHTML=`
 <div class="vault-panel"><div class="vault-mark">🔐</div><h1>Control de Horas protegido</h1>
 <p id="vaultMessage">Tus datos están cifrados en este dispositivo.</p>
 <form id="vaultForm"><label id="vaultLabel" for="vaultSecret">Contraseña</label>
 <input id="vaultSecret" type="password" minlength="12" autocomplete="current-password" required>
 <div id="vaultConfirmWrap" class="vault-hidden"><label for="vaultConfirm">Repite la contraseña</label><input id="vaultConfirm" type="password" minlength="12" autocomplete="new-password"></div>
 <button id="vaultSubmit" type="submit">Desbloquear</button></form>
 <button id="vaultRecovery" class="vault-link" type="button">Usar código de recuperación</button>
 <p id="vaultError" role="alert"></p><div id="vaultRecoveryPanel" class="vault-hidden">
 <p>Introduce tu código de recuperación.</p><input id="vaultRecoveryInput" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX">
 <button id="vaultRecoverySubmit" type="button">Recuperar acceso</button></div>
 <div id="vaultCodePanel" class="vault-hidden"><h2>Guarda tu código de recuperación</h2>
 <p>Guárdalo fuera del móvil. Si olvidas la contraseña, este código es la única forma de recuperar los datos.</p>
 <code id="vaultCode"></code><button id="vaultCopy" type="button">Copiar código</button>
 <label class="vault-check"><input id="vaultSaved" type="checkbox"> He guardado el código en un lugar seguro</label>
 <button id="vaultContinue" type="button" disabled>Continuar</button></div>
 <small>El cifrado se realiza en este navegador. No envíes tu contraseña ni tu código por chat.</small></div>`;
 document.body.append(el);
}
function showError(e){const message=e?.message||'No se ha podido guardar el almacén cifrado.';const el=$('vaultError');if(el){el.textContent=message;return;}console.error('Error del almacén cifrado:',e);window.dispatchEvent(new CustomEvent('vault-error',{detail:message}));}
function saveVault(){
 const task=queue.catch(()=>{}).then(async()=>{
  if(!vault||!master) throw new Error('La caja fuerte aún no está desbloqueada.');
  const target=revision;
  const snapshot=JSON.parse(JSON.stringify(values));
  const next=await window.LocalEncryptedVault.update(vault,master,snapshot);
  const serialized=JSON.stringify(next);
  native.set.call(localStorage,VAULT_KEY,serialized);
  const check=native.get.call(localStorage,VAULT_KEY);
  if(check!==serialized) throw new Error('El navegador no ha confirmado el guardado cifrado.');
  vault=next;
  savedRevision=target;
  saveError=null;
 });
 queue=task.catch(err=>{saveError=err;});
 return task;
}
async function flushVault(){
 while(savedRevision<revision){
  await saveVault();
 }
 if(saveError) throw saveError;
 return true;
}
async function writeVault(key,value){
 if(!KEYS.includes(String(key))) throw new Error('Clave de almacenamiento no permitida.');
 values[key]=String(value);
 revision++;
 await flushVault();
 return true;
}
function installStorage(){
 Storage.prototype.getItem=function(k){return KEYS.includes(String(k))? (Object.prototype.hasOwnProperty.call(values,k)?values[k]:null):native.get.call(this,k)};
 Storage.prototype.setItem=function(k,v){if(KEYS.includes(String(k))){values[k]=String(v);revision++;saveVault().catch(showError);return;}return native.set.call(this,k,v)};
 Storage.prototype.removeItem=function(k){if(KEYS.includes(String(k))){delete values[k];revision++;saveVault().catch(showError);return;}return native.remove.call(this,k)};
}
function touch(){
 lastActivity=Date.now(); clearTimeout(lockTimer);
 lockTimer=setTimeout(async()=>{try{await flushVault();location.reload()}catch(e){showError(e)}},300000);
}
function activate(){
 installStorage(); document.body.classList.add('vault-unlocked'); $('vaultScreen').remove();
 ['pointerdown','keydown','touchstart','click'].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
 document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&Date.now()-lastActivity>=300000){try{await flushVault();location.reload()}catch(e){showError(e)}}else touch()});
 touch();
}
async function finishUnlock(result){
 master=result.masterRaw; values=result.data;
 for(const k of KEYS) if(typeof values[k]!=='string') values[k]=null;
 for(const k of KEYS) native.remove.call(localStorage,k);
 activate();
}
async function start(){
 screen();
 if(!crypto?.subtle) throw new Error('Este navegador no admite el cifrado necesario. Abre la aplicación con HTTPS en Chrome actualizado.');
 const raw=native.get.call(localStorage,VAULT_KEY);
 if(raw){
  try{vault=JSON.parse(raw)}catch{throw new Error('El almacén cifrado está dañado. No borres los datos del navegador.')}
  $('vaultForm').onsubmit=async e=>{e.preventDefault();$('vaultError').textContent='';try{await finishUnlock(await window.LocalEncryptedVault.unlockWithPassword(vault,$('vaultSecret').value))}catch(err){showError(new Error('Contraseña incorrecta o datos dañados.'))}};
  $('vaultRecovery').onclick=()=>{$('vaultRecoveryPanel').classList.remove('vault-hidden');$('vaultRecoveryInput').focus()};
  $('vaultRecoverySubmit').onclick=async()=>{try{await finishUnlock(await window.LocalEncryptedVault.unlockWithRecovery(vault,$('vaultRecoveryInput').value))}catch(e){showError(new Error('Código incorrecto o datos dañados.'))}};
  return;
 }
 const legacy={}; for(const k of KEYS) legacy[k]=native.get.call(localStorage,k);
 const initial={...legacy};
 if(initial.horas_productividad_v1===null) initial.horas_productividad_v1='[]';
 if(initial.horas_productividad_rates_v1===null) initial.horas_productividad_rates_v1='null';
 if(initial.horas_productividad_planned_v1===null) initial.horas_productividad_planned_v1='[]';
 $('vaultMessage').textContent='Configura una contraseña para cifrar tus datos actuales.';
 $('vaultLabel').textContent='Nueva contraseña (mínimo 12 caracteres)';
 $('vaultSecret').autocomplete='new-password';
 $('vaultConfirmWrap').classList.remove('vault-hidden');
 $('vaultSubmit').textContent='Crear protección';
 $('vaultRecovery').classList.add('vault-hidden');
 $('vaultForm').onsubmit=async e=>{e.preventDefault();$('vaultError').textContent='';
 const pw=$('vaultSecret').value;if(pw.length<12){showError(new Error('Usa al menos 12 caracteres.'));return}
 if(pw!==$('vaultConfirm').value){showError(new Error('Las contraseñas no coinciden.'));return}
 try{
  const made=await window.LocalEncryptedVault.create(pw,initial);
  const check=await window.LocalEncryptedVault.unlockWithPassword(made.vault,pw);
  const checkText=JSON.stringify(check.data);
  if(checkText!==JSON.stringify(initial)) throw new Error('No se pudo verificar la migración.');
  native.set.call(localStorage,VAULT_KEY,JSON.stringify(made.vault));
  const persisted=JSON.parse(native.get.call(localStorage,VAULT_KEY));
  await window.LocalEncryptedVault.unlockWithPassword(persisted,pw);
  vault=persisted;master=made.masterRaw;values=initial;
  $('vaultCode').textContent=made.recoveryCode;
  $('vaultCodePanel').classList.remove('vault-hidden');
  $('vaultForm').classList.add('vault-hidden');
  $('vaultCodePanel').dataset.ready='1';
  $('vaultSaved').onchange=()=>{$('vaultContinue').disabled=!$('vaultSaved').checked};
  $('vaultCopy').onclick=async()=>{try{await navigator.clipboard.writeText(made.recoveryCode);$('vaultCopy').textContent='Copiado'}catch{$('vaultError').textContent='No se pudo copiar. Anótalo manualmente.'}};
  $('vaultContinue').onclick=()=>{if(!$('vaultSaved').checked)return;for(const k of KEYS)native.remove.call(localStorage,k);activate()};
 }catch(err){showError(err)}
 };
}
window.__vaultFlush=flushVault;
window.__vaultWrite=writeVault;
window.__exportEncryptedBackup=async()=>{await flushVault();return native.get.call(localStorage,VAULT_KEY)};
window.__vaultReady=(async()=>{try{await start()}catch(e){screen();showError(e);throw e}})();
})();