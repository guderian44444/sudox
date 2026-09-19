import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { candidatesForCell, countSolutions, generateVariantPuzzle, normalizeVariantRules, solveSudoku, validVariantGrid } from "../src/game/sudoku.js";
import { createAdventureGame, normalizeSession, normalizeRuntimeGame, applyPlayerDigit, removeRelatedNotes, settleCompletedGame } from "../src/game/flow.js";
import { applyImmediateTreasure, TREASURE_CARDS } from "../src/game/adventure.js";
import { exportSaveCode, parseSaveCode, mergeProgressHighWater, rewardProgress, sessionFloorBehindProgress } from "../src/state/store.js";
import { recordAchievementGame } from "../src/game/achievements.js";
import { buildScore, queueLeaderboardScore, pendingScoreCount } from "../src/state/leaderboard.js";

const times = {}, samples = {};
for (const variant of ["diagonal", "thermo", "killer"]) {
  times[variant] = [];
  for (const difficulty of ["easy", "medium", "hard"]) for (let trial = 0; trial < 10; trial++) {
    const start = performance.now(), puzzle = generateVariantPuzzle(difficulty, variant);
    times[variant].push(performance.now() - start);
    assert(validVariantGrid(puzzle.solution, puzzle, false));
    assert.equal(countSolutions(puzzle.puzzle, 2, puzzle), 1, `${variant}/${difficulty}: unique`);
    assert.deepEqual(solveSudoku(puzzle.puzzle, puzzle), puzzle.solution);
    assert(puzzle.puzzle.every((digit, cell) => !digit || digit === puzzle.solution[cell]));
    // Check the generated constraints directly, independently of solver candidate masks.
    if (variant === "diagonal") {
      assert.equal(new Set(Array.from({length:9}, (_,i) => puzzle.solution[i * 10])).size, 9);
      assert.equal(new Set(Array.from({length:9}, (_,i) => puzzle.solution[i * 8 + 8])).size, 9);
    }
    if (variant === "thermo") for (const path of puzzle.thermometers) assert(path.every((cell,i) => !i || puzzle.solution[cell] > puzzle.solution[path[i-1]]));
    if (variant === "killer") {
      assert.equal(puzzle.puzzle.filter(Boolean).length, 0, "Killer is a cage-only puzzle");
      assert.equal(new Set(puzzle.cages.flatMap(cage => cage.cells)).size, 81);
      for (const cage of puzzle.cages) {
        assert.equal(new Set(cage.cells.map(cell => puzzle.solution[cell])).size, cage.cells.length);
        assert.equal(cage.cells.reduce((sum,cell) => sum + puzzle.solution[cell],0), cage.sum);
      }
    }
    samples[variant] = puzzle;
  }
}
const blank = () => Array(81).fill(0);
const diagonal = { variant: "diagonal" }, diagonalGrid = blank();
diagonalGrid[0] = 7; diagonalGrid[8] = 8;
assert(!candidatesForCell(diagonalGrid, 40, diagonal).some(value => [7,8].includes(value)));
diagonalGrid[40] = 7;
assert(!validVariantGrid(diagonalGrid, diagonal));
assert.equal(countSolutions(diagonalGrid, 2, diagonal), 0);
const thermo = { variant:"thermo", thermometers:[[0,1,2]] }, thermoGrid = blank();
assert.deepEqual(candidatesForCell(thermoGrid, 0, thermo), [1,2,3,4,5,6,7]);
assert.deepEqual(candidatesForCell(thermoGrid, 2, thermo), [3,4,5,6,7,8,9]);
thermoGrid[0] = 5; thermoGrid[2] = 7;
assert.deepEqual(candidatesForCell(thermoGrid, 1, thermo), [6]);
thermoGrid[1] = 9; assert(!validVariantGrid(thermoGrid, thermo));
assert.equal(countSolutions(thermoGrid, 2, thermo), 0);
const killer = { variant:"killer", cages: [{ cells:[0,1], sum:3 }, ...Array.from({length:79},(_,i)=>({cells:[i+2],sum:1}))] }, killerGrid = blank();
assert.deepEqual(candidatesForCell(killerGrid, 0, killer), [1,2]);
killerGrid[1] = 2; assert.deepEqual(candidatesForCell(killerGrid, 0, killer), [1]);
killerGrid[1] = 3; assert.deepEqual(candidatesForCell(killerGrid, 0, killer), []);
const cageCells=[0,1,2,3,12];
const noRepeat={variant:"killer",cages:[{cells:cageCells,sum:17},...Array.from({length:81},(_,i)=>i).filter(i=>!cageCells.includes(i)).map(i=>({cells:[i],sum:1}))]};
const duplicate=blank();duplicate[0]=5;
assert(candidatesForCell(duplicate,12).includes(5));
assert(!candidatesForCell(duplicate,12,noRepeat).includes(5), "cage no-repeat applies across different rows/boxes");
for (const invalid of [{variant:"unknown"},{variant:"thermo",thermometers:[]},{variant:"thermo",thermometers:[[0,8]]},{variant:"thermo",thermometers:[[0,1,0]]},{variant:"killer",cages:[{cells:[0],sum:1}]},{...killer,cages:[...killer.cages,{cells:[0],sum:1}]},{...killer,cages:[{cells:[0,1],sum:2},...killer.cages.slice(1)]}]) assert.equal(normalizeVariantRules(invalid),null);

for (const variant of ["diagonal","thermo","killer"]) {
  const game=createAdventureGame({difficulty:"hard",variant,floor:3});game.started=true;
  const cell=game.selected, correct=game.solution[cell];
  assert(applyImmediateTreasure(game,TREASURE_CARDS.candidateLens));
  assert(game.notes[cell].includes(correct));
  assert.deepEqual(game.notes[cell],candidatesForCell(game.values,cell,game));
  const before=game.values[cell];assert.equal(applyPlayerDigit(game,correct%9+1).type,"mistake");assert.equal(game.values[cell],before);
  assert.equal(applyPlayerDigit(game,correct).type,"correct");
  game.notes.forEach((notes,index)=>{if(!game.values[index])game.notes[index]=[1,2,3,4,5,6,7,8,9];});removeRelatedNotes(game,cell,correct);
  game.notes.forEach((notes,index)=>assert(notes.every(digit=>candidatesForCell(game.values,index,game).includes(digit))));
  const restored=normalizeSession({game,equippedCards:[],alinMode:false}).game;
  assert.equal(restored.variant,variant);assert.deepEqual(restored.cages,game.cages);assert.deepEqual(restored.thermometers,game.thermometers);
  const progress=parseSaveCode(exportSaveCode({coins:20,floors:{easy:1,hard:50,[variant]:3}})).progress;
  const imported=parseSaveCode(exportSaveCode(progress,{game,equippedCards:[],alinMode:false}));
  assert.deepEqual(imported.session.game,restored);
  assert.equal(sessionFloorBehindProgress(progress,game),false,"classic hard floor must not replace variant board");
  assert.equal(sessionFloorBehindProgress({...progress,floors:{...progress.floors,[`${variant}_hard`]:4}},game),true);
  const corrupt={...game,variant:"thermo",thermometers:[]};assert.equal(normalizeRuntimeGame(corrupt),null);
  game.values=[...game.solution];const settlement=settleCompletedGame(game,{alinMode:true});
  let rewarded=rewardProgress(progress,settlement.xpReward,settlement.timeBonus,settlement.stars,variant,3,{persist:false,runId:game.runId});
  rewarded=recordAchievementGame(rewarded,settlement).progress;
  assert.equal(rewarded.floors[variant],4);assert.equal(rewarded.floors.hard,50);
  assert.equal(rewarded.achievementStats.hardGames,0);assert.equal(rewarded.achievementStats.alinGames,0);
  assert.equal(rewarded.completedGames,1);
  assert.equal(buildScore(rewarded,game).p_difficulty,`${variant}_hard`);
  assert.equal(mergeProgressHighWater(progress,rewarded).floors[variant],4);
}
const classic=createAdventureGame();delete classic.variant;delete classic.cages;delete classic.thermometers;
assert.equal(normalizeRuntimeGame(classic).variant,"classic");
const queued=pendingScoreCount();assert((await queueLeaderboardScore(null)).skipped);assert.equal(pendingScoreCount(),queued);

// Run the actual worker orchestration with delayed replies: cancellation and account changes cannot replace a board.
const source=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
const workers=[];const game=createAdventureGame();
const ctx=vm.createContext({game,progress:{playerId:"A",floors:{},inventory:{}},alinMode:false,generatingGame:null,sessionSaveTimer:null,timerId:null,timerWasActive:false,equippedCards:[],URL,
  document:{querySelector(){return null;}},VARIANTS:{classic:{},diagonal:{},thermo:{},killer:{}},DIFFICULTIES:{easy:{},hard:{}},updateGameClock(){},resetGameEffects(){},saveProgress(){},render(){},refreshBoardBuddies(){},clearTimeout(){},clearInterval(){},setTimeout(){return 1;},nextFloorFromCompleted:n=>n+1,progressDifficulty:(_d,_a,v)=>v,createAdventureGame,
  Worker:class{constructor(){workers.push(this);}postMessage(options){this.options=options;}terminate(){this.terminated=true;}}
});
vm.runInContext(source.slice(source.indexOf("function cancelPuzzleGeneration()"),source.indexOf("function toggleAlinMode()" )).replaceAll("import.meta.url",'"https://test.local/src/app.js"'),ctx);
ctx.newGame("easy","killer");const first=workers[0];ctx.newGame("hard","thermo");assert(first.terminated);
first.onmessage({data:{game:{variant:"killer"}}});assert.equal(ctx.game,game);
ctx.progress.floors.thermo=8;
workers[1].onmessage({data:{game:{variant:"thermo",floor:1}}});assert.equal(ctx.game.variant,"thermo");assert.equal(ctx.game.floor,8,"cloud progress arriving during generation must be retained");
ctx.newGame("easy","diagonal");ctx.progress.playerId="B";workers[2].onmessage({data:{game:{variant:"diagonal"}}});assert.equal(ctx.game.variant,"thermo");
ctx.newGame("easy","killer");ctx.cancelPuzzleGeneration();assert(workers[3].terminated);assert.equal(ctx.generatingGame,null);
for(const [variant,values]of Object.entries(times)){values.sort((a,b)=>a-b);console.log(`${variant}: 30 unique puzzles, generation median ${values[15].toFixed(1)} ms / max ${values.at(-1).toFixed(1)} ms`);}
console.log("Variant checks passed: rules, unique generation, candidates, restore, isolated floors/leaderboard, worker cancellation.");
