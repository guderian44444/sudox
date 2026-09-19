import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createAdventureGame, applyPlayerDigit, applyHintFill, clearEditableCell, collectBoardProgressEvents, normalizeSession } from '../src/game/flow.js';
import { completedSudokuUnits, applyHintTreasure } from '../src/game/adventure.js';
import { gameModeKey, parseGameModeKey, RANKING_KEYS } from '../src/game/sudoku.js';
import { buildScore, fetchLeaderboard, queueLeaderboardScore, flushPendingScores, updateLeaderboardTaunt } from '../src/state/leaderboard.js';
import { rewardProgress, mergeProgressHighWater, reconcileFloorsFromLeaderboardRows, exportSaveCode, parseSaveCode } from '../src/state/store.js';

const game = createAdventureGame(); game.started = true; game.puzzle = Array(81).fill(0);
game.values = [...game.solution]; game.values[40] = 0; game.selected = 40;
game.completedUnits = completedSudokuUnits(game.values);
applyPlayerDigit(game, game.solution[40]); collectBoardProgressEvents(game);
assert.equal(game.correctStreak, 1); assert.equal(game.unitCombo, 3, 'one cell completes row, column and box');
collectBoardProgressEvents(game); assert.equal(game.unitCombo, 3, 'events can be collected twice without double credit');
clearEditableCell(game); let restored = normalizeSession({game}).game;
applyPlayerDigit(restored, restored.solution[40]); collectBoardProgressEvents(restored);
assert.equal(restored.unitCombo, 3, 'clear, reload and refill cannot farm completed units');
assert.equal(restored.correctStreak, 1);
clearEditableCell(restored); restored.shields = 1;
applyPlayerDigit(restored, restored.solution[40] % 9 + 1);
assert.equal(restored.correctStreak, 0); assert.equal(restored.unitCombo, 0, 'shield does not preserve combo after wrong answer');
restored.correctStreak = 7; restored.unitCombo = 4;
applyHintFill(restored, 40); collectBoardProgressEvents(restored, false, {manual:false});
assert.equal(restored.correctStreak, 0); assert.equal(restored.unitCombo, 0);
clearEditableCell(restored); restored.correctStreak = 7; restored.unitCombo = 4;
assert.equal(applyHintTreasure(restored, {effect:'hint',value:1},40).length,1);
assert.equal(restored.correctStreak, 0); assert.equal(restored.unitCombo, 0);
assert.equal(normalizeSession({game:{...restored,unitCombo:Infinity}}).game.unitCombo,0);
assert.equal(normalizeSession({game:{...restored,unitCombo:999}}).game.unitCombo,27);

assert.equal(RANKING_KEYS.length,22); assert.equal(new Set(RANKING_KEYS).size,22);
for (const key of RANKING_KEYS) {
 const parsed = parseGameModeKey(key);
 assert(parsed); assert.equal(gameModeKey(parsed.variant,parsed.difficulty==='alin'?'easy':parsed.difficulty,parsed.assisted),key);
 const score = buildScore({playerId:'test',playerName:'test',floors:{[key]:4}}, {variant:parsed.variant,difficulty:parsed.difficulty==='alin'?'easy':parsed.difficulty,floor:3,stars:3,elapsed:90,mistakes:0}, parsed.assisted);
 assert.equal(score.p_difficulty,key); assert.equal(score.p_next_floor,4);
}
assert.equal(gameModeKey('unknown','easy'),null); assert.equal(parseGameModeKey('killer_expert'),null);
const progress = parseSaveCode(exportSaveCode({floors:{easy:8,killer:50,killer_easy:7,killer_hard:2,killer_hard_alin:4}})).progress;
const rewarded=rewardProgress(progress,10,0,3,'killer_hard',2,{persist:false,runId:'combo-regression'});
assert.equal(rewarded.floors.killer_hard,3); assert.equal(rewarded.floors.killer_easy,7);assert.equal(rewarded.floors.killer_hard_alin,4);assert.equal(rewarded.floors.killer,50);
assert.equal(mergeProgressHighWater(progress,rewarded).floors.killer_hard,3);
const reconciled=reconcileFloorsFromLeaderboardRows(progress,[{difficulty:'thermo_medium',floor:12},{difficulty:'killer_hard_alin',floor:8}]);
assert.equal(reconciled.floors.thermo_medium,13); assert.equal(reconciled.floors.killer_hard_alin,9);assert.equal(reconciled.floors.medium,1);

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const pending=[];
const ctx=vm.createContext({leaderboardConfigured:()=>true,leaderboardDifficulty:'killer_easy',leaderboardRequest:0,showLeaderboard:true,leaderboardRows:[],leaderboardStatus:'',render(){},fetchLeaderboard:key=>new Promise(resolve=>pending.push({key,resolve}))});
vm.runInContext(source.slice(source.indexOf('async function refreshLeaderboard()'),source.indexOf('function applyLeaderboardSyncResult(')),ctx);
const a=ctx.refreshLeaderboard();ctx.leaderboardDifficulty='thermo_hard';const b=ctx.refreshLeaderboard();
pending[1].resolve([{difficulty:'thermo_hard'}]);await b;pending[0].resolve([{difficulty:'killer_easy'}]);await a;
assert.equal(ctx.leaderboardRows[0].difficulty,'thermo_hard','late response cannot replace the active mode');
const migration=vm.createContext({game:{variant:'killer',difficulty:'hard',floor:50},progress,alinMode:false,gameModeKey});
vm.runInContext(source.slice(source.indexOf('function alignVariantSessionFloor()'),source.indexOf('/** Keep an active run aligned')),migration);
migration.alignVariantSessionFloor();assert.equal(migration.game.floor,2);assert.equal(migration.game.floorKey,'killer_hard');
migration.game.floor=3;migration.alignVariantSessionFloor();assert.equal(migration.game.floor,3,'already partitioned session retains floor');

const memory=new Map([['sudox-cloud-pin-v1','1234']]);
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
for(const key of ['killer_easy','killer_hard','killer_hard_alin','thermo_hard']) {
 const mode=parseGameModeKey(key);
 await queueLeaderboardScore(buildScore({...progress,playerId:'test'}, {variant:mode.variant,difficulty:mode.difficulty,floor:1,stars:3,elapsed:10,mistakes:0},mode.assisted));
}
assert.equal(JSON.parse(memory.get('sudox-score-queue-v1')).length,4);
assert(!memory.get('sudox-score-queue-v1').includes('p_pin'));
const requests=[];
globalThis.fetch=async(url,options)=>{requests.push({url:String(url),body:options.body?JSON.parse(options.body):null});return {ok:true,json:async()=>[],text:async()=>'[]'};};
navigator.onLine=true;
assert.equal((await flushPendingScores()).sent,4);
await fetchLeaderboard('killer_hard');assert.equal(new URL(requests.at(-1).url).searchParams.get('difficulty'),'eq.killer_hard');
await updateLeaderboardTaunt({playerId:'test',pin:'1234',taunt:'hello',difficulty:'thermo_hard'});assert.equal(requests.at(-1).body.p_difficulty,'thermo_hard');
await assert.rejects(()=>fetchLeaderboard('killer_expert'));
const sql=readFileSync(new URL('../supabase/leaderboard-variant-modes-migration.sql',import.meta.url),'utf8');
assert(sql.startsWith('-- v62'));assert(sql.includes('begin;')&&sql.includes('commit;'));
assert(sql.includes('leaderboard_scores_difficulty_check')&&sql.includes('leaderboard_score_log_difficulty_check'));
assert(sql.includes("'^(diagonal|thermo|killer)_(easy|medium|hard)(_alin)?$'"));
assert(sql.includes('Invalid cloud PIN')&&sql.includes('revoke all on function'));
console.log('COMBO and ranking checks passed: stacking/reset/no duplicate credit, 22 partitions, legacy floors, queue/query/taunt isolation, late response guard.');
