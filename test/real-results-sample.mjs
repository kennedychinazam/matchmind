/* GENUINE FOOTBALL RECORDS, read from the isolated staging mirror edition published
 * 2026-11-15T17:01:25Z (source rows updated 2026-11-15T17:00:26Z). Identities, statuses, scores,
 * issued picks, probabilities and Tips legs are copied unchanged. Nothing here is synthetic. The
 * sample is a subset: eight fixtures with an issued prediction and the twelve Tips legs and one
 * Banker leg that reference fixtures in the sample. */
export const SAMPLE_NOW='2026-11-15T17:05:00.000Z';
const AS_OF='2026-11-15T17:01:25.907276+00:00',EXPIRES='2026-11-16T17:01:25.907276+00:00',UP='2026-11-15T17:00:26.128+00:00';
const C=(fxid,lid,lname,lcountry,home,away,date,time,status,elapsed,gh,ga,ft_h,ft_a,ht_h,ht_a,prediction=null)=>({fxid,lid,lname,lcountry,home,away,date,time,status,elapsed,gh,ga,ft_h,ft_a,ht_h,ht_a,provider:'af',updated_at:UP,prediction});
const P=(c,pick,market,pick_prob,p_home,p_draw,p_away,xg_home,xg_away,made_at)=>({...c,prediction:{lid:c.lid,lname:c.lname,home:c.home,away:c.away,pick,market,pick_prob,p_home,p_draw,p_away,xg_home,xg_away,kickoff:c.date,ktime:c.time,made_at,withheld_at:null,final_pick:null,build:355}});
const F='FINISHED',n=null;
const paillade=C(1647925,66,'Coupe de France','France','Atlas Paillade','Cannes','2026-11-15','14:00',F,90,0,2,0,2,0,0);
const reggiana=C(1608748,942,'Serie C Girone B','Italy','Reggiana','Livorno','2026-11-14','13:30',F,90,0,0,0,0,0,0);
const graafschap=C(1551879,89,'Eerste Divisie','Netherlands','De Graafschap','FC OSS','2026-11-14','19:00',F,90,1,2,1,2,0,1);
const tenerife=C(1570023,141,'Segunda Division','Spain','Tenerife','AD Ceuta FC','2026-11-15','13:00',F,90,2,0,2,0,1,0);
const extremadura=C(1570828,435,'Primera Federacion G1','Spain','Extremadura 1924','Pontevedra','2026-11-15','11:00',F,90,2,3,2,3,1,2);
const lugo=C(1570830,435,'Primera Federacion G1','Spain','Lugo','Mirandes','2026-11-15','15:30','2H',62,0,3,n,n,0,2);
const luton=C(1564407,41,'EFL League One','England','Luton','Cambridge United','2026-11-14','15:00','POSTPONED',n,n,n,n,n,n,n);
const eibar=C(1570016,141,'Segunda Division','Spain','Eibar','Cadiz','2026-11-15','17:30','NS',n,n,n,n,n,n,n);
const juventus=C(1608365,138,'Serie C Girone A','Italy','Juventus U23','Treviso','2026-11-15','16:30','1H',29,1,0,n,n,1,0);
const atletico=C(1571207,436,'Primera Federacion G2','Spain','Atlético Madrid II','Teruel','2026-11-15','11:00',F,90,1,0,1,0,0,0);
const ibiza=C(1571215,436,'Primera Federacion G2','Spain','Ibiza','FC Cartagena','2026-11-15','11:00',F,90,0,1,0,1,0,1);
const pescara=C(1608746,942,'Serie C Girone B','Italy','Pescara','Sambenedettese','2026-11-15','13:30',F,90,3,1,3,1,3,0);
const guidonia=C(1608743,942,'Serie C Girone B','Italy','Guidonia Montecelio 1937','Ostia Mare','2026-11-15','13:30',F,90,2,2,2,2,0,0);
export const ISSUED=[
 P(paillade,'2D','Draw No Bet',.844,.127,.1864,.6866,.968,2.414,'2026-11-12T22:44:46.063+00:00'),
 P(reggiana,'1D','Draw No Bet',.832,.6517,.2171,.1312,2.03,.805,'2026-11-11T23:28:36.926+00:00'),
 P(graafschap,'1D','Draw No Bet',.792,.6147,.224,.1613,2.02,.947,'2026-11-11T23:28:36.572+00:00'),
 P(tenerife,'1X','Double Chance',.795,.5122,.2828,.205,1.486,.849,'2026-11-12T13:45:19.967+00:00'),
 P(extremadura,'1X','Double Chance',.742,.4675,.2741,.2584,1.537,1.085,'2026-11-12T13:45:20.106+00:00'),
 P(lugo,'1X','Double Chance',.729,.4172,.3122,.2706,1.221,.931,'2026-11-12T22:44:46.312+00:00'),
 P(luton,'1D','Draw No Bet',.809,.628,.2239,.1482,1.996,.871,'2026-11-11T23:28:36.396+00:00'),
 P(eibar,'1X','Double Chance',.816,.5496,.2666,.1838,1.617,.835,'2026-11-12T22:44:46.231+00:00')];
const OTHERS=[juventus,atletico,ibiza,pescara,guidonia];
const leg=(c,tab,rank,code,sel,p)=>({tab,rank,fxid:c.fxid,d:c.date,t:c.time,h:c.home,a:c.away,lid:c.lid,code,sel,market:'',p});
export const TIPS_LEGS=[
 leg(eibar,'winner',0,'1X','Eibar or Draw',.8163),leg(guidonia,'winner',1,'1X','Guidonia Montecelio 1937 or Draw',.8072),
 leg(pescara,'winner',2,'1X','Pescara or Draw',.8055),leg(ibiza,'winner',3,'1X','Ibiza or Draw',.8051),
 leg(juventus,'ou',0,'U25','Under 2.5',.6396),leg(atletico,'ou',1,'U25','Under 2.5',.6264),
 leg(guidonia,'ou',2,'U25','Under 2.5',.6263),leg(paillade,'ou',4,'O25','Over 2.5',.6211),
 leg(atletico,'btts',0,'NBT','BTTS No',.5924),leg(guidonia,'btts',1,'NBT','BTTS No',.5687),
 leg(ibiza,'btts',2,'NBT','BTTS No',.5651),leg(juventus,'btts',3,'NBT','BTTS No',.5601)];
export const SLIPS=[
 {day:'2026-11-15',tier:'banker',step:'banker',build:355,odds:1.11,legs:[{fxid:1571207,d:'2026-11-15',t:'11:00',h:'Atlético Madrid II',a:'Teruel',code:'1X',market:'Double Chance',p:.8574,o:1.11}]},
 {day:'2026-11-15',tier:'tips',step:'tips',build:355,odds:0,legs:TIPS_LEGS}];
/* What each issued selection did, by the app's own grader on the provider's 90-minute score. */
export const EXPECTED={1647925:'Won',1608748:'Void',1551879:'Lost',1570023:'Won',1570828:'Lost',1570830:'Pending',1564407:'Pending',1570016:'Pending'};
export function envelope(screen,{withhold=[]}={}){
 const strip=c=>withhold.includes(c.fxid)?{...c,gh:n,ga:n,ft_h:n,ft_a:n,ht_h:n,ht_a:n}:c;
 const bare=ISSUED.map(c=>({...c,prediction:null}));
 const cards=(screen==='scores'||screen==='slips'||screen==='records'?[...bare,...OTHERS]:screen==='history'?ISSUED:[...ISSUED,...OTHERS]).map(strip);
 return {version:'matchmind-display/1',screen,edition_id:'64586c8e-1997-41f7-9d62-c1e00874d599',as_of:AS_OF,expires_at:EXPIRES,cards,board:null,records:{engine:null,clv:null},slips:screen==='slips'?SLIPS:[]};
}
