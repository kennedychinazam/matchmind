// Deliberately curated, public-safe presentation data. No raw provider/database records.
export const santos={
 version:'prediction-comparison-preview-v1',synthetic:false,
 fixture:{id:'1492438',home:'Santos',away:'Palmeiras',competition:'Brazil · Série A',kickoff:'2026-10-28T22:30:00.000Z'},
 engine:{build:355,generatedAt:'2026-10-28T05:19:00.304Z',probabilities:[0.23632970210877488,0.2832790536678142,0.48039124422341106],selection:{code:'X2',label:'Draw or Palmeiras',probability:0.764}},
 ai:{status:'unavailable',model:'openai/gpt-6-luna',prompt:'A3 v1.0.0',generatedAt:null,probabilities:null,analysis:[],risk:null,limitations:['No validated independent A3 result was recorded.','The closed attempt remains halted. No model abstention was recorded.']},
 evidence:[{id:'retained-build355',label:'Retained Build 355 forecast',detail:'The original engine output is reproduced without recalculation or probability adjustments.',receivedAt:null}],
 source:{classification:'Retained engine observation',earliestReceipt:'2026-10-28T05:15:49.732Z',collectionCompleted:'2026-10-28T05:18:17.820Z',note:'Recorded evidence snapshot. This preview does not establish current fixture eligibility or source freshness.'},
 final:null
};
export const demo={
 version:'prediction-comparison-preview-v1',synthetic:true,
 fixture:{id:'synthetic-demo-1',home:'Harbour FC',away:'Ridge Athletic',competition:'Fictional competition',kickoff:null},
 engine:{build:355,generatedAt:null,probabilities:[.42,.30,.28],selection:{code:'1X',label:'Harbour FC or draw',probability:.72}},
 ai:{status:'available',model:'openai/gpt-6-luna',prompt:'A3 v1.0.0 · simulated response',generatedAt:null,probabilities:[.46,.29,.25],analysis:[
  {statement:'Harbour’s scoring has been stronger than Ridge’s in these fictional five-match samples. That supports a modest home preference, with substantial small-sample uncertainty.',refs:['demo-home-form','demo-away-form']},
  {statement:'Ridge’s seven goals conceded add to the concern about its defense. Missing chance-quality data prevents treating those concessions as proof of sustained defensive weakness.',refs:['demo-away-form']}
 ],risk:{status:'concern',explanation:'Five-match samples, different opponents, missing xG and unavailable lineups limit the assessment.',refs:['demo-home-form','demo-away-form']},limitations:['Synthetic, uncalibrated probabilities; no predictive performance has been established.','No verified player availability, tactical information or chance-quality evidence is supplied.']},
 evidence:[{id:'demo-home-form',label:'Fictional home-team sample',detail:'Five illustrative matches: 8 goals scored, 5 conceded. Opponent-adjusted strength is unknown.',receivedAt:null},{id:'demo-away-form',label:'Fictional away-team sample',detail:'Five illustrative matches: 5 goals scored, 7 conceded. xG and lineup information are missing.',receivedAt:null}],
 source:{classification:'Synthetic demonstration',earliestReceipt:null,collectionCompleted:null,note:'All teams, statistics, assessments and decisions in this example are fictional. No provider was called.'},
 final:{status:'illustrative',label:'Harbour FC win',reason:'A seeded example of the final-decision display. It is not selected by a validated ranking policy and is not a betting recommendation.'}
};
