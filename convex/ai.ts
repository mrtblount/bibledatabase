/** Native Convex Gateway contract: https://docs.convex.dev/ai-gateway/api */
import {action, query} from './_generated/server';
import {getServiceToken} from 'convex/server';
import {ConvexError, v} from 'convex/values';

function authorize(adminKey: string) {
  const expected = process.env.CONVEX_ADMIN_KEY;
  if (!expected || adminKey !== expected) throw new ConvexError('AI operations require the deployment admin key.');
}
function bounded(value: string, limit: number, label: string) {
  if (!value.trim() || value.length > limit) throw new ConvexError(`${label} must contain 1–${limit} characters.`);
}
async function gateway(path: string, body: unknown) {
  const token = await getServiceToken('ai-gateway');
  const response = await fetch(`https://ai-gateway.convex.dev${path}`, {
    method: 'POST', headers: {'Content-Type':'application/json', Authorization:`Bearer ${token}`},
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new ConvexError(`Convex AI Gateway returned HTTP ${response.status}. Check plan, enabled model, quota and spending limits.`);
  return await response.json();
}

export const availability = query({args:{},handler:async () => ({
  provider:'Convex AI Gateway', native:true, adminConfigured:Boolean(process.env.CONVEX_ADMIN_KEY),
  requiresPaidPlan:true, liveAccessVerified:false, decisionsModel:'typesafe/jev-1.13', decisionsStage:'alpha',
  documentation:'https://docs.convex.dev/ai-gateway/setup',
})});

/** Checking a deployment token does not initiate model inference or expose credentials. */
export const checkAccess = action({args:{adminKey:v.string()},handler:async (_ctx,{adminKey}) => {
  authorize(adminKey);
  await getServiceToken('ai-gateway');
  return {available:true, provider:'Convex AI Gateway', checkedAt:Date.now()};
}});

/** CLI invokes this separately for generation and independent faithfulness checking. */
export const generateJson = action({
  args:{adminKey:v.string(),system:v.string(),user:v.string(),model:v.optional(v.string()),maxTokens:v.optional(v.number())},
  handler:async (_ctx,args) => {
    authorize(args.adminKey); bounded(args.system,12000,'System prompt'); bounded(args.user,80000,'Source input');
    const defaultModel = process.env.BIBLE_AI_MODEL || 'openai/gpt-4o-mini';
    const model = args.model || defaultModel;
    const allowed = (process.env.BIBLE_AI_ALLOWED_MODELS || defaultModel).split(',').map(s=>s.trim());
    if (!allowed.includes(model)) throw new ConvexError('Model is not in BIBLE_AI_ALLOWED_MODELS for this deployment.');
    const maxTokens = args.maxTokens ?? 2048;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096) throw new ConvexError('Output token limit must be 1–4096.');
    const result = await gateway('/v1/chat/completions',{
      model,messages:[{role:'system',content:args.system},{role:'user',content:args.user}],
      response_format:{type:'json_object'},max_tokens:maxTokens,
    });
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new ConvexError('Gateway returned no JSON message.');
    let value;
    try {value=JSON.parse(content);} catch {throw new ConvexError('Gateway returned invalid JSON.');}
    return {value,model:result.model || model,usage:result.usage || null};
  },
});

const questionValidator=v.object({type:v.union(v.literal('choice'),v.literal('score'),v.literal('noul')),instructions:v.string(),criteria:v.optional(v.any())});
/** Jev decisions are typed; it does not generate a Bible answer or search the database itself. */
export const decide = action({
  args:{adminKey:v.string(),state:v.any(),questions:v.record(v.string(),questionValidator)},
  handler:async (_ctx,{adminKey,state,questions}) => {
    authorize(adminKey);
    bounded(JSON.stringify(state),80000,'Decision state');
    const entries=Object.entries(questions);
    if (!entries.length || entries.length>20) throw new ConvexError('A batch must have 1–20 focused questions.');
    for (const [,question] of entries) {
      bounded(question.instructions,4000,'Decision instructions');
      if (question.type==='choice') {
        if (!question.criteria || Array.isArray(question.criteria) || typeof question.criteria!=='object') throw new ConvexError('Choice requires a criteria map.');
        const count=Object.keys(question.criteria).length;
        if (count<2 || count>255) throw new ConvexError('Choice requires 2–255 options.');
      }
      if (question.type==='score' && (!Array.isArray(question.criteria) || question.criteria.length<2 || question.criteria.length>20)) throw new ConvexError('Score requires an ordered rubric with 2–20 positions.');
    }
    if (JSON.stringify(questions).length>40000) throw new ConvexError('Decision questions exceed the request bound.');
    const result=await gateway('/alpha/decisions',{model:'typesafe/jev-1.13',state,questions});
    for (const [key,question] of entries) {
      const answer=result.answers?.[key];
      if (!answer || answer.type!==question.type) throw new ConvexError('Gateway returned an invalid decision type.');
      if (question.type==='choice' && !Object.hasOwn(question.criteria,answer.choice)) throw new ConvexError('Gateway returned an unknown choice.');
      if (question.type==='noul' && (!Number.isFinite(answer.noul) || answer.noul<0 || answer.noul>1)) throw new ConvexError('Gateway returned an invalid probability.');
      if (question.type==='score' && !Number.isFinite(answer.score)) throw new ConvexError('Gateway returned an invalid score.');
    }
    return result;
  },
});
