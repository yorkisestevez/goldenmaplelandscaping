// DeckCraft desktop shell. Serves the standalone build (dist/deckcraft) over a private app:// scheme, never a remote URL.
// Renderer is locked down: contextIsolation, sandbox, no nodeIntegration, strict CSP, no new windows, no navigation away.
const {app,BrowserWindow,ipcMain,protocol,session,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {createAppHandler}=require('./appServer.cjs');

const ROOT=app.isPackaged?path.join(process.resourcesPath,'deckcraft'):path.resolve(__dirname,'../../dist/deckcraft');
const ORIGIN='app://deckcraft';
// The window opens when the designer has painted (preload's ready()); this only covers a renderer that never says so.
const SHOW_ANYWAY_MS=8000;

protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,codeCache:true}}]);
app.enableSandbox();

function createWindow(){
  const win=new BrowserWindow({width:1440,height:900,title:'DeckCraft',icon:path.join(__dirname,'build','icon.png'),backgroundColor:'#1f2326',show:false,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:false,preload:path.join(__dirname,'preload.cjs')}});
  const show=()=>{clearTimeout(fallback);ipcMain.removeListener('deckcraft:ready',onReady);if(!win.isDestroyed()&&!win.isVisible())win.show();};
  const onReady=event=>{if(event.sender===win.webContents)show();};
  const fallback=setTimeout(show,SHOW_ANYWAY_MS);
  ipcMain.on('deckcraft:ready',onReady);
  win.on('closed',()=>{clearTimeout(fallback);ipcMain.removeListener('deckcraft:ready',onReady);});
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))void shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(ORIGIN))e.preventDefault();});
  void win.loadURL(`${ORIGIN}/`);
  return win;
}

app.whenReady().then(()=>{
  if(!fs.existsSync(path.join(ROOT,'index.html'))){console.error(`DeckCraft build not found at ${ROOT}. Run npm run build:deckcraft first.`);app.exit(1);return;}
  // Read from disk directly (not net.fetch(file://), which the request filter below blocks).
  protocol.handle('app',createAppHandler(ROOT));
  // Block every network and file request (no remote fonts, analytics or APIs). Filtered by URL so the app's own
  // app://, data: and blob: requests never make the round trip to this listener.
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(_details,cb)=>cb({cancel:true}));
  session.defaultSession.setPermissionRequestHandler((_wc,permission,cb)=>cb(permission==='clipboard-sanitized-write'));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
