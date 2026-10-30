export const GEMINI='google/gemini-3-flash-preview';
export const LITE='google/gemini-3.1-flash-lite';
export function geminiCatalog(model=GEMINI){
 const lite=model===LITE;
 return{data:{id:model,endpoints:[{model_id:model,tag:'google-ai-studio',provider_name:'Google AI Studio',service_tier:null,status:0,context_length:1048576,max_completion_tokens:65536,max_prompt_tokens:null,supports_implicit_caching:false,supported_parameters:['reasoning','max_tokens','response_format','structured_outputs','tools','tool_choice'],supports_tool_choice:{none:true},pricing:{prompt:lite?'0.00000025':'0.0000005',completion:lite?'0.0000015':'0.000003',internal_reasoning:lite?'0.0000015':'0.000003',image:'0.0000005',audio:'0.000001',input_audio_cache:'0.0000001',web_search:'0.014',input_cache_read:'0.00000005',input_cache_write:'0.0000000833333333333333',discount:0}}]}};
}
