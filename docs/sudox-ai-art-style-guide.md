# SUDOX AI 美術生成標準

- Style ID：`SUDOX Buddy & Island Style v1`
- 日期：2026-08-09
- 用途：提供其他 AI 生成阿霖的數獨島伙伴、動畫、六角地圖、建築、產品、載具與特效
- 優先原則：角色身份一致、縮圖可辨識、透明邊緣乾淨、手機效能可控

本文件只定義視覺。assetKey、資料夾、sidecar、現行 renderer 是否已接通與驗收指令，統一看 `docs/island-asset-integration-guide.md`。

任何交付素材都必須記錄 Style ID、素材 ID、參考圖、prompt、negative prompt、seed／job ID、尺寸、幀率與生成日期。

## 1. 角色參考圖

- 每次生成指定動物時，必須使用 `public/assets/friends/{id}.png` 作為主要 identity reference。
- 參考圖中的臉型、耳朵、角、尾巴、色塊、斑紋、身體比例與黑線粗細都視為角色身份，不能自行重新設計。
- 工作、搬運與慶祝動畫可以改姿勢，不能改物種辨識特徵。
- 現有舞蹈動畫 `public/assets/friends-dance/{id}_{1..4}.webp` 是動態質感參考。

## 2. 小伙伴視覺定義

### 2.1 形體

- 兒童貼紙感的圓潤 chibi 動物，不是寫實、3D 公仔或硬派 8-bit 像素角色。
- 單一完整動物，全身入鏡，透明背景，沒有場景、底座、文字或白色貼紙外框。
- 一般採正面或接近正面、近似左右對稱；鯨魚、海豚等可採清楚側面。
- 大頭、短身、短肢體、低重心，以圓形、橢圓與柔和曲線構成。
- 耳朵、尾巴、角、鰭等物種特徵在縮至 64 px 時仍須清楚。
- 不畫毛髮絲、羽毛細紋、皮膚紋理或寫實肌肉。
- 手腳只使用簡單圓頭線條或 0～3 個趾端提示。

### 2.2 臉部

- 眼睛為大小接近的純黑圓點或短橢圓。
- 禁止虹膜、睫毛、眼睛高光與漸層眼珠。
- 鼻子為簡單黑色橢圓、圓角三角或物種必要造型。
- 嘴巴只使用 1～2 條圓頭黑色曲線，不畫寫實牙齒。
- 預設表情友善、安心、略帶微笑。
- 腮紅只能使用兩個低飽和粉橘色橢圓，不能搶過眼睛。

### 2.3 線條與顏色

- 最外輪廓為近黑色 `#050505`。
- 1024 px 主圖輪廓建議 22～32 px；縮至 220 px 後約 5～7 px。
- 線寬近似一致，端點與轉角圓滑，不使用鉛筆、蠟筆、水彩或顫抖手繪線。
- 每個角色以 2～5 個主色塊構成，保留物種原色與高辨識斑紋。
- 可有極輕微同色系明暗或下方陰影，明暗差不超過約 12%。
- 禁止高光反射、照片材質、毛髮紋理、戲劇性光影與霓虹光。
- 共用輔助色：暖白 `#F8F6EE`、奶油 `#FFF0DF`、腮紅 `#F3978D`、深線 `#050505`。
- 素材需能和 UI 主色珊瑚 `#FF936F`、薄荷 `#86CFB5`、深藍灰 `#344256`、奶油白 `#FFFAF2` 共存。

### 2.4 構圖

- 靜態角色主圖固定為 1024×1024 RGBA。
- 一般角色的透明 bounding box 約占畫布寬 58～72%、高 60～72%。
- 長尾、鯨魚與海豚可放寬至畫布寬 82%。
- 角色水平中心約在畫布 50～55%。
- 腳底或身體底部落在畫布高度 82～88%，保留上方呼吸空間。
- 不裁切耳朵、角、尾巴、腳或手持工具。
- 所有姿勢與方向版本必須使用同一腳底 anchor。

## 3. 小伙伴動畫標準

- 以對應靜態伙伴圖作 identity reference，鎖定臉、斑紋、尾巴、顏色與比例。
- 鏡頭、畫布、角色大小、腳底 anchor 全程固定。
- 禁止推鏡、縮放、旋轉畫布、背景晃動與角色整體漂移。
- 工作動畫輸出 220×220 RGBA Animated WebP。
- 建議 24～30 幀、12～15 fps、總長 1.6～2.2 秒。
- 第一幀與最後一幀姿勢接近，必須可以無縫循環。
- 角色位移幅度不超過角色高度 8%；工具可超出身體但不能超出畫布。
- 每段動畫只表達一個動作：敲打、挖土、澆水、採收、搬箱、裝貨或慶祝。
- 左右方向預設使用程式鏡像；工具有文字或明顯不對稱時才生成另一方向。
- 禁止額外肢體、工具穿體、斑紋跳動、臉型改變、尾巴忽長忽短或首尾瞬移。
- 單檔目標低於 180 KB，縮至 64 px 仍不應明顯閃爍。
- 完工慶祝優先重用現有 220×220、30 幀舞蹈 Animated WebP。

## 4. 六角地圖與建築

- 風格為柔和、明亮、圓潤的像素風；使用明確像素群，但不採暗色低色數 8-bit。
- 地圖使用平頂六角格，邏輯尺寸 64×56 CSS px，正式素材輸出 128×112 px。
- 視角固定為正交 3/4 俯視，約 35° 高度，建築正面朝畫面下方。
- 禁止透視消失點、廣角、魚眼與不同素材使用不同鏡頭高度。
- 光源固定來自左上方，短陰影落向右下。
- 建築輪廓使用深藍灰 `#344256` 或近黑色。
- 每張建築約使用 24～40 色，不使用照片材質、細碎噪點或過度漸層。
- 生產設施從剪影就必須能辨識用途：菜園有菜畦、牧場有牛棚、食品工廠有槽罐／貨箱、市場有棚架與攤位。
- 單格建築透明畫布建議 192×192 px；多格建築依 footprint 使用 320×224 或 384×256 px。
- 建築 anchor 固定在占地底部中心，需附在 sidecar JSON。
- 每棟建築至少有地基、半成品、接近完成、成品四種一致鏡頭狀態。
- 碼頭、道路、橋與船隻需要 6 個六角方向版本；一般建築不任意旋轉圖像。
- 遊戲顯示使用 nearest-neighbor；文字與倒數 UI 不像素化。

## 5. 產品與 UI 圖示

- 每張圖只畫一種產品或一組明確包裝，例如玉米、牛奶瓶、乳製品箱。
- 使用與伙伴相同的粗圓輪廓、簡單色塊與友善比例。
- 透明背景，不加文字、數量、貨幣符號、場景或光圈。
- 主圖輸出 128×128 RGBA；另輸出 48×48 UI 版本並人工確認清晰度。
- 原料、半成品與成品要有明顯不同的容器與剪影，不能只換顏色。
- 金幣、時間、數量與狀態由 UI 疊加，不畫死在素材中。

## 6. 禁止風格

- 寫實、攝影、3D、公仔、黏土、絨毛、油畫、水彩、素描、漫畫網點。
- Anime 大眼、眼睛高光、複雜服裝、過多配件、寫實人類手腳。
- 強烈體積光、霓虹、金屬反射、深黑硬陰影、照片背景。
- 白色貼紙邊、背景色、地面、文字、logo、浮水印。
- 模糊邊緣、髒 alpha、白色 halo、JPEG 雜訊、不同方向光源。
- 建築鏡頭角度不一致、占地漂移、施工階段突然換設計。

## 7. AI Prompt 範本

### 7.1 靜態伙伴

```text
SUDOX Buddy & Island Style v1, one cute chibi [ANIMAL] mascot, full body,
front-facing and nearly symmetrical, oversized rounded head, compact rounded body,
short simple limbs, species-defining silhouette, thick uniform pure-black rounded outline,
two solid black dot eyes with no highlights, tiny simple nose and curved mouth,
2 to 5 clean pastel color areas, extremely subtle same-color shading only,
friendly calm expression, centered on a square transparent RGBA canvas,
no background, no ground, no text, no sticker border, no cropping.
```

### 7.2 工作動畫

```text
Use the supplied SUDOX buddy as an exact identity reference. Preserve face, markings,
colors, proportions and outline thickness. Fixed camera and fixed foot anchor.
The character performs one short looping [HAMMERING / DIGGING / WATERING / CARRYING]
action with one simple tool. Transparent background. No morphing, no extra limbs,
no changing markings, no zoom, no camera motion, seamless first-to-last frame loop.
```

### 7.3 六角建築

```text
SUDOX Buddy & Island Style v1, soft pixel-art [BUILDING] for a flat-top hex island map,
orthographic three-quarter top-down view at a fixed 35-degree elevation,
front facing toward the bottom of the canvas, rounded friendly proportions,
clear functional silhouette, chunky clean pixel clusters, dark navy rounded outline,
pastel coral, mint, cream, warm wood and ocean-blue palette,
light from upper-left and short shadow to lower-right,
transparent background, no people, no text, no logo, no perspective convergence,
no photorealistic texture, centered on the supplied footprint and anchor guide.
```

### 7.4 共用 Negative Prompt

```text
photorealistic, 3D render, clay, plush toy, detailed fur, realistic anatomy,
anime eyes, eye highlights, eyelashes, thin sketch lines, watercolor, oil painting,
dramatic lighting, neon, hard shadow, background, ground plane, text, logo, watermark,
white sticker border, cropped ears, cropped tail, extra limbs, extra tools,
changing markings, character morphing, camera movement, zoom, dirty alpha, white halo,
JPEG artifacts, inconsistent perspective, inconsistent light direction
```

## 8. 檔案與中繼資料

- 原始分層檔優先使用 `.aseprite`；必要時使用分層 `.psd`。
- 靜態執行檔使用 lossless WebP，保留 PNG master。
- 角色動畫使用透明 Animated WebP；環境小動畫可使用 WebP sprite sheet＋CSS steps。
- 不新增 GIF、MP4 或 WebM 作為施工角色正式素材。
- 命名只使用小寫英文、數字與連字號，例如 `food-factory-half.webp`、`cat-hammer.webp`。
- 每個素材附同名 `.json`，至少包含：

```json
{
  "styleId": "SUDOX Buddy & Island Style v1",
  "assetId": "cat-hammer",
  "sourceKey": "actors/work/cat-hammer",
  "reference": "friends/cat.png",
  "width": 220,
  "height": 220,
  "frames": 30,
  "fps": 15,
  "anchor": { "x": 110, "y": 194 },
  "prompt": "...",
  "negativePrompt": "...",
  "seedOrJobId": "...",
  "generatedAt": "..."
}
```

## 9. 驗收清單

- 角色耳朵、臉、斑紋、尾巴、主色與參考圖一致。
- 1024 px、220 px、64 px 都檢查過，縮圖仍可辨識。
- 黑線粗細一致，沒有白邊、透明髒點與壓縮雜訊。
- 動畫逐幀檢查額外肢體、工具變形、輪廓閃爍與首尾跳動。
- 腳底 anchor 固定，角色不會在地圖上上下漂浮。
- 建築正確落在標準六角 footprint，沒有遮住錯誤格。
- 同建築各施工階段的鏡頭、色彩、光源與 footprint 一致。
- 產品在 48×48 時不看文字也能分辨。
- 單檔與首屏總容量符合架構規劃書的效能預算。
- sidecar JSON 完整，可由另一個 AI 或人工重新產出。

## 10. 第一組風格驗證素材

批量生產前只先做：

1. 海面、草地與 6 方向海岸。
2. 填海三個施工階段。
3. 菜園四階段與蔬菜圖示。
4. 市場成品與蔬菜換金幣效果。
5. 貓伙伴敲打工作循環。
6. 共用煙塵與完工星光。
7. 390×844 手機版 7 格小島合成預覽。

此組通過角色一致性、地圖比例、縮圖辨識與容量檢查後，才開始生成其餘伙伴、設施與產品。
