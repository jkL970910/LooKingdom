# 新增静态插画 · 2026-09-22

使用内置 image_gen 工具生成。参考现有 cards.webp 与 blue-states-alpha.webp 的角色、衣着、绒毛材质和光照。输出为透明背景双栏精灵图，左蓝 Loo，右红 Loo；转换为 1536×768 WebP（质量 86），保留透明通道。

- public/art/wish-cards.webp：Loo心愿兑现券，开放礼盒中放相机与四叶草手链。
- public/art/eating.webp：干饭中，抱饭碗夹番茄炒蛋，脸颊留一粒米饭。

## 心愿券生成提示词

Create a new production sprite sheet for Loo Kingdom couple mobile app. The two recent images are ONLY character/style references (first cards sheet, second activity sheet). Output one wide 1536x768 image, genuine transparent background. Two equal square cells side by side, every object contained inside its own cell with generous transparent padding. LEFT: reference pink furry beaver with tiny ears, two head hairs, purple oval nose and buck teeth, wearing blue overalls, joyfully holding an open ivory gift box with pastel blue ribbon, a small premium camera and tiny gold clover bracelet nestled visibly in the box. RIGHT: same pink character in coral dress and red bow, joyfully holding an open ivory gift box with coral ribbon, same camera and gold clover bracelet. Match existing warm adorable high quality 3D plush render, round stubby proportions, soft studio illumination, tiny hearts and star sparkles, complete full body seated characters. No text, logos, watermark, panels or cell outlines. Two owner variants of a gift redemption coupon named Loo 心愿兑现券. Each variant centered exactly within its square half, no crossing center line. Return saved local image path.

## 干饭状态生成提示词

Create a new production activity sprite sheet for Loo Kingdom matching the recent reference pink plush beaver character sheets. Asset: 干饭中 / happily eating. One wide 1536x768 image with two equal square cells, transparent background with real alpha, no grid lines. LEFT blue Loo: pink plush beaver, blue overalls, tiny ears, purple oval nose, two head hairs, buck teeth; sitting at a little round honey wood dining table holding a large blue rice bowl with one hand, chopsticks lifting food toward mouth with other hand, puffed happy cheeks, one tiny rice grain on cheek, playful delighted expression. A small plate of tomato scrambled eggs on table. RIGHT red Loo: identical species/face proportions, coral dress and red bow, matching little table and red rice bowl, enthusiastic happy eating gesture and cheeks. Warm adorable high quality 3D plush fur render, gentle studio light, complete seated full body, isolated props, visually readable at tiny mobile size, generous transparent padding per cell, each composition fully within its square half. No text, logo, watermark, backdrop or floor. Keep visual proportions/style exactly consistent with existing activity sheet. Return saved local image path.
