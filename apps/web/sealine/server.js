const path=require('path');
const os=require('os');
const crypto=require('crypto');
const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const QRCode=require('./vendor/QRCode');
const app=express();
const server=http.createServer(app);
const io=new Server(server);
const PORT=process.env.PORT||3000;
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

const users=[
{id:'mervin',name:'Mervin Roger',role:'owner'},
{id:'pravan',name:'Pravan',role:'admin'},
{id:'satheesh',name:'Satheesh',role:'member'},
{id:'rajesh',name:'Rajesh',role:'member'},
{id:'krisha',name:'Krisha',role:'member'},
{id:'jenslin',name:'Jenslin',role:'member'},
{id:'arun',name:'Arun Kumar',role:'member'},
{id:'deepak',name:'Deepak',role:'member'},
{id:'naveen',name:'Naveen',role:'member'},
{id:'vignesh',name:'Vignesh',role:'member'},
{id:'harish',name:'Harish',role:'member'},
{id:'sanjay',name:'Sanjay',role:'member'},
{id:'karthik',name:'Karthik',role:'member'},
{id:'ashwin',name:'Ashwin',role:'member'},
{id:'rahul',name:'Rahul',role:'member'},
{id:'dinesh',name:'Dinesh',role:'member'}
];
const groups=[{id:'project',name:'Project Group',description:'Sealine project team',memberIds:['mervin','pravan','satheesh','rajesh','krisha','jenslin'],settings:{membersCanMessage:true,membersCanAdd:false}}];
const messages=new Map();
const onlineUsers=new Set();
// QA state for QR-1.3 / 1.4 demo mobile.
const mockPhones=new Map();
const key=(a,b)=>[a,b].sort().join(':');
const groupKey=g=>`group:${g}`;
const user=id=>users.find(u=>u.id===id);
const now=()=>new Date().toISOString();
function seed(){
 if(messages.size)return;
 messages.set(key('mervin','pravan'),[{id:'seed1',from:'pravan',text:'Hi Mervin! Welcome to Sealine.',time:now()}]);
 messages.set(groupKey('project'),[{id:'seed2',from:'pravan',text:'Welcome to the Project Group 👋',time:now()}]);
}
seed();

// QR-1.0 mock API layer: all QR/link/session state lives here, never in the UI.
const qrSessions=new Map();
const webSessions=new Map();
const invalidatedUsers=new Set();
const TTL=60000;
function token(){return crypto.randomBytes(24).toString('hex');}
function lanIps(){
 const out=[];
 for(const ns of Object.values(os.networkInterfaces())) for(const n of ns||[]) {
   if(n.family!=='IPv4'||n.internal) continue;
   const ip=n.address;
   const parts=ip.split('.').map(Number);
   const privateIp=(parts[0]===10)||(parts[0]===192&&parts[1]===168)||(parts[0]===172&&parts[1]>=16&&parts[1]<=31);
   if(privateIp) out.push(ip);
 }
 return [...new Set(out)];
}
function lanIp(){
 const ips=lanIps();
 return ips.find(ip=>ip.startsWith('192.168.')) || ips.find(ip=>ip.startsWith('10.')) || ips.find(ip=>ip.startsWith('172.')) || ips[0] || null;
}
function publicOrigin(req){
 const configured=process.env.PUBLIC_BASE_URL || process.env.SEALINE_PUBLIC_BASE_URL;
 if(configured) return configured.replace(/\/$/,'');
 const host=req.headers.host||`localhost:${PORT}`;
 const hostname=host.split(':')[0];
 const port=host.includes(':')?host.split(':').pop():PORT;
 if(hostname==='localhost'||hostname==='127.0.0.1'||hostname==='0.0.0.0'){
   const ip=lanIp();
   if(ip) return `http://${ip}:${port}`;
 }
 return `${req.protocol}://${host}`;
}
function makeQr(){
 const t=token(); const s={token:t,accountId:'mervin',createdAt:Date.now(),expiresAt:Date.now()+TTL,status:'active',webToken:null};
 qrSessions.set(t,s); return s;
}
function activeQr(){
 for(const [t,s] of qrSessions){if(Date.now()>s.expiresAt){qrSessions.delete(t);continue;} if(s.status==='active')return s;}
 return makeQr();
}
function pngDataUrl(text){
 const zlib=require('zlib');
 const qr=new QRCode(0,2); // High error correction for reliable phone-camera scanning.
 qr.addData(text); qr.make();
 const n=qr.getModuleCount(), scale=10, quiet=8, size=(n+quiet*2)*scale;
 const raw=Buffer.alloc(size*(size*4+1));
 let o=0;
 for(let y=0;y<size;y++){
   raw[o++]=0;
   const mr=Math.floor(y/scale)-quiet;
   for(let x=0;x<size;x++){
     const mc=Math.floor(x/scale)-quiet;
     const dark=mr>=0&&mc>=0&&mr<n&&mc<n&&qr.isDark(mr,mc);
     raw[o++]=dark?0:255; raw[o++]=dark?0:255; raw[o++]=dark?0:255; raw[o++]=255;
   }
 }
 function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
 function chunk(type,data){const t=Buffer.from(type);const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,data])),8+data.length);return out}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 return 'data:image/png;base64,'+png.toString('base64');
}
function findQr(t){const s=qrSessions.get(t);if(!s)return null;if(Date.now()>s.expiresAt){qrSessions.delete(t);return null;}return s;}
function invalidateWebForUser(uid,reason='new_phone_login'){
 for(const [wt,s] of webSessions){if(s.userId===uid){webSessions.delete(wt);io.to(`web:${wt}`).emit('webForceLoggedOut',{reason});}}
 // Do not mark the user globally: the newly-created Web session must not
 // immediately invalidate itself. Existing live Web sessions were already
 // notified above.
}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'Sealine Chat',users:users.length,groups:groups.length,socketio:true}));
app.get('/api/users',(req,res)=>res.json(users));
app.get('/api/groups',(req,res)=>res.json(groups.map(g=>({...g,members:g.memberIds.map(user)}))));
app.get('/api/messages/:a/:b',(req,res)=>res.json(messages.get(key(req.params.a,req.params.b))||[]));
app.get('/api/group-messages/:id',(req,res)=>res.json(messages.get(groupKey(req.params.id))||[]));
app.post('/api/messages/send', (req,res)=>{
 const {from,type,to,groupId,text}=req.body||{};
 if(!user(from)||!String(text||'').trim()) return res.status(400).json({ok:false,error:'bad_message'});
 const msg={id:Date.now()+Math.random(),from,text:String(text).trim().slice(0,4000),time:now()};
 if(type==='direct'){
   if(!user(to)) return res.status(404).json({ok:false,error:'user_not_found'});
   const k=key(from,to); if(!messages.has(k)) messages.set(k,[]); messages.get(k).push(msg);
   io.to(`dm:${k}`).emit('message',msg); io.to(`user:${to}`).emit('message',msg);
 } else if(type==='group'){
   const g=groups.find(x=>x.id===groupId); if(!g||!g.memberIds.includes(from)) return res.status(403).json({ok:false,error:'not_member'});
   const k=groupKey(g.id); if(!messages.has(k)) messages.set(k,[]); messages.get(k).push(msg);
   io.to(`group:${g.id}`).emit('message',msg);
   for(const uid of g.memberIds) io.to(`user:${uid}`).emit('message',msg);
 } else return res.status(400).json({ok:false,error:'bad_type'});
 res.json({ok:true,message:msg});
});

app.get('/api/recent-chats/:id',(req,res)=>{
 const uid=req.params.id,items=[];
 for(const u of users){if(u.id===uid)continue;const arr=messages.get(key(uid,u.id))||[];if(arr.length){const last=arr[arr.length-1];items.push({type:'direct',id:u.id,name:u.name,preview:last.text,time:last.time,online:onlineUsers.has(u.id)});}}
 for(const g of groups){const arr=messages.get(groupKey(g.id))||[];if(arr.length){const last=arr[arr.length-1];items.push({type:'group',id:g.id,name:g.name,preview:last.text,time:last.time,online:false});}}
 items.sort((a,b)=>new Date(b.time)-new Date(a.time));res.json({items});
});

app.get('/api/link/new',(req,res)=>{
 // Only one live QR at a time. Old active QR is replaced automatically.
 for(const [t,s] of qrSessions){if(s.status==='active'){s.status='replaced';io.to(`qr:${t}`).emit('qrExpired',{reason:'replaced'});}}
 const s=makeQr();
 const linkUrl=`${publicOrigin(req)}/phone/link/${encodeURIComponent(s.token)}`;
 const qrDataUrl=pngDataUrl(linkUrl);
 res.json({ok:true,sessionId:s.token,token:s.token,expiresAt:s.expiresAt,linkUrl,qrDataUrl});
});
app.get('/api/link/:token',(req,res)=>{
 const s=findQr(req.params.token); if(!s)return res.status(410).json({ok:false,error:'This QR has expired or is no longer valid.'});
 if(s.status!=='active')return res.status(410).json({ok:false,error:'This QR has already been used.'});
 res.json({ok:true,accountName:user(s.accountId).name,accountHint:'Sealine account',expiresAt:s.expiresAt});
});
app.post('/api/link/:token/confirm',(req,res)=>{
 const s=findQr(req.params.token); if(!s)return res.status(410).json({ok:false,error:'This QR has expired or is no longer valid.'});
 if(s.status!=='active')return res.status(410).json({ok:false,error:'This QR has already been used.'});
 s.status='linking';
 setTimeout(()=>{
   const current=qrSessions.get(s.token); if(!current||current.status!=='linking')return;
   invalidateWebForUser(current.accountId,'new_phone_login');
   current.status='linked'; current.linkedAt=Date.now(); current.webToken=token();
   webSessions.set(current.webToken,{userId:current.accountId,linkedAt:current.linkedAt,qrToken:current.token});
   io.to(`qr:${current.token}`).emit('accountLinked',{webToken:current.webToken,userId:current.accountId});
 },650);
 res.json({ok:true,state:'linking'});
});
app.get('/phone/link/:token',(req,res)=>res.sendFile(path.join(__dirname,'public','phone.html')));
app.get('/api/session/validate/:webToken',(req,res)=>{
 const s=webSessions.get(req.params.webToken); if(!s)return res.status(401).json({ok:false,error:'session_invalid'});res.json({ok:true,userId:s.userId});
});
// QR demo mobile controls. They simulate the linked phone only; Web remains independent.
app.get('/api/mock/phone-status/:userId',(req,res)=>{const st=mockPhones.get(req.params.userId)||{online:true,missed:[]};res.json({ok:true,online:st.online,missed:st.missed.length});});
app.post('/api/mock/phone-offline',(req,res)=>{const uid=req.body?.userId||'mervin';const st=mockPhones.get(uid)||{online:true,missed:[]};st.online=false;mockPhones.set(uid,st);io.to(`user:${uid}`).emit('mockPhoneStatus',{online:false});res.json({ok:true,online:false});});
app.post('/api/mock/phone-message',(req,res)=>{const uid=req.body?.userId||'mervin';const text=String(req.body?.text||'Message received while the demo phone was offline.').trim();const st=mockPhones.get(uid)||{online:true,missed:[]};const msg={id:Date.now()+Math.random(),from:'pravan',text,time:now(),demo:true};const k=key(uid,'pravan');if(!messages.has(k))messages.set(k,[]);messages.get(k).push(msg);if(!st.online)st.missed.push(msg);else io.to(`user:${uid}`).emit('mockIncomingMessage',msg);mockPhones.set(uid,st);res.json({ok:true,queued:!st.online,message:msg});});
app.post('/api/mock/phone-online',(req,res)=>{const uid=req.body?.userId||'mervin';const st=mockPhones.get(uid)||{online:true,missed:[]};st.online=true;const missed=[...st.missed];st.missed=[];mockPhones.set(uid,st);io.to(`user:${uid}`).emit('mockPhoneStatus',{online:true});for(const msg of missed)io.to(`user:${uid}`).emit('mockIncomingMessage',msg);res.json({ok:true,online:true,synced:missed.length,messages:missed});});

app.post('/api/session/logout',(req,res)=>{const s=webSessions.get(req.body?.webToken);if(s){webSessions.delete(req.body.webToken);io.to(`web:${req.body.webToken}`).emit('webLoggedOff',{ok:true});}res.json({ok:true});});
// QA hook for QR-1.7: simulate a brand-new phone login.
app.post('/api/mock/new-phone-login',(req,res)=>{invalidateWebForUser(req.body?.userId||'mervin','new_phone_login');res.json({ok:true});});

io.on('connection',socket=>{
 const q=socket.handshake.query||{};
 if(q.qrSession){socket.join(`qr:${q.qrSession}`);}
 if(q.webToken){socket.join(`web:${q.webToken}`);const ws=webSessions.get(q.webToken);if(ws)socket.join(`user:${ws.userId}`);}
 socket.on('join',(data,ack)=>{
   const uid=data?.userId;if(!user(uid))return ack?.({ok:false,error:'unknown_user'});
   socket.userId=uid;socket.join(`user:${uid}`);onlineUsers.add(uid);io.emit('presenceChanged',{userId:uid,online:true});
   if(invalidatedUsers.has(uid)){socket.emit('webForceLoggedOut',{reason:'new_phone_login'});invalidatedUsers.delete(uid);}
   ack?.({ok:true,user:user(uid)});
 });
 socket.on('joinConversation',(data,ack)=>{if(!socket.userId)return ack?.({ok:false,error:'not_joined'});if(data.type==='direct'){socket.join(`dm:${key(socket.userId,data.with)}`);return ack?.({ok:true});}if(data.type==='group'){const g=groups.find(x=>x.id===data.groupId);if(!g||!g.memberIds.includes(socket.userId))return ack?.({ok:false,error:'not_member'});socket.join(`group:${g.id}`);return ack?.({ok:true});}ack?.({ok:false,error:'bad_type'});});
 socket.on('sendMessage',(data,ack)=>{if(!socket.userId||!data?.text?.trim())return ack?.({ok:false,error:'bad_message'});const msg={id:Date.now()+Math.random(),from:socket.userId,text:String(data.text).trim().slice(0,4000),time:now()};if(data.type==='direct'){const other=user(data.to);if(!other)return ack?.({ok:false,error:'user_not_found'});const k=key(socket.userId,data.to);if(!messages.has(k))messages.set(k,[]);messages.get(k).push(msg);io.to(`dm:${k}`).emit('message',msg);ack?.({ok:true,message:msg});}else if(data.type==='group'){const g=groups.find(x=>x.id===data.groupId);if(!g||!g.memberIds.includes(socket.userId))return ack?.({ok:false,error:'not_member'});const k=groupKey(g.id);if(!messages.has(k))messages.set(k,[]);messages.get(k).push(msg);io.to(`group:${g.id}`).emit('message',msg);ack?.({ok:true,message:msg});}else ack?.({ok:false,error:'bad_type'});});
 socket.on('groupSetting',(data,ack)=>{if(!socket.userId)return ack?.({ok:false,error:'not_joined'});const g=groups.find(x=>x.id===data.groupId),me=user(socket.userId);if(!g||!me||!g.memberIds.includes(me.id))return ack?.({ok:false,error:'not_allowed'});if(!['owner','admin'].includes(me.role))return ack?.({ok:false,error:'admin_only'});if(data.name==='membersCanMessage'||data.name==='membersCanAdd')g.settings[data.name]=!!data.value;else return ack?.({ok:false,error:'unknown_setting'});io.to(`group:${g.id}`).emit('groupUpdated',g);ack?.({ok:true,group:g});});
 socket.on('changeRole',(data,ack)=>{const me=user(socket.userId);if(!me||me.role!=='owner')return ack?.({ok:false,error:'owner_only'});const target=user(data.userId);if(!target||target.id==='mervin')return ack?.({ok:false,error:'cannot_change'});target.role=data.role==='admin'?'admin':'member';io.emit('usersUpdated',users);ack?.({ok:true});});
 socket.on('disconnect',()=>{if(socket.userId){const stillOnline=[...io.sockets.sockets.values()].some(s=>s.userId===socket.userId);if(!stillOnline){onlineUsers.delete(socket.userId);io.emit('presenceChanged',{userId:socket.userId,online:false});}}});
});

server.listen(PORT,'0.0.0.0',()=>{console.log(`Sealine running: http://localhost:${PORT}`);console.log(`LAN: ${lanIps().map(ip=>`http://${ip}:${PORT}`).join(' | ')||'No private LAN IPv4 found'}`);console.log('QR base: '+(process.env.PUBLIC_BASE_URL||process.env.SEALINE_PUBLIC_BASE_URL||'auto-detected LAN address'));});
