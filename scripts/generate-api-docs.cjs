const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const getDec=(n)=>ts.canHaveDecorators(n)?(ts.getDecorators(n)||[]):[];
const callName=(d)=>ts.isCallExpression(d.expression)?d.expression.expression.getText():d.expression.getText();
const args=(d)=>d&&ts.isCallExpression(d.expression)?d.expression.arguments.map(a=>ts.isStringLiteral(a)?a.text:a.getText()):[];
const dec=(n,name)=>getDec(n).find(d=>callName(d)===name);
const role=(n)=>dec(n,'Public')?'Public':dec(n,'Roles')?args(dec(n,'Roles')).join(', '):null;
const dir='src/model';
const files=fs.readdirSync(dir).flatMap(d=>fs.statSync(path.join(dir,d)).isDirectory()?fs.readdirSync(path.join(dir,d)).filter(f=>f.endsWith('.controller.ts')).map(f=>path.join(dir,d,f)):[]).sort();
const lines=['# Endpoint reference','','Generated from current controller source. Do not edit manually. Run `npm run docs:generate`.','','All URLs are relative to the commerce API base URL. Public routes do not require a Bearer token; the Payment Service webhook requires a valid signature. Protected routes require a valid Accounts Service access JWT. DTO names link to the contract in Swagger and source. A customer route is scoped to the current actor where applicable.','',''];
let count=0;
for(const file of files){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 for(const n of source.statements){
  if(!ts.isClassDeclaration(n)||!dec(n,'Controller'))continue;
  const base=args(dec(n,'Controller'))[0]||'';
  lines.push('## '+base,'','Source: [`'+file+'`](../../'+file+')','','| Method | Path | Access | Input | Handler |','|---|---|---|---|---|');
  for(const m of n.members){
   if(!ts.isMethodDeclaration(m))continue;
   const route=getDec(m).find(d=>['Get','Post','Put','Patch','Delete','Head'].includes(callName(d)));
   if(!route)continue;
   const method=callName(route).toUpperCase();
   const url='/'+[base,args(route)[0]||''].join('/').split('/').filter(Boolean).join('/');
   const permissions=args(dec(m,'Permissions')||dec(n,'Permissions'))||[];
   const access=(role(m)||role(n)||'DENIED (unclassified)')+(permissions.length?' + '+permissions.join(', '):'');
   const input=m.parameters.flatMap(p=>getDec(p).filter(d=>['Body','Query','Param','Headers','UploadedFile'].includes(callName(d))).map(d=>callName(d)+ (args(d).length?' '+args(d).join(', '):'')+': '+(p.type?.getText()||'unknown'))).join('; ').replace(/\|/g,'\\|');
   lines.push('| '+method+' | `'+url+'` | '+access+' | '+(input||'—')+' | `'+m.name.getText()+'` |');count++;
  }
  lines.push('');
 }
}
lines.splice(6,0,'**'+count+' endpoints.**','');
fs.mkdirSync('docs/api-documentation',{recursive:true});
fs.writeFileSync('docs/api-documentation/endpoints.md',lines.join('\n')+'\n');
console.log(count+' endpoints documented');
