// Configuration only. No credentials, network calls or paid provider transport.
const PROVIDERS=Object.freeze({
 openai:{origin:'https://api.openai.com',path:'/v1/chat/completions',credential_variable:'MM_WEEKEND_OPENAI_KEY'},
 kimi:{origin:'https://api.moonshot.ai',path:'/v1/chat/completions',credential_variable:'MM_WEEKEND_KIMI_KEY'},
 openrouter:{origin:'https://openrouter.ai',path:'/api/v1/chat/completions',credential_variable:'MM_WEEKEND_OPENROUTER_KEY'},
 gemini:{origin:'https://generativelanguage.googleapis.com',path:null,credential_variable:'MM_WEEKEND_GEMINI_KEY'}
});
export function providerConfiguration({provider=null,model=null}={}){
 if(provider!==null&&!Object.hasOwn(PROVIDERS,provider))throw Error('unsupported AI provider');
 if(model!==null&&(typeof model!=='string'||!model.trim()))throw Error('invalid model selection');
 return{provider,model,...(provider?PROVIDERS[provider]:{}),paid_transport_enabled:false,verified_price:null,
  budget_ceiling_micros:5000000,grounding_enabled:false,automatic_retries:0,
  blocker:provider?'account_model_prices_permissions_and_budget_authority_unverified':'owner_provider_selection_pending'};
}
