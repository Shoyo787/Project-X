import {
  ENEMY_CONFIGS,
  GRID_COLS,
  GRID_ROWS,
  KEEP_COORD,
  PATH_WAYPOINTS,
  TOWER_CONFIGS,
  getBuildableConfig,
  getTileType,
  isTowerId,
} from '../config';
import { GameEngine } from '../engine/GameEngine';
import {
  BuildableId,
  CloudInstance,
  EnemyInstance,
  GridCoord,
  PlacedEntity,
  ProjectileInstance,
} from '../../types/game';
import {
  INK_COLOR,
  TILE_HEIGHT,
  TILE_WIDTH,
  Z_SCALE,
  drawIsoBox,
  drawIsoEllipse,
  drawIsoPyramid,
  drawIsoTile,
  gridToScreen,
  screenToGrid,
} from './IsoMath';

export interface RenderInteractionState {
  hoveredTile: GridCoord | null;
  selectedEntityId: string | null;
  selectedBuildId: BuildableId | null;
}

interface DepthRenderItem {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export class IsoRenderer {
  private originX = 0;
  private originY = 0;
  private scale = 1;

  public computeViewportTransform(width: number, height: number): {
    originX: number;
    originY: number;
    scale: number;
  } {
    // Full diamond spans (GRID_COLS + GRID_ROWS) * TILE_WIDTH / 2 horizontally
    const islandWidth = (GRID_COLS + GRID_ROWS) * (TILE_WIDTH * 0.5) + 110;
    const islandHeight = (GRID_COLS + GRID_ROWS) * (TILE_HEIGHT * 0.5) + 210;

    const scaleX = (width * 0.86) / islandWidth;
    const scaleY = (height * 0.78) / islandHeight;
    const scale = Math.max(0.55, Math.min(1.32, Math.min(scaleX, scaleY)));

    // Center the midpoint of the 12x10 grid slightly below top HUD and above build dock
    const centerCol = (GRID_COLS - 1) * 0.5;
    const centerRow = (GRID_ROWS - 1) * 0.5;
    const rawCenterX = (centerCol - centerRow) * (TILE_WIDTH * 0.5);
    const rawCenterY = (centerCol + centerRow) * (TILE_HEIGHT * 0.5);

    const originX = width / (2 * scale) - rawCenterX;
    const originY = height / (2 * scale) - rawCenterY - 12;

    this.originX = originX;
    this.originY = originY;
    this.scale = scale;

    return { originX, originY, scale };
  }

  public pickGridTile(canvasX: number, canvasY: number): GridCoord {
    const localX = canvasX / this.scale;
    const localY = canvasY / this.scale;
    return screenToGrid(localX, localY, this.originX, this.originY);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    interaction: RenderInteractionState,
    timeSec: number,
  ): void {
    const nowMs = Date.now();
    const state = engine.getState();
    const visual = engine.getVisualState();

    this.computeViewportTransform(width, height);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Warm atmospheric sky & sunlight gradient
    this.drawSkyBackdrop(ctx, width, height, engine.getClouds());

    // Apply responsive zoom + subtle cannon screen-shake
    const shakeX =
      visual.screenShake > 0 ? (Math.random() - 0.5) * visual.screenShake * 2 : 0;
    const shakeY =
      visual.screenShake > 0 ? (Math.random() - 0.5) * visual.screenShake * 1.6 : 0;

    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(shakeX, shakeY);

    // 2. Floating island slate cliff base & waterfall
    this.drawFloatingCliffBase(ctx, timeSec);

    // 3. 12x10 Isometric terrain tiles (grass, sandstone path, keep plaza)
    this.drawTerrainGrid(ctx, interaction, engine, timeSec);

    // 4. Entry stone archway at PATH_WAYPOINTS[0]
    this.drawRaiderGate(ctx);

    // 5. Isometric range ring preview for selected or hovered tower
    this.drawRangeRings(ctx, engine, interaction);

    // 6. Depth-sorted world objects (Keep, Buildings, Towers, Enemies)
    const items: DepthRenderItem[] = [];

    items.push({
      depth: KEEP_COORD.col + KEEP_COORD.row + 0.05,
      draw: (c) => this.drawBastionKeep(c, state.keepHp, state.keepMaxHp, timeSec),
    });

    for (const entity of state.entities) {
      items.push({
        depth: entity.col + entity.row + 0.12,
        draw: (c) =>
          this.drawPlacedEntity(
            c,
            entity,
            interaction.selectedEntityId === entity.id,
            visual.towerRecoilMap[entity.id] ?? 0,
            visual.towerAngleMap[entity.id] ?? 0,
            timeSec,
            nowMs,
          ),
      });
    }

    for (const enemy of engine.getEnemies()) {
      items.push({
        depth: enemy.col + enemy.row + 0.18,
        draw: (c) => this.drawEnemy(c, enemy, timeSec, nowMs),
      });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) {
      item.draw(ctx);
    }

    // 7. Arcing projectiles & shadows
    for (const proj of engine.getProjectiles()) {
      this.drawProjectile(ctx, proj);
    }

    // 8. Frost rings & dust particles
    this.drawParticles(ctx, engine);

    // 9. Floating combat & resource numbers
    this.drawFloatingTexts(ctx, engine);

    ctx.restore();
    ctx.restore();
  }

  private drawSkyBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    clouds: readonly CloudInstance[],
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#c6dce3');
    grad.addColorStop(0.5, '#e8ece2');
    grad.addColorStop(1, '#f4e4c1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft warm sunlight rays from top-left
    ctx.save();
    const sunGlow = ctx.createRadialGradient(
      width * 0.16,
      height * 0.12,
      10,
      width * 0.16,
      height * 0.12,
      width * 0.55,
    );
    sunGlow.addColorStop(0, 'rgba(248, 232, 186, 0.52)');
    sunGlow.addColorStop(1, 'rgba(244, 228, 193, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Stylized low-poly clouds
    for (const cloud of clouds) {
      const cx = cloud.x * width;
      const cy = cloud.y * height;
      const s = cloud.scale;

      ctx.save();
      ctx.globalAlpha = cloud.opacity;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(43, 38, 35, 0.22)';
      ctx.lineWidth = 1.2;

      // Cloud facet polygon
      ctx.beginPath();
      ctx.moveTo(cx - 56 * s, cy + 10 * s);
      ctx.lineTo(cx - 32 * s, cy - 12 * s);
      ctx.lineTo(cx - 4 * s, cy - 22 * s);
      ctx.lineTo(cx + 28 * s, cy - 10 * s);
      ctx.lineTo(cx + 58 * s, cy + 8 * s);
      ctx.lineTo(cx + 22 * s, cy + 16 * s);
      ctx.lineTo(cx - 24 * s, cy + 16 * s);
      ctx.closePath();
      ctx.fillStyle = '#fcf8ef';
      ctx.fill();
      ctx.stroke();

      // Underside shade
      ctx.beginPath();
      ctx.moveTo(cx - 56 * s, cy + 10 * s);
      ctx.lineTo(cx - 24 * s, cy + 16 * s);
      ctx.lineTo(cx + 22 * s, cy + 16 * s);
      ctx.lineTo(cx + 58 * s, cy + 8 * s);
      ctx.lineTo(cx + 15 * s, cy + 21 * s);
      ctx.lineTo(cx - 28 * s, cy + 21 * s);
      ctx.closePath();
      ctx.fillStyle = '#dfd8c8';
      ctx.fill();

      ctx.restore();
    }
  }

  private drawFloatingCliffBase(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const midPt = gridToScreen(
      (GRID_COLS - 1) * 0.5,
      (GRID_ROWS - 1) * 0.5,
      0,
      this.originX,
      this.originY,
    );

    // Soft floating island shadow aura beneath the crags
    ctx.save();
    ctx.fillStyle = 'rgba(43, 38, 35, 0.14)';
    ctx.beginPath();
    ctx.ellipse(midPt.x, midPt.y + 158, 330, 110, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.5;

    const frontCornerX = gridToScreen(
      GRID_COLS - 0.5,
      GRID_ROWS - 0.5,
      0,
      this.originX,
      this.originY,
    ).x;

    // 1. Build continuous Front-Left cliff mesh (col = 0..GRID_COLS along row = GRID_ROWS - 0.5)
    const leftTop: { x: number; y: number }[] = [];
    const leftMid: { x: number; y: number }[] = [];
    const leftBot: { x: number; y: number }[] = [];

    for (let i = 0; i <= GRID_COLS; i++) {
      const pt = gridToScreen(i - 0.5, GRID_ROWS - 0.5, 0, this.originX, this.originY);
      const t = i / GRID_COLS;
      const topY = pt.y + 8;
      const midDrop = 22 + t * 38 + Math.sin(i * 1.4) * 7;
      const botDrop = 22 + Math.pow(t, 0.88) * 108 + (i === 0 || i === GRID_COLS ? 0 : Math.cos(i * 1.7) * 10);
      const pullX = (frontCornerX - pt.x) * 0.14 * t;

      leftTop.push({ x: pt.x, y: topY });
      leftMid.push({ x: pt.x + pullX * 0.35, y: topY + midDrop });
      leftBot.push({ x: pt.x + pullX, y: topY + botDrop });
    }

    const leftUpperColors = ['#5a626a', '#535b63', '#616972'];
    const leftLowerColors = ['#464d55', '#3e454c', '#4c545c'];

    for (let i = 0; i < GRID_COLS; i++) {
      // Upper rocky cliff facet
      ctx.beginPath();
      ctx.moveTo(leftTop[i].x, leftTop[i].y);
      ctx.lineTo(leftTop[i + 1].x, leftTop[i + 1].y);
      ctx.lineTo(leftMid[i + 1].x, leftMid[i + 1].y);
      ctx.lineTo(leftMid[i].x, leftMid[i].y);
      ctx.closePath();
      ctx.fillStyle = leftUpperColors[i % leftUpperColors.length];
      ctx.fill();
      ctx.stroke();

      // Lower tapered cliff facet
      ctx.beginPath();
      ctx.moveTo(leftMid[i].x, leftMid[i].y);
      ctx.lineTo(leftMid[i + 1].x, leftMid[i + 1].y);
      ctx.lineTo(leftBot[i + 1].x, leftBot[i + 1].y);
      ctx.lineTo(leftBot[i].x, leftBot[i].y);
      ctx.closePath();
      ctx.fillStyle = leftLowerColors[i % leftLowerColors.length];
      ctx.fill();
      ctx.stroke();
    }

    // 2. Build continuous Front-Right cliff mesh (row = 0..GRID_ROWS along col = GRID_COLS - 0.5)
    const rightTop: { x: number; y: number }[] = [];
    const rightMid: { x: number; y: number }[] = [];
    const rightBot: { x: number; y: number }[] = [];

    for (let j = 0; j <= GRID_ROWS; j++) {
      // j=0 is front corner (shared with left[GRID_COLS]), j=GRID_ROWS is far-right tip
      const rowVal = GRID_ROWS - 0.5 - j;
      const pt = gridToScreen(GRID_COLS - 0.5, rowVal, 0, this.originX, this.originY);
      const t = 1 - j / GRID_ROWS;
      const topY = pt.y + 8;
      const midDrop =
        j === 0
          ? leftMid[GRID_COLS].y - topY
          : 20 + t * 40 + Math.sin(j * 1.5) * 6;
      const botDrop =
        j === 0
          ? leftBot[GRID_COLS].y - topY
          : 20 + Math.pow(t, 0.88) * 110 + (j === GRID_ROWS ? 0 : Math.sin(j * 1.8) * 9);
      const pullX = (frontCornerX - pt.x) * 0.14 * t;

      rightTop.push({ x: pt.x, y: topY });
      rightMid.push({ x: pt.x + pullX * 0.35, y: topY + midDrop });
      rightBot.push({ x: pt.x + pullX, y: topY + botDrop });
    }

    const rightUpperColors = ['#444b53', '#3d444b', '#495058'];
    const rightLowerColors = ['#32383f', '#2c3138', '#373e45'];

    for (let j = 0; j < GRID_ROWS; j++) {
      ctx.beginPath();
      ctx.moveTo(rightTop[j].x, rightTop[j].y);
      ctx.lineTo(rightTop[j + 1].x, rightTop[j + 1].y);
      ctx.lineTo(rightMid[j + 1].x, rightMid[j + 1].y);
      ctx.lineTo(rightMid[j].x, rightMid[j].y);
      ctx.closePath();
      ctx.fillStyle = rightUpperColors[j % rightUpperColors.length];
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightMid[j].x, rightMid[j].y);
      ctx.lineTo(rightMid[j + 1].x, rightMid[j + 1].y);
      ctx.lineTo(rightBot[j + 1].x, rightBot[j + 1].y);
      ctx.lineTo(rightBot[j].x, rightBot[j].y);
      ctx.closePath();
      ctx.fillStyle = rightLowerColors[j % rightLowerColors.length];
      ctx.fill();
      ctx.stroke();
    }

    // 3. Stylized waterfall cascade spilling off col=7, row=GRID_ROWS-1
    const wfTop = gridToScreen(7, GRID_ROWS - 0.5, 0, this.originX, this.originY);
    const streamTopX = wfTop.x;
    const streamTopY = wfTop.y + 6;
    ctx.beginPath();
    ctx.moveTo(streamTopX - 7, streamTopY - 2);
    ctx.lineTo(streamTopX + 7, streamTopY + 5);
    ctx.lineTo(streamTopX + 9, streamTopY + 110);
    ctx.lineTo(streamTopX - 6, streamTopY + 104);
    ctx.closePath();
    ctx.fillStyle = '#7ac3d4';
    ctx.fill();
    ctx.stroke();

    // Animated white foam highlights on the waterfall
    ctx.fillStyle = '#f2fbff';
    for (let i = 0; i < 4; i++) {
      const offset = ((timeSec * 36 + i * 24) % 94) + 6;
      ctx.beginPath();
      ctx.ellipse(streamTopX + 1, streamTopY + offset, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawTerrainGrid(
    ctx: CanvasRenderingContext2D,
    interaction: RenderInteractionState,
    engine: GameEngine,
    timeSec: number,
  ): void {
    const maxSum = GRID_COLS + GRID_ROWS - 2;

    for (let sum = 0; sum <= maxSum; sum++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const row = sum - col;
        if (row < 0 || row >= GRID_ROWS) continue;

        const pt = gridToScreen(col, row, 0, this.originX, this.originY);
        const tileType = getTileType(col, row);
        const seed = (col * 31 + row * 17) % 5;

        if (tileType === 'path') {
          drawIsoTile(
            ctx,
            pt.x,
            pt.y + 3,
            TILE_WIDTH,
            TILE_HEIGHT,
            seed % 2 === 0 ? '#d8c8a8' : '#d2c19f',
            '#b8a787',
            '#9c8b6e',
            5,
            INK_COLOR,
            1.35,
          );
          this.drawPathStoneAccent(ctx, pt.x, pt.y + 3, seed);
        } else if (tileType === 'keep') {
          drawIsoTile(
            ctx,
            pt.x,
            pt.y,
            TILE_WIDTH,
            TILE_HEIGHT,
            '#cfc2aa',
            '#a59781',
            '#8b7e6a',
            8,
            INK_COLOR,
            1.4,
          );
        } else {
          const grassShades = ['#7c9a6e', '#779569', '#81a073', '#759267', '#7f9d71'];
          drawIsoTile(
            ctx,
            pt.x,
            pt.y,
            TILE_WIDTH,
            TILE_HEIGHT,
            grassShades[seed],
            '#607a54',
            '#4d6343',
            8,
            INK_COLOR,
            1.35,
          );

          // Tiny decorative grass tufts on empty grass tiles
          if (!engine.getEntityAt(col, row) && seed === 1) {
            this.drawGrassTuft(ctx, pt.x - 10, pt.y + 1, timeSec + col);
          } else if (!engine.getEntityAt(col, row) && seed === 4) {
            this.drawSmallPebble(ctx, pt.x + 11, pt.y - 2);
          }
        }

        // Hover highlight
        if (
          interaction.hoveredTile &&
          interaction.hoveredTile.col === col &&
          interaction.hoveredTile.row === row
        ) {
          const placing = interaction.selectedBuildId !== null;
          const valid = placing ? engine.canPlaceAt(col, row) : true;
          const fill = placing
            ? valid
              ? 'rgba(244, 228, 193, 0.48)'
              : 'rgba(200, 100, 70, 0.48)'
            : 'rgba(255, 250, 232, 0.25)';
          const stroke = placing ? (valid ? '#f4e4c1' : '#c86446') : '#fff7dc';

          drawIsoTile(
            ctx,
            pt.x,
            pt.y + (tileType === 'path' ? 3 : 0),
            TILE_WIDTH - 4,
            TILE_HEIGHT - 2,
            fill,
            'transparent',
            'transparent',
            0,
            stroke,
            2,
          );
        }
      }
    }
  }

  private drawPathStoneAccent(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    seed: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(43, 38, 35, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (seed % 2 === 0) {
      ctx.moveTo(cx - 12, cy - 2);
      ctx.lineTo(cx + 4, cy + 5);
      ctx.moveTo(cx + 5, cy - 5);
      ctx.lineTo(cx + 14, cy);
    } else {
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx + 8, cy - 4);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawGrassTuft(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    phase: number,
  ): void {
    const sway = Math.sin(phase * 1.8) * 1.2;
    ctx.save();
    ctx.strokeStyle = '#3f5436';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x - 4 + sway, y - 5);
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + 2 + sway, y - 6);
    ctx.stroke();
    ctx.restore();
  }

  private drawSmallPebble(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = '#9aa0a6';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawRaiderGate(ctx: CanvasRenderingContext2D): void {
    const start = PATH_WAYPOINTS[0];
    const pt = gridToScreen(start.col, start.row, 0, this.originX, this.originY);
    // Two small carved stone road markers flanking the spawn edge
    drawIsoBox(ctx, pt.x - 16, pt.y - 4, 6, 3.5, 16, '#878f96', '#697178', '#51585e', 1.4);
    drawIsoBox(ctx, pt.x - 2, pt.y + 8, 6, 3.5, 16, '#878f96', '#697178', '#51585e', 1.4);
  }

  private drawRangeRings(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    interaction: RenderInteractionState,
  ): void {
    if (interaction.selectedBuildId && isTowerId(interaction.selectedBuildId) && interaction.hoveredTile) {
      const { col, row } = interaction.hoveredTile;
      if (engine.canPlaceAt(col, row)) {
        const cfg = TOWER_CONFIGS[interaction.selectedBuildId];
        const pt = gridToScreen(col, row, 0, this.originX, this.originY);
        drawIsoEllipse(
          ctx,
          pt.x,
          pt.y,
          cfg.levels[0].range,
          '#2b2623',
          'rgba(244, 228, 193, 0.16)',
          1.7,
          true,
        );
      }
    }

    if (interaction.selectedEntityId) {
      const entity = engine.getEntityById(interaction.selectedEntityId);
      if (entity && isTowerId(entity.configId)) {
        const cfg = TOWER_CONFIGS[entity.configId];
        const stats = cfg.levels[Math.min(entity.level - 1, cfg.levels.length - 1)];
        const pt = gridToScreen(entity.col, entity.row, 0, this.originX, this.originY);
        drawIsoEllipse(
          ctx,
          pt.x,
          pt.y,
          stats.range,
          cfg.accentColor,
          'rgba(244, 228, 193, 0.14)',
          2.0,
          true,
        );
      }
    }
  }

  private drawBastionKeep(
    ctx: CanvasRenderingContext2D,
    keepHp: number,
    keepMaxHp: number,
    timeSec: number,
  ): void {
    const pt = gridToScreen(KEEP_COORD.col, KEEP_COORD.row, 0, this.originX, this.originY);

    // Directional drop shadow
    ctx.save();
    ctx.fillStyle = 'rgba(43, 38, 35, 0.22)';
    ctx.beginPath();
    ctx.ellipse(pt.x + 8, pt.y + 4, 29, 14, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Stone base plinth
    drawIsoBox(ctx, pt.x, pt.y, 24, 12, 18, '#dcd2bf', '#aba18e', '#867d6c', 1.7);

    // Central high tower
    drawIsoBox(ctx, pt.x, pt.y - 18, 15, 7.5, 28, '#ebe2d0', '#b7ad9b', '#918775', 1.6);

    // Terracotta royal spire roof
    drawIsoPyramid(ctx, pt.x, pt.y - 46, 18, 9.5, 24, '#d16b4d', '#a64d33', 1.6);

    // Flagpole & waving banner
    const waveOffset = Math.sin(timeSec * 4.5) * 2.5;
    ctx.save();
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - 70);
    ctx.lineTo(pt.x, pt.y - 84);
    ctx.stroke();

    ctx.fillStyle = '#f4c76b';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - 84);
    ctx.lineTo(pt.x + 14, pt.y - 80 + waveOffset);
    ctx.lineTo(pt.x, pt.y - 75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Keep HP bar above the spire
    this.drawHealthPill(ctx, pt.x, pt.y - 95, 44, keepHp / keepMaxHp, '#c86446', `${keepHp}/${keepMaxHp}`);
  }

  private drawPlacedEntity(
    ctx: CanvasRenderingContext2D,
    entity: PlacedEntity,
    isSelected: boolean,
    recoil: number,
    aimAngle: number,
    timeSec: number,
    nowMs: number,
  ): void {
    const pt = gridToScreen(entity.col, entity.row, 0, this.originX, this.originY);
    const bob = Math.sin(timeSec * 2.6 + entity.col + entity.row) * 1.1;
    const isUpgrading = entity.upgradeFinishTimestamp !== null;

    // Selection halo on tile
    if (isSelected) {
      drawIsoEllipse(
        ctx,
        pt.x,
        pt.y + 1,
        0.58,
        '#f4e4c1',
        'rgba(244, 228, 193, 0.34)',
        2.2,
        false,
      );
    }

    // Soft ground shadow
    ctx.save();
    ctx.fillStyle = 'rgba(43, 38, 35, 0.2)';
    ctx.beginPath();
    ctx.ellipse(pt.x + 6, pt.y + 3, 21, 10, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    switch (entity.configId) {
      case 'archer_spire':
        this.drawArcherSpire(ctx, pt.x, pt.y, entity.level, recoil, bob);
        break;
      case 'frost_obelisk':
        this.drawFrostObelisk(ctx, pt.x, pt.y, entity.level, recoil, timeSec);
        break;
      case 'cannon_bastion':
        this.drawCannonBastion(ctx, pt.x, pt.y, entity.level, recoil, aimAngle);
        break;
      case 'quarry_mine':
        this.drawQuarryMine(ctx, pt.x, pt.y, entity.level, timeSec);
        break;
      case 'aether_conduit':
        this.drawAetherConduit(ctx, pt.x, pt.y, entity.level, timeSec);
        break;
      case 'storage_vault':
        this.drawStorageVault(ctx, pt.x, pt.y, entity.level);
        break;
    }

    // Wooden scaffolding & diegetic upgrade timer ring
    if (
      isUpgrading &&
      entity.upgradeFinishTimestamp !== null &&
      entity.upgradeStartTimestamp !== null
    ) {
      this.drawScaffolding(ctx, pt.x, pt.y);
      this.drawUpgradeRing(
        ctx,
        pt.x,
        pt.y - 62,
        entity.upgradeStartTimestamp,
        entity.upgradeFinishTimestamp,
        nowMs,
      );
    } else {
      // Crisp level badge pill
      this.drawLevelBadge(ctx, pt.x + 15, pt.y - 4, entity.level);
    }
  }

  private drawArcherSpire(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
    recoil: number,
    bob: number,
  ): void {
    const heightScale = 1 + (level - 1) * 0.09;
    const bounceY = -recoil * 3.5 + bob * 0.45;

    // Stone foundation
    drawIsoBox(ctx, cx, cy, 16, 8, 10, '#c8bfa8', '#988f7d', '#7b7363', 1.5);
    // Timber watchtower shaft
    drawIsoBox(
      ctx,
      cx,
      cy - 10 + bounceY * 0.4,
      12,
      6,
      20 * heightScale,
      '#e3d3b4',
      '#b89262',
      '#8f6d45',
      1.5,
    );
    // Terracotta peaked roof
    drawIsoPyramid(
      ctx,
      cx,
      cy - 10 - 20 * heightScale + bounceY,
      16,
      8.5,
      19,
      '#d97252',
      '#b04e33',
      1.6,
    );
  }

  private drawFrostObelisk(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
    recoil: number,
    timeSec: number,
  ): void {
    const floatY = Math.sin(timeSec * 3.1) * 3.2 - recoil * 4;
    const tierHeight = 20 + level * 2.5;

    // Carved slate dais
    drawIsoBox(ctx, cx, cy, 17, 8.5, 8, '#9aa5ad', '#6b747d', '#51585f', 1.5);
    // Narrow obelisk neck
    drawIsoBox(ctx, cx, cy - 8, 9, 4.5, tierHeight, '#7b8790', '#5b646c', '#434a52', 1.5);

    // Floating crystalline octahedron above the obelisk
    const crystalY = cy - 16 - tierHeight + floatY;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.5;

    // Upper crystal pyramid
    ctx.beginPath();
    ctx.moveTo(cx, crystalY - 16);
    ctx.lineTo(cx - 10, crystalY);
    ctx.lineTo(cx, crystalY + 5);
    ctx.closePath();
    ctx.fillStyle = '#9be2ef';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, crystalY - 16);
    ctx.lineTo(cx, crystalY + 5);
    ctx.lineTo(cx + 10, crystalY);
    ctx.closePath();
    ctx.fillStyle = '#5ba4b5';
    ctx.fill();
    ctx.stroke();

    // Lower crystal point
    ctx.beginPath();
    ctx.moveTo(cx - 10, crystalY);
    ctx.lineTo(cx, crystalY + 5);
    ctx.lineTo(cx, crystalY + 14);
    ctx.closePath();
    ctx.fillStyle = '#478999';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, crystalY + 5);
    ctx.lineTo(cx + 10, crystalY);
    ctx.lineTo(cx, crystalY + 14);
    ctx.closePath();
    ctx.fillStyle = '#366f7d';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawCannonBastion(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
    recoil: number,
    aimAngle: number,
  ): void {
    const baseHeight = 17 + (level - 1) * 2;
    // Heavy slate bunker
    drawIsoBox(ctx, cx, cy, 19, 9.5, baseHeight, '#858e96', '#5f676f', '#464d54', 1.6);
    // Top gun platform
    drawIsoBox(
      ctx,
      cx,
      cy - baseHeight,
      14,
      7,
      5,
      '#9da5ad',
      '#6d757d',
      '#545b62',
      1.4,
    );

    // Orientable iron cannon barrel with recoil kickback
    const screenDirX = Math.cos(aimAngle) - Math.sin(aimAngle);
    const screenDirY = (Math.cos(aimAngle) + Math.sin(aimAngle)) * 0.5;
    const norm = Math.hypot(screenDirX, screenDirY) || 1;
    const ux = screenDirX / norm;
    const uy = screenDirY / norm;

    const pivotX = cx - ux * recoil * 4.5;
    const pivotY = cy - baseHeight - 7 - uy * recoil * 2.5;
    const barrelLen = 17 + level * 1.2;

    ctx.save();
    ctx.lineCap = 'round';
    // Ink outline
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 10.5;
    ctx.beginPath();
    ctx.moveTo(pivotX - ux * 4, pivotY - uy * 4);
    ctx.lineTo(pivotX + ux * barrelLen, pivotY + uy * barrelLen - 2);
    ctx.stroke();

    // Inner dark iron barrel
    ctx.strokeStyle = '#3c4248';
    ctx.lineWidth = 7.2;
    ctx.beginPath();
    ctx.moveTo(pivotX - ux * 4, pivotY - uy * 4);
    ctx.lineTo(pivotX + ux * barrelLen, pivotY + uy * barrelLen - 2);
    ctx.stroke();

    // Brass muzzle ring
    ctx.fillStyle = '#d9a441';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(pivotX + ux * barrelLen, pivotY + uy * barrelLen - 2, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawQuarryMine(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
    timeSec: number,
  ): void {
    // Sandstone mine shed & gold ore crates
    drawIsoBox(ctx, cx - 3, cy - 1, 16, 8, 13 + level, '#e4cfa3', '#b89b6a', '#91784d', 1.5);
    drawIsoPyramid(ctx, cx - 3, cy - 14 - level, 18, 9, 11, '#c98a49', '#9c6630', 1.5);

    // Animated crane arm bobbing gently
    const hoistY = Math.sin(timeSec * 2.5) * 2.5;
    ctx.save();
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + 9, cy + 2);
    ctx.lineTo(cx + 9, cy - 22);
    ctx.lineTo(cx + 19, cy - 26 + hoistY * 0.3);
    ctx.stroke();

    // Hanging gold ingot crate
    ctx.fillStyle = '#f4c76b';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.rect(cx + 15, cy - 18 + hoistY, 7, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawAetherConduit(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
    timeSec: number,
  ): void {
    // Octagonal/diamond basin with glowing cyan Aether pool
    drawIsoBox(ctx, cx, cy, 17, 8.5, 9, '#5ec2d4', '#727b84', '#555d66', 1.5);

    // Three floating crystal shards orbiting slowly
    const pulse = Math.sin(timeSec * 3.5) * 2;
    drawIsoBox(
      ctx,
      cx - 8,
      cy - 10 + pulse * 0.5,
      4.5,
      2.5,
      12 + level,
      '#b4eff7',
      '#5ba4b5',
      '#3f7e8e',
      1.3,
    );
    drawIsoBox(
      ctx,
      cx + 8,
      cy - 10 - pulse * 0.5,
      4.5,
      2.5,
      12 + level,
      '#b4eff7',
      '#5ba4b5',
      '#3f7e8e',
      1.3,
    );
    drawIsoPyramid(ctx, cx, cy - 16 + pulse, 7, 3.8, 16 + level, '#a8eef7', '#4e9aad', 1.4);
  }

  private drawStorageVault(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
  ): void {
    const h = 15 + level * 1.5;
    // Sturdy treasury warehouse
    drawIsoBox(ctx, cx, cy, 19, 9.5, h, '#e8dcc2', '#b9aa8f', '#92846c', 1.6);
    drawIsoPyramid(ctx, cx, cy - h, 21, 10.5, 13, '#c86446', '#9a4730', 1.6);

    // Small golden clasp badge on front-left wall
    ctx.save();
    ctx.fillStyle = '#f4c76b';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(cx - 11, cy - 7, 6, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawScaffolding(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.strokeStyle = '#9c6d3b';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Vertical timber poles
    ctx.moveTo(cx - 15, cy + 2);
    ctx.lineTo(cx - 15, cy - 36);
    ctx.moveTo(cx + 15, cy + 2);
    ctx.lineTo(cx + 15, cy - 36);
    ctx.moveTo(cx, cy + 9);
    ctx.lineTo(cx, cy - 31);
    // Cross-braces
    ctx.moveTo(cx - 15, cy - 16);
    ctx.lineTo(cx, cy - 9);
    ctx.lineTo(cx + 15, cy - 16);
    ctx.moveTo(cx - 15, cy - 31);
    ctx.lineTo(cx, cy - 24);
    ctx.lineTo(cx + 15, cy - 31);
    ctx.stroke();
    ctx.restore();
  }

  private drawUpgradeRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    startMs: number,
    finishMs: number,
    nowMs: number,
  ): void {
    const total = Math.max(1000, finishMs - startMs);
    const remaining = Math.max(0, finishMs - nowMs);
    const pct = Math.min(1, Math.max(0, 1 - remaining / total));
    const remSec = Math.ceil(remaining / 1000);
    const label =
      remSec >= 60 ? `${Math.floor(remSec / 60)}m${remSec % 60}s` : `${remSec}s`;

    ctx.save();
    // Parchment pill badge
    ctx.fillStyle = '#fcf8ef';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Progress arc
    ctx.beginPath();
    ctx.arc(cx, cy, 11, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * pct);
    ctx.strokeStyle = '#c86446';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Remaining time text
    ctx.fillStyle = INK_COLOR;
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 0.5);
    ctx.restore();
  }

  private drawLevelBadge(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    level: number,
  ): void {
    ctx.save();
    ctx.fillStyle = '#f6efe2';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK_COLOR;
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${level}`, cx, cy + 0.5);
    ctx.restore();
  }

  private drawEnemy(
    ctx: CanvasRenderingContext2D,
    enemy: EnemyInstance,
    timeSec: number,
    nowMs: number,
  ): void {
    const cfg = ENEMY_CONFIGS[enemy.configId];
    const pt = gridToScreen(enemy.col, enemy.row, 0, this.originX, this.originY);
    const hop = Math.abs(Math.sin(enemy.totalDistanceTraveled * 5.2 + timeSec * 1.5)) * 3.8;
    const isChilled = enemy.slowUntilMs > nowMs;
    const isFlashing = enemy.hitFlashUntilMs > nowMs;

    const s = cfg.scale;
    const rx = 8 * s;
    const ry = 4.2 * s;
    const bodyHeight = 14 * s;

    // Ground shadow
    ctx.save();
    ctx.fillStyle = isChilled ? 'rgba(91, 164, 181, 0.35)' : 'rgba(43, 38, 35, 0.24)';
    ctx.beginPath();
    ctx.ellipse(pt.x + 3, pt.y + 3, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const topCol = isFlashing ? '#ffffff' : isChilled ? '#9ce3f0' : cfg.secondaryColor;
    const leftCol = isFlashing ? '#f8f2e4' : isChilled ? '#5ba4b5' : cfg.primaryColor;
    const rightCol = isFlashing ? '#e9dfca' : isChilled ? '#3d7988' : '#3a3430';

    drawIsoBox(ctx, pt.x, pt.y - hop, rx, ry, bodyHeight, topCol, leftCol, rightCol, 1.45);

    // Boss crown / horns or scout cap
    if (cfg.isBoss) {
      drawIsoPyramid(
        ctx,
        pt.x,
        pt.y - hop - bodyHeight,
        rx * 0.9,
        ry * 0.9,
        12,
        '#d4743b',
        '#913f22',
        1.5,
      );
    } else if (enemy.configId === 'aether_wisp') {
      drawIsoPyramid(
        ctx,
        pt.x,
        pt.y - hop - bodyHeight - 2,
        rx * 0.85,
        ry * 0.85,
        8,
        '#c3e7ed',
        '#4f9fb2',
        1.3,
      );
    }

    // HP Bar above enemy when damaged or boss
    if (enemy.hp < enemy.maxHp || cfg.isBoss) {
      this.drawHealthPill(
        ctx,
        pt.x,
        pt.y - hop - bodyHeight - (cfg.isBoss ? 18 : 8),
        cfg.isBoss ? 44 : 24,
        enemy.hp / enemy.maxHp,
        cfg.isBoss ? '#d4743b' : '#c86446',
      );
    }
  }

  private drawHealthPill(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    ratio: number,
    fillColor: string,
    textLabel?: string,
  ): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const h = textLabel ? 11 : 5;

    ctx.save();
    ctx.fillStyle = '#2b2623';
    ctx.beginPath();
    ctx.roundRect(cx - width * 0.5 - 1, cy - 1, width + 2, h + 2, 3);
    ctx.fill();

    ctx.fillStyle = '#e7dcc8';
    ctx.beginPath();
    ctx.roundRect(cx - width * 0.5, cy, width, h, 2);
    ctx.fill();

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(cx - width * 0.5, cy, width * clamped, h, 2);
    ctx.fill();

    if (textLabel) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textLabel, cx, cy + h * 0.5 + 0.5);
    }
    ctx.restore();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, proj: ProjectileInstance): void {
    const t = Math.min(1, Math.max(0, proj.progress));
    const curCol = proj.startCol + (proj.targetCol - proj.startCol) * t;
    const curRow = proj.startRow + (proj.targetRow - proj.startRow) * t;
    const z = 0.8 * (1 - t) + Math.sin(t * Math.PI) * proj.arcHeight;

    const groundPt = gridToScreen(curCol, curRow, 0, this.originX, this.originY);
    const airPt = gridToScreen(curCol, curRow, z, this.originX, this.originY);

    // Ground shadow beneath arcing projectile
    ctx.save();
    ctx.fillStyle = 'rgba(43, 38, 35, 0.22)';
    ctx.beginPath();
    ctx.ellipse(
      groundPt.x,
      groundPt.y,
      proj.type === 'cannonball' ? 6 : 3.5,
      proj.type === 'cannonball' ? 3 : 1.8,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    if (proj.type === 'cannonball') {
      ctx.save();
      ctx.fillStyle = '#3d4349';
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(airPt.x, airPt.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Warm specular glint
      ctx.fillStyle = '#9aa3ac';
      ctx.beginPath();
      ctx.arc(airPt.x - 1.8, airPt.y - 1.8, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Parabolic arrow aligned to tangent
      const dt = 0.04;
      const t2 = Math.min(1, t + dt);
      const col2 = proj.startCol + (proj.targetCol - proj.startCol) * t2;
      const row2 = proj.startRow + (proj.targetRow - proj.startRow) * t2;
      const z2 = 0.8 * (1 - t2) + Math.sin(t2 * Math.PI) * proj.arcHeight;
      const nextPt = gridToScreen(col2, row2, z2, this.originX, this.originY);
      const angle = Math.atan2(nextPt.y - airPt.y, nextPt.x - airPt.x);

      ctx.save();
      ctx.translate(airPt.x, airPt.y);
      ctx.rotate(angle);
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#f4e4c1';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(3, -3);
      ctx.lineTo(3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    for (const p of engine.getParticles()) {
      const lifeRatio = 1 - p.ageSec / p.lifetimeSec;
      const pt = gridToScreen(p.col, p.row, p.z, this.originX, this.originY);

      if (p.kind === 'frost_ring') {
        ctx.save();
        ctx.globalAlpha = lifeRatio * 0.75;
        drawIsoEllipse(ctx, pt.x, pt.y, p.radius, '#7ed3e6', 'rgba(126, 211, 230, 0.14)', 2.5);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = lifeRatio;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = INK_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.2, p.radius * lifeRatio), 0, Math.PI * 2);
        ctx.fill();
        if (p.kind === 'upgrade_burst') {
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
    for (const ft of engine.getFloatingTexts()) {
      const lifeRatio = 1 - ft.ageSec / ft.lifetimeSec;
      const pt = gridToScreen(ft.col, ft.row, ft.z, this.originX, this.originY);

      ctx.save();
      ctx.globalAlpha = Math.min(1, lifeRatio * 1.4);
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 3.2;
      ctx.strokeText(ft.text, pt.x, pt.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, pt.x, pt.y);
      ctx.restore();
    }
  }

  public static formatEntityHint(id: BuildableId): string {
    return getBuildableConfig(id).name;
  }

  public static getZScale(): number {
    return Z_SCALE;
  }
}
