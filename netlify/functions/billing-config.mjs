import {json,onlyMethod,errorResponse} from './lib/core.mjs';
export default async (request)=>{try{
  onlyMethod(request,'GET');
  const configured=!!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.STRIPE_API_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const sandbox=process.env.STRIPE_TEST_MODE!=='false';
  const key=process.env.STRIPE_API_KEY||'';
  const usable=configured && (sandbox?/^(sk|rk)_test_/.test(key):/^(sk|rk)_live_/.test(key));
  return json({configured:usable,testMode:sandbox,supabaseUrl:process.env.SUPABASE_URL||'',supabaseAnonKey:process.env.SUPABASE_ANON_KEY||'',prices:{Pro:{month:!!process.env.STRIPE_PRICE_PRO_MONTH,year:!!process.env.STRIPE_PRICE_PRO_YEAR},Elite:{month:!!process.env.STRIPE_PRICE_ELITE_MONTH,year:!!process.env.STRIPE_PRICE_ELITE_YEAR}}});
}catch(e){return errorResponse(e)}};
