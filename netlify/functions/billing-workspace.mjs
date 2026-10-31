import {json,onlyMethod,errorResponse,bodyJSON,requireUser,supabaseAdmin,isUUID,fail} from './lib/core.mjs';
export default async (request)=>{try{
  onlyMethod(request,'POST');const db=supabaseAdmin(),user=await requireUser(request,db),body=await bodyJSON(request);
  if(!isUUID(body.workspace_id))fail('Invalid workspace ID');
  const displayName=String(body.name||'Decision Ledger workspace').trim().slice(0,120);
  if(!displayName)fail('Workspace name is required');
  const {data:existing,error:lookupError}=await db.from('billing_workspaces').select('id,owner_id').eq('id',body.workspace_id).maybeSingle();
  if(lookupError)throw lookupError;
  if(existing){if(existing.owner_id!==user.id)fail('Workspace is owned by another account',403);return json({id:existing.id,linked:true})}
  const {data,error}=await db.from('billing_workspaces').insert({id:body.workspace_id,owner_id:user.id,display_name:displayName}).select('id').single();
  if(error){if(error.code==='23505')fail('Workspace already claimed',409);throw error}
  return json({id:data.id,linked:true},201);
}catch(e){return errorResponse(e)}};
