const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(['/admin','/user'].includes(url.pathname)){
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="assets\/js\/main.js[^"]*"><\/script>/,match=>'<script src="tests/session-fixture.js"></script>'+match);
    res.setHeader('Content-Type','text/html');return res.end(html);
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');
  res.end(fs.readFileSync(file));
}).listen(8766,'127.0.0.1',()=>console.log('Fixture server on http://127.0.0.1:8766/admin'));
