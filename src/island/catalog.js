export const ISLAND_SCHEMA_VERSION = 2;
export const ISLAND_RADIUS = 4;
export const STARTER_LAND_RADIUS = 1;
// DEVELOPMENT ONLY: must be false before this branch is pushed or deployed.
export const ISLAND_TEST_MODE = true;

const minutes = (value) => value * 60;
const hours = (value) => minutes(value * 60);

export const RECLAMATION_WORK_TAGS = Object.freeze(["civil", "heavy", "waterfront"]);

export const BUILDING_CATEGORIES = Object.freeze([
  Object.freeze({ id: "source", name: "農業與採集", icon: "🌱" }),
  Object.freeze({ id: "processor", name: "加工與畜產", icon: "⚙️" }),
  Object.freeze({ id: "market", name: "商業服務", icon: "🏪" }),
  Object.freeze({ id: "utility", name: "公共工程", icon: "🛠️" }),
  Object.freeze({ id: "logistics", name: "跨島物流", icon: "🚢" }),
  Object.freeze({ id: "decoration", name: "景觀遊樂", icon: "🌷" })
]);

export const ITEM_CATALOG = Object.freeze({
  vegetable: Object.freeze({ id: "vegetable", name: "蔬菜", icon: "🥬", marketCoins: 6, assetKey: "items/vegetable" }),
  carrot: Object.freeze({ id: "carrot", name: "胡蘿蔔", icon: "🥕", marketCoins: 5, assetKey: "items/carrot" }),
  tomato: Object.freeze({ id: "tomato", name: "番茄", icon: "🍅", marketCoins: 7, assetKey: "items/tomato" }),
  strawberry: Object.freeze({ id: "strawberry", name: "草莓", icon: "🍓", marketCoins: 10, assetKey: "items/strawberry" }),
  pumpkin: Object.freeze({ id: "pumpkin", name: "南瓜", icon: "🎃", marketCoins: 9, assetKey: "items/pumpkin" }),
  potato: Object.freeze({ id: "potato", name: "馬鈴薯", icon: "🥔", marketCoins: 6, assetKey: "items/potato" }),
  corn: Object.freeze({ id: "corn", name: "玉米", icon: "🌽", marketCoins: 4, assetKey: "items/corn" }),
  wheat: Object.freeze({ id: "wheat", name: "小麥", icon: "🌾", marketCoins: 5, assetKey: "items/wheat" }),
  flour: Object.freeze({ id: "flour", name: "麵粉", icon: "🥣", marketCoins: 15, assetKey: "items/flour" }),
  bread: Object.freeze({ id: "bread", name: "鄉村麵包", icon: "🍞", marketCoins: 38, assetKey: "items/bread" }),
  rice: Object.freeze({ id: "rice", name: "稻米", icon: "🍚", marketCoins: 7, assetKey: "items/rice" }),
  riceBall: Object.freeze({ id: "riceBall", name: "小島飯糰", icon: "🍙", marketCoins: 42, assetKey: "items/rice-ball" }),
  teaLeaf: Object.freeze({ id: "teaLeaf", name: "茶葉", icon: "🍃", marketCoins: 12, assetKey: "items/tea-leaf" }),
  teaCup: Object.freeze({ id: "teaCup", name: "蜂蜜島茶", icon: "🍵", marketCoins: 46, assetKey: "items/tea-cup" }),
  grape: Object.freeze({ id: "grape", name: "葡萄", icon: "🍇", marketCoins: 11, assetKey: "items/grape" }),
  grapeJuice: Object.freeze({ id: "grapeJuice", name: "葡萄果汁", icon: "🧃", marketCoins: 34, assetKey: "items/grape-juice" }),
  sugarcane: Object.freeze({ id: "sugarcane", name: "甘蔗", icon: "🎋", marketCoins: 7, assetKey: "items/sugarcane" }),
  sugar: Object.freeze({ id: "sugar", name: "砂糖", icon: "🧂", marketCoins: 18, assetKey: "items/sugar" }),
  iceCream: Object.freeze({ id: "iceCream", name: "草莓冰淇淋", icon: "🍨", marketCoins: 72, assetKey: "items/ice-cream" }),
  fruit: Object.freeze({ id: "fruit", name: "綜合水果", icon: "🍎", marketCoins: 9, assetKey: "items/fruit" }),
  coffeeBean: Object.freeze({ id: "coffeeBean", name: "咖啡豆", icon: "🫘", marketCoins: 12, assetKey: "items/coffee-bean" }),
  roastedCoffee: Object.freeze({ id: "roastedCoffee", name: "烘焙咖啡豆", icon: "☕", marketCoins: 28, assetKey: "items/roasted-coffee" }),
  coffeeCup: Object.freeze({ id: "coffeeCup", name: "小島拿鐵", icon: "🥤", marketCoins: 65, assetKey: "items/coffee-cup" }),
  cocoaBean: Object.freeze({ id: "cocoaBean", name: "可可豆", icon: "🟤", marketCoins: 14, assetKey: "items/cocoa-bean" }),
  chocolate: Object.freeze({ id: "chocolate", name: "巧克力", icon: "🍫", marketCoins: 45, assetKey: "items/chocolate" }),
  milk: Object.freeze({ id: "milk", name: "牛奶", icon: "🥛", marketCoins: 14, assetKey: "items/milk" }),
  egg: Object.freeze({ id: "egg", name: "雞蛋", icon: "🥚", marketCoins: 8, assetKey: "items/egg" }),
  wool: Object.freeze({ id: "wool", name: "羊毛", icon: "🧶", marketCoins: 16, assetKey: "items/wool" }),
  fabric: Object.freeze({ id: "fabric", name: "島花布", icon: "🪡", marketCoins: 50, assetKey: "items/fabric" }),
  honey: Object.freeze({ id: "honey", name: "蜂蜜", icon: "🍯", marketCoins: 18, assetKey: "items/honey" }),
  jam: Object.freeze({ id: "jam", name: "水果果醬", icon: "🫙", marketCoins: 36, assetKey: "items/jam" }),
  cake: Object.freeze({ id: "cake", name: "蜂蜜蛋糕", icon: "🍰", marketCoins: 90, assetKey: "items/cake" }),
  dairyBox: Object.freeze({ id: "dairyBox", name: "乳製品箱", icon: "🧀", marketCoins: 50, assetKey: "items/dairy-box" })
});

export const RECIPE_CATALOG = Object.freeze({
  vegetableHarvest: Object.freeze({ id: "vegetableHarvest", name: "種植葉菜", kind: "source", facilityId: "garden", inputs: Object.freeze({}), outputs: Object.freeze({ vegetable: 2 }), durationSeconds: minutes(45) }),
  carrotHarvest: Object.freeze({ id: "carrotHarvest", name: "種植胡蘿蔔", kind: "source", facilityId: "garden", inputs: Object.freeze({}), outputs: Object.freeze({ carrot: 3 }), durationSeconds: minutes(30) }),
  tomatoHarvest: Object.freeze({ id: "tomatoHarvest", name: "種植番茄", kind: "source", facilityId: "garden", inputs: Object.freeze({}), outputs: Object.freeze({ tomato: 3 }), durationSeconds: hours(1) }),
  strawberryHarvest: Object.freeze({ id: "strawberryHarvest", name: "種植草莓", kind: "source", facilityId: "garden", inputs: Object.freeze({}), outputs: Object.freeze({ strawberry: 3 }), durationSeconds: hours(2) }),
  pumpkinHarvest: Object.freeze({ id: "pumpkinHarvest", name: "種植南瓜", kind: "source", facilityId: "garden", inputs: Object.freeze({}), outputs: Object.freeze({ pumpkin: 2 }), durationSeconds: hours(2) }),
  potatoHarvest: Object.freeze({ id: "potatoHarvest", name: "種植馬鈴薯", kind: "source", facilityId: "garden", inputs: Object.freeze({}), outputs: Object.freeze({ potato: 3 }), durationSeconds: minutes(50) }),
  cornHarvest: Object.freeze({ id: "cornHarvest", name: "種植玉米", kind: "source", facilityId: "cornField", inputs: Object.freeze({}), outputs: Object.freeze({ corn: 2 }), durationSeconds: hours(1) }),
  wheatHarvest: Object.freeze({ id: "wheatHarvest", name: "收割小麥", kind: "source", facilityId: "grainField", inputs: Object.freeze({}), outputs: Object.freeze({ wheat: 3 }), durationSeconds: hours(1) }),
  riceHarvest: Object.freeze({ id: "riceHarvest", name: "收割稻米", kind: "source", facilityId: "paddy", inputs: Object.freeze({}), outputs: Object.freeze({ rice: 3 }), durationSeconds: hours(2) }),
  teaHarvest: Object.freeze({ id: "teaHarvest", name: "採收茶葉", kind: "source", facilityId: "teaGarden", inputs: Object.freeze({}), outputs: Object.freeze({ teaLeaf: 3 }), durationSeconds: hours(3) }),
  grapeHarvest: Object.freeze({ id: "grapeHarvest", name: "採收葡萄", kind: "source", facilityId: "vineyard", inputs: Object.freeze({}), outputs: Object.freeze({ grape: 3 }), durationSeconds: hours(3) }),
  sugarcaneHarvest: Object.freeze({ id: "sugarcaneHarvest", name: "採收甘蔗", kind: "source", facilityId: "sugarcaneField", inputs: Object.freeze({}), outputs: Object.freeze({ sugarcane: 3 }), durationSeconds: hours(2) }),
  fruitHarvest: Object.freeze({ id: "fruitHarvest", name: "栽培果樹", kind: "source", facilityId: "orchard", inputs: Object.freeze({}), outputs: Object.freeze({ fruit: 3 }), durationSeconds: hours(2) }),
  coffeeHarvest: Object.freeze({ id: "coffeeHarvest", name: "栽培咖啡", kind: "source", facilityId: "orchard", inputs: Object.freeze({}), outputs: Object.freeze({ coffeeBean: 3 }), durationSeconds: hours(3) }),
  cocoaHarvest: Object.freeze({ id: "cocoaHarvest", name: "栽培可可", kind: "source", facilityId: "orchard", inputs: Object.freeze({}), outputs: Object.freeze({ cocoaBean: 3 }), durationSeconds: hours(4) }),
  honeyHarvest: Object.freeze({ id: "honeyHarvest", name: "照顧蜜蜂採蜜", kind: "source", facilityId: "apiary", inputs: Object.freeze({}), outputs: Object.freeze({ honey: 2 }), durationSeconds: hours(2) }),
  milkBatch: Object.freeze({ id: "milkBatch", name: "照顧乳牛擠奶", kind: "processor", facilityId: "ranch", inputs: Object.freeze({ corn: 2 }), outputs: Object.freeze({ milk: 1 }), durationSeconds: hours(2) }),
  eggBatch: Object.freeze({ id: "eggBatch", name: "餵母雞收蛋", kind: "processor", facilityId: "ranch", inputs: Object.freeze({ corn: 1 }), outputs: Object.freeze({ egg: 3 }), durationSeconds: hours(1) }),
  woolBatch: Object.freeze({ id: "woolBatch", name: "照顧綿羊剪毛", kind: "processor", facilityId: "ranch", inputs: Object.freeze({ vegetable: 2 }), outputs: Object.freeze({ wool: 1 }), durationSeconds: hours(3) }),
  dairyBatch: Object.freeze({ id: "dairyBatch", name: "加工乳製品", kind: "processor", facilityId: "foodFactory", inputs: Object.freeze({ milk: 2 }), outputs: Object.freeze({ dairyBox: 1 }), durationSeconds: hours(3) }),
  jamBatch: Object.freeze({ id: "jamBatch", name: "熬煮水果果醬", kind: "processor", facilityId: "foodFactory", inputs: Object.freeze({ fruit: 2 }), outputs: Object.freeze({ jam: 1 }), durationSeconds: hours(3) }),
  chocolateBatch: Object.freeze({ id: "chocolateBatch", name: "製作牛奶巧克力", kind: "processor", facilityId: "foodFactory", inputs: Object.freeze({ cocoaBean: 2, milk: 1 }), outputs: Object.freeze({ chocolate: 1 }), durationSeconds: hours(4) }),
  roastCoffee: Object.freeze({ id: "roastCoffee", name: "烘焙咖啡豆", kind: "processor", facilityId: "roastery", inputs: Object.freeze({ coffeeBean: 2 }), outputs: Object.freeze({ roastedCoffee: 1 }), durationSeconds: hours(2) }),
  brewCoffee: Object.freeze({ id: "brewCoffee", name: "調製小島拿鐵", kind: "processor", facilityId: "cafe", inputs: Object.freeze({ roastedCoffee: 1, milk: 1 }), outputs: Object.freeze({ coffeeCup: 1 }), durationSeconds: hours(1) }),
  weaveFabric: Object.freeze({ id: "weaveFabric", name: "織成島花布", kind: "processor", facilityId: "textileWorkshop", inputs: Object.freeze({ wool: 2 }), outputs: Object.freeze({ fabric: 1 }), durationSeconds: hours(3) }),
  flourBatch: Object.freeze({ id: "flourBatch", name: "研磨小麥粉", kind: "processor", facilityId: "mill", inputs: Object.freeze({ wheat: 2 }), outputs: Object.freeze({ flour: 1 }), durationSeconds: hours(2) }),
  breadBatch: Object.freeze({ id: "breadBatch", name: "烘焙鄉村麵包", kind: "processor", facilityId: "bakery", inputs: Object.freeze({ flour: 2 }), outputs: Object.freeze({ bread: 1 }), durationSeconds: hours(3) }),
  bakeCake: Object.freeze({ id: "bakeCake", name: "烘焙蜂蜜蛋糕", kind: "processor", facilityId: "bakery", inputs: Object.freeze({ egg: 2, milk: 1, honey: 1 }), outputs: Object.freeze({ cake: 1 }), durationSeconds: hours(4) }),
  riceBallBatch: Object.freeze({ id: "riceBallBatch", name: "製作小島飯糰", kind: "processor", facilityId: "riceKitchen", inputs: Object.freeze({ rice: 2, egg: 1 }), outputs: Object.freeze({ riceBall: 1 }), durationSeconds: hours(2) }),
  teaBatch: Object.freeze({ id: "teaBatch", name: "沖泡蜂蜜島茶", kind: "processor", facilityId: "teaHouse", inputs: Object.freeze({ teaLeaf: 2, honey: 1 }), outputs: Object.freeze({ teaCup: 1 }), durationSeconds: hours(2) }),
  grapeJuiceBatch: Object.freeze({ id: "grapeJuiceBatch", name: "鮮榨葡萄果汁", kind: "processor", facilityId: "juiceStand", inputs: Object.freeze({ grape: 2 }), outputs: Object.freeze({ grapeJuice: 1 }), durationSeconds: minutes(90) }),
  sugarBatch: Object.freeze({ id: "sugarBatch", name: "熬製砂糖", kind: "processor", facilityId: "sugarMill", inputs: Object.freeze({ sugarcane: 2 }), outputs: Object.freeze({ sugar: 1 }), durationSeconds: hours(2) }),
  iceCreamBatch: Object.freeze({ id: "iceCreamBatch", name: "製作草莓冰淇淋", kind: "processor", facilityId: "iceCreamShop", inputs: Object.freeze({ milk: 1, sugar: 1, strawberry: 1 }), outputs: Object.freeze({ iceCream: 1 }), durationSeconds: hours(3) })
});

const oneHex = Object.freeze([{ q: 0, r: 0 }]);
const tags = (...values) => Object.freeze(values);
const attraction = (incomeCoins, intervalSeconds, maxVisitors, visitLabel) => Object.freeze({ incomeCoins, intervalSeconds, maxVisitors, visitLabel });

export const BUILDING_CATALOG = Object.freeze({
  islandHome: Object.freeze({
    id: "islandHome", name: "島主小屋與倉庫", icon: "🏠", category: "starter", buildable: false,
    footprint: oneHex, costCoins: 0, durationSeconds: 0, workTags: tags("craft", "utility"),
    description: "小島的中心、伙伴休息處，也兼作無上限倉庫。", assetKey: "buildings/island-home"
  }),
  garden: Object.freeze({
    id: "garden", name: "百變菜園", icon: "🥬", category: "source", buildable: true,
    footprint: oneHex, costCoins: 20, durationSeconds: minutes(20), workTags: tags("farming"),
    defaultRecipeId: "vegetableHarvest", recipeIds: Object.freeze(["vegetableHarvest", "carrotHarvest", "tomatoHarvest", "strawberryHarvest", "pumpkinHarvest", "potatoHarvest"]),
    description: "可改種葉菜、根莖、番茄、草莓或南瓜。成熟後點擊收成進倉庫。", assetKey: "buildings/garden"
  }),
  cornField: Object.freeze({
    id: "cornField", name: "玉米田", icon: "🌽", category: "source", buildable: true,
    footprint: oneHex, costCoins: 50, durationSeconds: hours(1), workTags: tags("farming", "heavy"),
    defaultRecipeId: "cornHarvest", recipeIds: Object.freeze(["cornHarvest"]),
    description: "穩定生產玉米，可直售或作為牧場飼料。", assetKey: "buildings/corn-field"
  }),
  grainField: Object.freeze({
    id: "grainField", name: "金穗麥田", icon: "🌾", category: "source", buildable: true,
    footprint: oneHex, costCoins: 70, durationSeconds: hours(1), workTags: tags("farming", "heavy"),
    defaultRecipeId: "wheatHarvest", recipeIds: Object.freeze(["wheatHarvest"]),
    description: "收割小麥供磨坊製粉，再交給烘焙屋做成麵包。", assetKey: "buildings/grain-field"
  }),
  paddy: Object.freeze({
    id: "paddy", name: "梯田水稻田", icon: "🌾", category: "source", buildable: true,
    footprint: oneHex, costCoins: 100, durationSeconds: hours(2), workTags: tags("farming", "waterfront"),
    defaultRecipeId: "riceHarvest", recipeIds: Object.freeze(["riceHarvest"]),
    description: "利用小島水氣種稻，稻米可直售或送到飯糰屋加工。", assetKey: "buildings/paddy"
  }),
  teaGarden: Object.freeze({
    id: "teaGarden", name: "雲霧茶園", icon: "🍃", category: "source", buildable: true,
    footprint: oneHex, costCoins: 130, durationSeconds: hours(3), workTags: tags("farming", "orchard"),
    defaultRecipeId: "teaHarvest", recipeIds: Object.freeze(["teaHarvest"]),
    description: "採收清香茶葉，搭配蜂蜜可在茶屋沖泡成高價島茶。", assetKey: "buildings/tea-garden"
  }),
  vineyard: Object.freeze({
    id: "vineyard", name: "向陽葡萄園", icon: "🍇", category: "source", buildable: true,
    footprint: oneHex, costCoins: 150, durationSeconds: hours(4), workTags: tags("farming", "orchard", "craft"),
    defaultRecipeId: "grapeHarvest", recipeIds: Object.freeze(["grapeHarvest"]),
    description: "採收葡萄，可直接販售或送往果汁攤鮮榨。", assetKey: "buildings/vineyard"
  }),
  sugarcaneField: Object.freeze({
    id: "sugarcaneField", name: "海風甘蔗田", icon: "🎋", category: "source", buildable: true,
    footprint: oneHex, costCoins: 90, durationSeconds: hours(2), workTags: tags("farming", "heavy"),
    defaultRecipeId: "sugarcaneHarvest", recipeIds: Object.freeze(["sugarcaneHarvest"]),
    description: "採收耐風甘蔗，送到糖坊熬成砂糖。", assetKey: "buildings/sugarcane-field"
  }),
  orchard: Object.freeze({
    id: "orchard", name: "熱帶果園", icon: "🌳", category: "source", buildable: true,
    footprint: oneHex, costCoins: 90, durationSeconds: hours(2), workTags: tags("farming", "orchard"),
    defaultRecipeId: "fruitHarvest", recipeIds: Object.freeze(["fruitHarvest", "coffeeHarvest", "cocoaHarvest"]),
    description: "可切換栽培果樹、咖啡或可可，是多條高價加工鏈的起點。", assetKey: "buildings/orchard"
  }),
  apiary: Object.freeze({
    id: "apiary", name: "友善蜂園", icon: "🐝", category: "source", buildable: true,
    footprint: oneHex, costCoins: 120, durationSeconds: hours(3), workTags: tags("animal", "farming", "decoration"),
    defaultRecipeId: "honeyHarvest", recipeIds: Object.freeze(["honeyHarvest"]),
    description: "照顧蜜蜂收集蜂蜜，也讓周圍花草更熱鬧。", assetKey: "buildings/apiary"
  }),
  ranch: Object.freeze({
    id: "ranch", name: "友善牧場", icon: "🐄", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 180, durationSeconds: hours(4), workTags: tags("animal", "farming", "heavy"),
    recipeIds: Object.freeze(["milkBatch", "eggBatch", "woolBatch"]),
    description: "只照顧乳牛、母雞與綿羊，收牛奶、雞蛋和羊毛；小島世界不殺生。", assetKey: "buildings/ranch"
  }),
  foodFactory: Object.freeze({
    id: "foodFactory", name: "食品工房", icon: "🏭", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 320, durationSeconds: hours(8), workTags: tags("factory", "food", "heavy"),
    recipeIds: Object.freeze(["dairyBatch", "jamBatch", "chocolateBatch"]),
    description: "加工乳製品、果醬與巧克力；完成品會累積等待領取。", assetKey: "buildings/food-factory"
  }),
  roastery: Object.freeze({
    id: "roastery", name: "咖啡烘焙坊", icon: "♨️", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 220, durationSeconds: hours(5), workTags: tags("coffee", "factory", "craft"),
    recipeIds: Object.freeze(["roastCoffee"]), description: "把果園咖啡豆烘焙成更高價的熟豆。", assetKey: "buildings/roastery"
  }),
  cafe: Object.freeze({
    id: "cafe", name: "海風咖啡館", icon: "☕", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 260, durationSeconds: hours(6), workTags: tags("coffee", "food", "commerce", "decoration"),
    recipeIds: Object.freeze(["brewCoffee"]), description: "用烘焙豆與牛奶調製小島拿鐵。", assetKey: "buildings/cafe"
  }),
  textileWorkshop: Object.freeze({
    id: "textileWorkshop", name: "織布工坊", icon: "🧵", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 240, durationSeconds: hours(6), workTags: tags("craft", "factory"),
    recipeIds: Object.freeze(["weaveFabric"]), description: "把綿羊的羊毛織成有小島花紋的布料。", assetKey: "buildings/textile-workshop"
  }),
  bakery: Object.freeze({
    id: "bakery", name: "蜂蜜烘焙屋", icon: "🥐", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 280, durationSeconds: hours(7), workTags: tags("food", "craft", "commerce"),
    recipeIds: Object.freeze(["breadBatch", "bakeCake"]), description: "可用麵粉烤麵包，或把雞蛋、牛奶與蜂蜜做成高價蛋糕。", assetKey: "buildings/bakery"
  }),
  mill: Object.freeze({
    id: "mill", name: "風車磨坊", icon: "🌬️", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 180, durationSeconds: hours(4), workTags: tags("craft", "heavy", "farming"),
    recipeIds: Object.freeze(["flourBatch"]), description: "消耗小麥研磨成麵粉；沒有小麥就不能開工。", assetKey: "buildings/mill"
  }),
  riceKitchen: Object.freeze({
    id: "riceKitchen", name: "飯糰小屋", icon: "🍙", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 240, durationSeconds: hours(5), workTags: tags("food", "craft", "commerce"),
    recipeIds: Object.freeze(["riceBallBatch"]), description: "把稻米與雞蛋製成方便運送的小島飯糰。", assetKey: "buildings/rice-kitchen"
  }),
  teaHouse: Object.freeze({
    id: "teaHouse", name: "山頂茶屋", icon: "🍵", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 240, durationSeconds: hours(5), workTags: tags("food", "craft", "commerce", "decoration"),
    recipeIds: Object.freeze(["teaBatch"]), description: "需要茶葉與蜂蜜，才能沖泡蜂蜜島茶。", assetKey: "buildings/tea-house"
  }),
  juiceStand: Object.freeze({
    id: "juiceStand", name: "鮮果汁攤", icon: "🧃", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 200, durationSeconds: hours(4), workTags: tags("food", "commerce", "craft"),
    recipeIds: Object.freeze(["grapeJuiceBatch"]), description: "消耗新鮮葡萄榨成果汁。", assetKey: "buildings/juice-stand"
  }),
  sugarMill: Object.freeze({
    id: "sugarMill", name: "海鹽糖坊", icon: "🧂", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 220, durationSeconds: hours(5), workTags: tags("food", "factory", "heavy"),
    recipeIds: Object.freeze(["sugarBatch"]), description: "消耗甘蔗熬製砂糖，是甜點產業鏈的中段。", assetKey: "buildings/sugar-mill"
  }),
  iceCreamShop: Object.freeze({
    id: "iceCreamShop", name: "冰淇淋屋", icon: "🍨", category: "processor", buildable: true,
    footprint: oneHex, costCoins: 300, durationSeconds: hours(7), workTags: tags("food", "commerce", "craft"),
    recipeIds: Object.freeze(["iceCreamBatch"]), description: "需要牛奶、砂糖與草莓，製作高價草莓冰淇淋。", assetKey: "buildings/ice-cream-shop"
  }),
  market: Object.freeze({
    id: "market", name: "小島市場", icon: "🏪", category: "market", buildable: true,
    footprint: oneHex, costCoins: 60, durationSeconds: hours(1), workTags: tags("commerce", "craft"),
    description: "把倉庫中的任何原料或加工品直接換成金幣。", assetKey: "buildings/market"
  }),
  lighthouse: Object.freeze({
    id: "lighthouse", name: "珊瑚燈塔", icon: "🗼", category: "utility", buildable: true,
    footprint: oneHex, costCoins: 260, durationSeconds: hours(6), workTags: tags("civil", "heavy", "waterfront"),
    attraction: attraction(5, hours(1), 2, "登塔觀景"),
    description: "照亮外海，也會吸引伙伴登塔觀景；每小時帶來少量門票收入。", assetKey: "buildings/lighthouse"
  }),
  flowerGarden: Object.freeze({
    id: "flowerGarden", name: "花園", icon: "🌷", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 30, durationSeconds: minutes(30), workTags: tags("decoration", "farming"),
    attraction: attraction(1, minutes(30), 1, "賞花散步"),
    description: "伙伴會隨機來賞花散步，每 30 分鐘帶來少量維護收入。", assetKey: "buildings/flower-garden"
  }),
  pond: Object.freeze({
    id: "pond", name: "睡蓮池", icon: "🪷", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 70, durationSeconds: hours(1), workTags: tags("decoration", "waterfront", "farming"),
    attraction: attraction(2, minutes(30), 2, "池畔休息"),
    description: "伙伴會隨機在池邊休息，每 30 分鐘帶來少量景觀收入。", assetKey: "buildings/pond"
  }),
  playground: Object.freeze({
    id: "playground", name: "伙伴遊樂場", icon: "🎠", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 160, durationSeconds: hours(4), workTags: tags("decoration", "civil", "craft"),
    attraction: attraction(3, minutes(20), 3, "暢玩設施"),
    description: "伙伴會隨機來玩；每 20 分鐘收一小筆遊樂設施使用費。", assetKey: "buildings/playground"
  }),
  picnicPark: Object.freeze({
    id: "picnicPark", name: "海風野餐公園", icon: "🧺", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 90, durationSeconds: hours(2), workTags: tags("decoration", "farming", "craft"),
    attraction: attraction(2, minutes(30), 2, "野餐休息"),
    description: "伙伴會帶點心來野餐，每 30 分鐘收取少量場地清潔費。", assetKey: "buildings/picnic-park"
  }),
  observationDeck: Object.freeze({
    id: "observationDeck", name: "雲端觀景台", icon: "🔭", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 180, durationSeconds: hours(4), workTags: tags("decoration", "civil", "heavy"),
    attraction: attraction(4, minutes(45), 2, "眺望群島"),
    description: "伙伴會來眺望其他小島，每 45 分鐘帶來觀景收入。", assetKey: "buildings/observation-deck"
  }),
  ferrisWheel: Object.freeze({
    id: "ferrisWheel", name: "彩虹摩天輪", icon: "🎡", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 450, durationSeconds: hours(10), workTags: tags("decoration", "civil", "heavy"),
    attraction: attraction(8, hours(1), 3, "搭乘摩天輪"),
    description: "大型遊樂設施，伙伴會隨機搭乘；每小時帶來一筆門票收入。", assetKey: "buildings/ferris-wheel"
  }),
  hotSpring: Object.freeze({
    id: "hotSpring", name: "星空溫泉", icon: "♨️", category: "decoration", buildable: true,
    footprint: oneHex, costCoins: 320, durationSeconds: hours(8), workTags: tags("decoration", "waterfront", "civil"),
    attraction: attraction(6, hours(1), 2, "泡湯放鬆"),
    description: "伙伴施工後會來泡湯放鬆，每小時收取少量入浴費。", assetKey: "buildings/hot-spring"
  }),
  dock: Object.freeze({
    id: "dock", name: "合作碼頭", icon: "⚓", category: "logistics", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }, { q: 1, r: 0 }]), waterFootprintIndexes: Object.freeze([1]),
    costCoins: 350, durationSeconds: hours(8), workTags: tags("civil", "heavy", "waterfront"),
    description: "必須蓋在海岸，解鎖載量較大的跨島船運。", assetKey: "buildings/dock"
  }),
  airport: Object.freeze({
    id: "airport", name: "小島機場", icon: "✈️", category: "logistics", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }]), costCoins: 900, durationSeconds: hours(24), workTags: tags("civil", "heavy", "utility"),
    description: "占用三格相連陸地，解鎖快速但單次載量較小的空運。", assetKey: "buildings/airport"
  })
});

export const BUILDABLE_BUILDINGS = Object.freeze(Object.values(BUILDING_CATALOG).filter((building) => building.buildable));

export function reclamationQuote(reclaimedCount = 0) {
  const count = Math.max(0, Math.floor(Number(reclaimedCount) || 0));
  if (count < 6) return { costCoins: 25, durationSeconds: minutes(30) };
  if (count < 12) return { costCoins: 50, durationSeconds: hours(1) };
  const outerSteps = Math.floor((count - 12) / 6);
  return { costCoins: 75 + outerSteps * 10, durationSeconds: hours(2) };
}

export function recipeInputsLabel(recipe) {
  return Object.entries(recipe?.inputs || {}).map(([itemId, count]) => `${ITEM_CATALOG[itemId]?.icon || "📦"}${count}`).join(" ") || "無需原料";
}

export function recipeOutputsLabel(recipe) {
  return Object.entries(recipe?.outputs || {}).map(([itemId, count]) => `${ITEM_CATALOG[itemId]?.icon || "📦"}${count}`).join(" ");
}
