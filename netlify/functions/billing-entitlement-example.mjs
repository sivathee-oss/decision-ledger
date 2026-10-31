// Example of actual server-side enforcement for a future cloud-backed premium endpoint.
import {json,errorResponse,onlyMethod,requireUser,supabaseAdmin,ownedWorkspace,canUsePremium,fail} from './lib/core.mjs';
export default async(request)=>{try{
  onlyMethod(request,'GET');const db=supabaseAdmin(),user=await requireUser(request,db);
  const workspace=await ownedWorkspace(db,user,new URL(request.url).searchParams.get('workspace_id'));
  if(!canUsePremium(workspace))fail('A paid subscription is required',403);
  return json({authorized:true,workspace_id:workspace.id,plan:workspace.plan,message:'Protected endpoint authorization succeeded. No premium data is hosted by this example.'});
}catch(e){return errorResponse(e)}};
