// Sandboxed preload: a read-only marker plus one signal, ready(), which the page sends once the designer has painted so
// the window opens on it instead of on a blank frame. Add narrow IPC here later (e.g. a lead submitter), never Node APIs.
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('deckcraftDesktop',Object.freeze({platform:process.platform,shell:'electron',ready:()=>ipcRenderer.send('deckcraft:ready')}));
