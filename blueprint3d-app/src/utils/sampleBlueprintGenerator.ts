// Generates a crisp architectural blueprint PNG file for a realistic College Building Floorplan
export function generateSampleBlueprintFile(): Promise<File> {
  return new Promise((resolve) => {
    const width = 1920;
    const height = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      resolve(new File([], 'college_campus_floorplan.png', { type: 'image/png' }));
      return;
    }

    // 1. Classic architectural blueprint background (Deep Navy Blueprint)
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, width, height);

    // 2. Blueprint precision grid
    ctx.strokeStyle = '#142c4c';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Architectural sheet border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.lineWidth = 1;
    ctx.strokeRect(48, 48, width - 96, height - 96);

    // Title Block (bottom right)
    const tbX = width - 540;
    const tbY = height - 170;
    ctx.fillStyle = '#071324';
    ctx.fillRect(tbX, tbY, 470, 110);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(tbX, tbY, 470, 110);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('COLLEGE OF ENGINEERING & TECHNOLOGY', tbX + 16, tbY + 30);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('BUILDING C — ACADEMIC LEVEL 2 FLOORPLAN', tbX + 16, tbY + 54);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SCALE: 1:100 (1m = 40px) | GROSS FLOOR AREA: 576 m²', tbX + 16, tbY + 76);
    ctx.fillText('SHEET: A-201 | STRUCTURAL WALLS: 30cm / 20cm', tbX + 16, tbY + 95);

    // 4. College Floor Plan Geometry
    // World coordinates in meters:
    // Total footprint: 32m wide x 17m deep
    // ox, oy is top-left origin
    const ox = 300;
    const oy = 180;
    const s = 40; // 40 pixels per meter (1m = 40px)

    // Layout specifications:
    // North Wing (y=0 to y=7, depth=7m):
    // - North Stairwell & Exit: x=0 to x=4 (4m x 7m)
    // - Lecture Hall 201: x=4 to x=18 (14m x 7m)
    // - AI & Robotics Lab 202: x=18 to x=32 (14m x 7m)
    //
    // Central Corridor (y=7 to y=10, depth=3m):
    // - Main Arterial Hallway: x=0 to x=32 (32m x 3m)
    //
    // South Wing (y=10 to y=17, depth=7m):
    // - South Stairwell & Core: x=0 to x=4 (4m x 7m)
    // - Electronics & Physics Lab 203: x=4 to x=16 (12m x 7m)
    // - Faculty Research Office 204: x=16 to x=22 (6m x 7m)
    // - Department Seminar Room 205: x=22 to x=28 (6m x 7m)
    // - Restrooms & Utilities 206: x=28 to x=32 (4m x 7m)

    interface CollegeRoom {
      name: string;
      code: string;
      area: string;
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }

    const rooms: CollegeRoom[] = [
      { name: 'LECTURE HALL 201', code: 'CAPACITY: 120 SEATS', area: '98.0 m²', x: 4, y: 0, w: 14, h: 7, color: 'rgba(56, 189, 248, 0.06)' },
      { name: 'AI & ROBOTICS LAB 202', code: 'COMPUTER SYSTEMS LAB', area: '98.0 m²', x: 18, y: 0, w: 14, h: 7, color: 'rgba(99, 102, 241, 0.06)' },
      { name: 'NORTH STAIRWELL', code: 'EXIT / EGRESS', area: '28.0 m²', x: 0, y: 0, w: 4, h: 7, color: 'rgba(245, 158, 11, 0.05)' },
      { name: 'MAIN ARTERIAL CORRIDOR', code: 'CONCOURSE', area: '96.0 m²', x: 0, y: 7, w: 32, h: 3, color: 'rgba(148, 163, 184, 0.06)' },
      { name: 'ELECTRONICS LAB 203', code: 'HARDWARE & CIRCUITS', area: '84.0 m²', x: 4, y: 10, w: 12, h: 7, color: 'rgba(16, 185, 129, 0.06)' },
      { name: 'FACULTY OFFICE 204', code: 'PROFESSORS SUITE', area: '42.0 m²', x: 16, y: 10, w: 6, h: 7, color: 'rgba(236, 72, 153, 0.05)' },
      { name: 'SEMINAR ROOM 205', code: 'CONFERENCE & COLLAB', area: '42.0 m²', x: 22, y: 10, w: 6, h: 7, color: 'rgba(139, 92, 246, 0.05)' },
      { name: 'RESTROOMS & UTILITY', code: 'M/W RESTROOMS', area: '28.0 m²', x: 28, y: 10, w: 4, h: 7, color: 'rgba(20, 184, 166, 0.05)' },
      { name: 'SOUTH STAIRWELL', code: 'EXIT / EGRESS', area: '28.0 m²', x: 0, y: 10, w: 4, h: 7, color: 'rgba(245, 158, 11, 0.05)' },
    ];

    // Draw Room Backgrounds & Labels
    rooms.forEach((r) => {
      const rx = ox + r.x * s;
      const ry = oy + r.y * s;
      const rw = r.w * s;
      const rh = r.h * s;

      ctx.fillStyle = r.color;
      ctx.fillRect(rx, ry, rw, rh);

      // Room name & code
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, rx + rw / 2, ry + rh / 2 - 10);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(r.code, rx + rw / 2, ry + rh / 2 + 6);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(r.area, rx + rw / 2, ry + rh / 2 + 22);
    });

    // Draw Staircase Treads
    const drawStaircase = (x: number, y: number, w: number, h: number) => {
      const sx = ox + x * s;
      const sy = oy + y * s;
      const sw = w * s;
      const sh = h * s;
      const steps = 12;
      const stepH = sh / steps;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < steps; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + 10, sy + i * stepH);
        ctx.lineTo(sx + sw - 10, sy + i * stepH);
        ctx.stroke();
      }
      // Arrow showing UP direction
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, sy + sh - 20);
      ctx.lineTo(sx + sw / 2, sy + 25);
      ctx.lineTo(sx + sw / 2 - 8, sy + 38);
      ctx.moveTo(sx + sw / 2, sy + 25);
      ctx.lineTo(sx + sw / 2 + 8, sy + 38);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UP', sx + sw / 2, sy + 20);
    };

    drawStaircase(0, 0, 4, 7);
    drawStaircase(0, 10, 4, 7);

    // 5. Thick Architectural Walls
    // SOLID WALL REGIONS:
    // Exterior perimeter: 14px thick (0.35m structural concrete)
    // Interior partitions: 9px thick (0.22m masonry block)
    ctx.textAlign = 'left';

    // Outer boundary (Exterior building envelope: 32m x 17m)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeRect(ox, oy, 32 * s, 17 * s);

    // Interior structural walls (9px thick)
    ctx.lineWidth = 9;
    ctx.beginPath();

    // Corridor top wall (y=7, x=0 to 32)
    ctx.moveTo(ox, oy + 7 * s);
    ctx.lineTo(ox + 32 * s, oy + 7 * s);

    // Corridor bottom wall (y=10, x=0 to 32)
    ctx.moveTo(ox, oy + 10 * s);
    ctx.lineTo(ox + 32 * s, oy + 10 * s);

    // North wing vertical partitions:
    // x=4 (between stairwell and Lecture Hall)
    ctx.moveTo(ox + 4 * s, oy);
    ctx.lineTo(ox + 4 * s, oy + 7 * s);

    // x=18 (between Lecture Hall and Robotics Lab)
    ctx.moveTo(ox + 18 * s, oy);
    ctx.lineTo(ox + 18 * s, oy + 7 * s);

    // South wing vertical partitions:
    // x=4 (between South stairwell and Electronics Lab)
    ctx.moveTo(ox + 4 * s, oy + 10 * s);
    ctx.lineTo(ox + 4 * s, oy + 17 * s);

    // x=16 (between Electronics Lab and Faculty Office)
    ctx.moveTo(ox + 16 * s, oy + 10 * s);
    ctx.lineTo(ox + 16 * s, oy + 17 * s);

    // x=22 (between Faculty Office and Seminar Room)
    ctx.moveTo(ox + 22 * s, oy + 10 * s);
    ctx.lineTo(ox + 22 * s, oy + 17 * s);

    // x=28 (between Seminar Room and Restrooms)
    ctx.moveTo(ox + 28 * s, oy + 10 * s);
    ctx.lineTo(ox + 28 * s, oy + 17 * s);

    ctx.stroke();

    // 6. Architectural Doors & Openings
    // In college buildings:
    // - Lecture Hall & Robotics Lab have double doors (1.8m wide)
    // - Labs have 1.0m doors
    // - Offices & Restrooms have 0.9m single doors
    // - Main entrance at corridor east end has 2.4m double doors
    const drawDoorOpening = (
      x: number,
      y: number,
      widthMeters: number,
      orientation: 'horizontal' | 'vertical',
      isDouble: boolean = false
    ) => {
      ctx.save();
      const dx = ox + x * s;
      const dy = oy + y * s;
      const len = widthMeters * s;

      // Cut clear gap into the wall
      ctx.fillStyle = '#0a192f';
      if (orientation === 'horizontal') {
        ctx.fillRect(dx - len / 2, dy - 10, len, 20);

        // Door leaf & swing
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        if (!isDouble) {
          // Single swing
          ctx.beginPath();
          ctx.moveTo(dx - len / 2, dy);
          ctx.lineTo(dx - len / 2, dy - len);
          ctx.stroke();

          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(dx - len / 2, dy, len, -Math.PI / 2, 0, false);
          ctx.stroke();
        } else {
          // Double leaf swing
          const half = len / 2;
          ctx.beginPath();
          ctx.moveTo(dx - half, dy);
          ctx.lineTo(dx - half, dy - half);
          ctx.moveTo(dx + half, dy);
          ctx.lineTo(dx + half, dy - half);
          ctx.stroke();

          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(dx - half, dy, half, -Math.PI / 2, 0, false);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(dx + half, dy, half, -Math.PI, -Math.PI / 2, false);
          ctx.stroke();
        }
      } else {
        ctx.fillRect(dx - 10, dy - len / 2, 20, len);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(dx, dy - len / 2);
        ctx.lineTo(dx + len, dy - len / 2);
        ctx.stroke();

        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(dx, dy - len / 2, len, 0, Math.PI / 2, false);
        ctx.stroke();
      }
      ctx.restore();
    };

    // North wing doors (along corridor y=7):
    // Lecture Hall 201: Double door at x=11, y=7
    drawDoorOpening(11, 7, 1.8, 'horizontal', true);
    // Robotics Lab 202: Double door at x=25, y=7
    drawDoorOpening(25, 7, 1.8, 'horizontal', true);
    // North Stairwell: Door at x=2, y=7
    drawDoorOpening(2, 7, 1.0, 'horizontal', false);

    // South wing doors (along corridor y=10):
    // South Stairwell: Door at x=2, y=10
    drawDoorOpening(2, 10, 1.0, 'horizontal', false);
    // Electronics Lab 203: Door at x=10, y=10
    drawDoorOpening(10, 10, 1.0, 'horizontal', false);
    // Faculty Office 204: Door at x=19, y=10
    drawDoorOpening(19, 10, 0.9, 'horizontal', false);
    // Seminar Room 205: Door at x=25, y=10
    drawDoorOpening(25, 10, 0.9, 'horizontal', false);
    // Restrooms 206: Door at x=30, y=10
    drawDoorOpening(30, 10, 0.9, 'horizontal', false);

    // Main Campus Concourse Entrance (East end of corridor at x=32, y=8.5)
    drawDoorOpening(32, 8.5, 2.2, 'vertical', true);

    // 7. Exterior Windows (Continuous architectural ribbon windows for daylighting)
    const drawWindow = (x: number, y: number, widthMeters: number, orientation: 'horizontal' | 'vertical') => {
      ctx.save();
      const wx = ox + x * s;
      const wy = oy + y * s;
      const len = widthMeters * s;

      ctx.fillStyle = '#0a192f';
      if (orientation === 'horizontal') {
        ctx.fillRect(wx - 2, wy - 9, len + 4, 18);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        // Window outer and inner glass panes
        ctx.beginPath();
        ctx.moveTo(wx, wy - 5);
        ctx.lineTo(wx + len, wy - 5);
        ctx.moveTo(wx, wy + 5);
        ctx.lineTo(wx + len, wy + 5);
        ctx.stroke();

        // Mullions
        const mullions = Math.max(1, Math.floor(widthMeters / 1.5));
        for (let i = 1; i <= mullions; i++) {
          const mx = wx + (i / (mullions + 1)) * len;
          ctx.beginPath();
          ctx.moveTo(mx, wy - 7);
          ctx.lineTo(mx, wy + 7);
          ctx.stroke();
        }
      } else {
        ctx.fillRect(wx - 9, wy - 2, 18, len + 4);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(wx - 5, wy);
        ctx.lineTo(wx - 5, wy + len);
        ctx.moveTo(wx + 5, wy);
        ctx.lineTo(wx + 5, wy + len);
        ctx.stroke();
      }
      ctx.restore();
    };

    // North facade windows (y=0):
    drawWindow(6, 0, 4.0, 'horizontal');  // Lecture hall window 1
    drawWindow(12, 0, 4.0, 'horizontal'); // Lecture hall window 2
    drawWindow(20, 0, 4.0, 'horizontal'); // Robotics lab window 1
    drawWindow(26, 0, 4.0, 'horizontal'); // Robotics lab window 2

    // South facade windows (y=17):
    drawWindow(6, 17, 3.5, 'horizontal');  // Electronics lab window 1
    drawWindow(11, 17, 3.5, 'horizontal'); // Electronics lab window 2
    drawWindow(17.5, 17, 3.0, 'horizontal'); // Faculty office window
    drawWindow(23.5, 17, 3.0, 'horizontal'); // Seminar room window

    // West facade windows (x=0):
    drawWindow(0, 2.5, 2.0, 'vertical');  // North stairwell window
    drawWindow(0, 12.5, 2.0, 'vertical'); // South stairwell window

    // 8. Metric Dimension Annotations
    ctx.setLineDash([]);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 12px monospace';

    // Top horizontal dimension (32.00 m)
    const dimY = oy - 40;
    ctx.beginPath();
    ctx.moveTo(ox, dimY);
    ctx.lineTo(ox + 32 * s, dimY);
    ctx.moveTo(ox, dimY - 7);
    ctx.lineTo(ox, dimY + 7);
    ctx.moveTo(ox + 32 * s, dimY - 7);
    ctx.lineTo(ox + 32 * s, dimY + 7);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText('32.00 m (TOTAL BUILDING WIDTH)', ox + 16 * s, dimY - 8);

    // Left vertical dimension (17.00 m)
    const dimX = ox - 40;
    ctx.beginPath();
    ctx.moveTo(dimX, oy);
    ctx.lineTo(dimX, oy + 17 * s);
    ctx.moveTo(dimX - 7, oy);
    ctx.lineTo(dimX + 7, oy);
    ctx.moveTo(dimX - 7, oy + 17 * s);
    ctx.lineTo(dimX + 7, oy + 17 * s);
    ctx.stroke();
    ctx.save();
    ctx.translate(dimX - 10, oy + 8.5 * s);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('17.00 m (TOTAL DEPTH)', 0, 0);
    ctx.restore();

    // Corridor dimension: 3.00m
    const corDimX = ox + 32 * s + 35;
    ctx.beginPath();
    ctx.moveTo(corDimX, oy + 7 * s);
    ctx.lineTo(corDimX, oy + 10 * s);
    ctx.moveTo(corDimX - 5, oy + 7 * s);
    ctx.lineTo(corDimX + 5, oy + 7 * s);
    ctx.moveTo(corDimX - 5, oy + 10 * s);
    ctx.lineTo(corDimX + 5, oy + 10 * s);
    ctx.stroke();
    ctx.save();
    ctx.translate(corDimX + 15, oy + 8.5 * s);
    ctx.rotate(Math.PI / 2);
    ctx.font = '11px monospace';
    ctx.fillText('3.00 m CORRIDOR', 0, 0);
    ctx.restore();

    // North Arrow & Compass
    const naX = 140;
    const naY = 160;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(naX, naY, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(naX, naY - 22);
    ctx.lineTo(naX - 7, naY + 10);
    ctx.lineTo(naX, naY + 3);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'center';
    ctx.fillText('N', naX, naY - 30);

    // Convert canvas to File blob
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'college_engineering_level2_blueprint.png', {
          type: 'image/png',
          lastModified: Date.now(),
        });
        resolve(file);
      } else {
        resolve(new File([], 'college_engineering_level2_blueprint.png', { type: 'image/png' }));
      }
    }, 'image/png');
  });
}
