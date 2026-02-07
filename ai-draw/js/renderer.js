/**
 * AI Draw Renderer
 * Renders drawing command JSON onto a canvas.
 */

export function render(canvas, data) {
    if (!data || !data.canvas) {
        throw new Error('Missing "canvas" property');
    }

    const w = data.canvas.width;
    const h = data.canvas.height;
    if (!w || !h || w < 1 || h < 1 || w > 8192 || h > 8192) {
        throw new Error(`Invalid canvas size: ${w}x${h} (must be 1-8192)`);
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Background
    if (data.canvas.background) {
        ctx.fillStyle = data.canvas.background;
        ctx.fillRect(0, 0, w, h);
    }

    // Render layers bottom to top
    const layers = data.layers || [{ commands: data.commands || [] }];
    let commandCount = 0;

    for (const layer of layers) {
        if (layer.visible === false) continue;

        const alpha = layer.opacity ?? 1.0;
        if (alpha <= 0) continue;

        if (alpha < 1.0) {
            // Render layer to offscreen canvas, then composite with opacity
            const offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            const offCtx = offscreen.getContext('2d');
            commandCount += renderCommands(offCtx, layer.commands || []);
            ctx.globalAlpha = alpha;
            ctx.drawImage(offscreen, 0, 0);
            ctx.globalAlpha = 1.0;
        } else {
            commandCount += renderCommands(ctx, layer.commands || []);
        }
    }

    return { width: w, height: h, layers: layers.length, commands: commandCount };
}

function renderCommands(ctx, commands) {
    let count = 0;
    for (const cmd of commands) {
        try {
            drawCommand(ctx, cmd);
            count++;
        } catch (e) {
            console.warn(`Command failed:`, cmd, e);
        }
    }
    return count;
}

function drawCommand(ctx, cmd) {
    ctx.save();

    // Apply transform if present
    if (cmd.translate) ctx.translate(cmd.translate[0], cmd.translate[1]);
    if (cmd.rotate) ctx.rotate(cmd.rotate * Math.PI / 180);
    if (cmd.scale) {
        const s = Array.isArray(cmd.scale) ? cmd.scale : [cmd.scale, cmd.scale];
        ctx.scale(s[0], s[1]);
    }
    if (cmd.opacity != null) ctx.globalAlpha = cmd.opacity;
    if (cmd.blend) ctx.globalCompositeOperation = cmd.blend;

    switch (cmd.type) {
        case 'rect': drawRect(ctx, cmd); break;
        case 'circle': drawCircle(ctx, cmd); break;
        case 'ellipse': drawEllipse(ctx, cmd); break;
        case 'line': drawLine(ctx, cmd); break;
        case 'polyline': drawPolyline(ctx, cmd); break;
        case 'polygon': drawPolygon(ctx, cmd); break;
        case 'path': drawPath(ctx, cmd); break;
        case 'arc': drawArc(ctx, cmd); break;
        case 'text': drawText(ctx, cmd); break;
        case 'image': drawImage(ctx, cmd); break;
        case 'group': drawGroup(ctx, cmd); break;
        default:
            console.warn(`Unknown command type: ${cmd.type}`);
    }

    ctx.restore();
}

// --- Shape drawing functions ---

function applyFillAndStroke(ctx, cmd, pathFn) {
    if (pathFn) {
        ctx.beginPath();
        pathFn();
    }
    if (cmd.fill) {
        ctx.fillStyle = cmd.fill;
        ctx.fill(cmd.fillRule || 'nonzero');
    }
    if (cmd.stroke) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 2;
        ctx.lineCap = cmd.lineCap || 'round';
        ctx.lineJoin = cmd.lineJoin || 'round';
        if (cmd.lineDash) ctx.setLineDash(cmd.lineDash);
        ctx.stroke();
    }
}

function drawRect(ctx, cmd) {
    const { x, y, width: w, height: h } = cmd;
    if (cmd.radius) {
        // Rounded rect
        const r = Math.min(cmd.radius, w / 2, h / 2);
        applyFillAndStroke(ctx, cmd, () => {
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + r, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
        });
    } else {
        if (cmd.fill) {
            ctx.fillStyle = cmd.fill;
            ctx.fillRect(x, y, w, h);
        }
        if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.strokeWidth ?? 2;
            ctx.strokeRect(x, y, w, h);
        }
    }
}

function drawCircle(ctx, cmd) {
    applyFillAndStroke(ctx, cmd, () => {
        ctx.arc(cmd.cx, cmd.cy, cmd.r, 0, Math.PI * 2);
    });
}

function drawEllipse(ctx, cmd) {
    applyFillAndStroke(ctx, cmd, () => {
        ctx.ellipse(cmd.cx, cmd.cy, cmd.rx, cmd.ry, (cmd.rotation || 0) * Math.PI / 180, 0, Math.PI * 2);
    });
}

function drawLine(ctx, cmd) {
    ctx.beginPath();
    ctx.moveTo(cmd.x1, cmd.y1);
    ctx.lineTo(cmd.x2, cmd.y2);
    ctx.strokeStyle = cmd.stroke || '#000000';
    ctx.lineWidth = cmd.strokeWidth ?? 2;
    ctx.lineCap = cmd.lineCap || 'round';
    if (cmd.lineDash) ctx.setLineDash(cmd.lineDash);
    ctx.stroke();
}

function drawPolyline(ctx, cmd) {
    if (!cmd.points || cmd.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(cmd.points[0][0], cmd.points[0][1]);
    for (let i = 1; i < cmd.points.length; i++) {
        ctx.lineTo(cmd.points[i][0], cmd.points[i][1]);
    }
    if (cmd.fill) {
        ctx.fillStyle = cmd.fill;
        ctx.fill();
    }
    if (cmd.stroke !== undefined || !cmd.fill) {
        ctx.strokeStyle = cmd.stroke || '#000000';
        ctx.lineWidth = cmd.strokeWidth ?? 2;
        ctx.lineCap = cmd.lineCap || 'round';
        ctx.lineJoin = cmd.lineJoin || 'round';
        if (cmd.lineDash) ctx.setLineDash(cmd.lineDash);
        ctx.stroke();
    }
}

function drawPolygon(ctx, cmd) {
    if (!cmd.points || cmd.points.length < 3) return;
    applyFillAndStroke(ctx, cmd, () => {
        ctx.moveTo(cmd.points[0][0], cmd.points[0][1]);
        for (let i = 1; i < cmd.points.length; i++) {
            ctx.lineTo(cmd.points[i][0], cmd.points[i][1]);
        }
        ctx.closePath();
    });
}

function drawPath(ctx, cmd) {
    if (!cmd.d) return;
    const path = new Path2D(cmd.d);
    if (cmd.fill) {
        ctx.fillStyle = cmd.fill;
        ctx.fill(path, cmd.fillRule || 'nonzero');
    }
    if (cmd.stroke) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 2;
        ctx.lineCap = cmd.lineCap || 'round';
        ctx.lineJoin = cmd.lineJoin || 'round';
        if (cmd.lineDash) ctx.setLineDash(cmd.lineDash);
        ctx.stroke(path);
    }
}

function drawArc(ctx, cmd) {
    const start = (cmd.startAngle ?? 0) * Math.PI / 180;
    const end = (cmd.endAngle ?? 360) * Math.PI / 180;
    const ccw = cmd.counterclockwise || false;

    applyFillAndStroke(ctx, cmd, () => {
        if (cmd.fill) {
            ctx.moveTo(cmd.cx, cmd.cy);
        }
        ctx.arc(cmd.cx, cmd.cy, cmd.r, start, end, ccw);
        if (cmd.fill) {
            ctx.closePath();
        }
    });
}

function drawText(ctx, cmd) {
    const size = cmd.size || 16;
    const family = cmd.font || 'sans-serif';
    const weight = cmd.weight || 'normal';
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = cmd.align || 'left';
    ctx.textBaseline = cmd.baseline || 'top';

    if (cmd.fill) {
        ctx.fillStyle = cmd.fill;
        ctx.fillText(cmd.text, cmd.x, cmd.y);
    }
    if (cmd.stroke) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 1;
        ctx.strokeText(cmd.text, cmd.x, cmd.y);
    }
    if (!cmd.fill && !cmd.stroke) {
        ctx.fillStyle = '#000000';
        ctx.fillText(cmd.text, cmd.x, cmd.y);
    }
}

function drawImage(ctx, cmd) {
    // Placeholder - images need async loading, skip for now
    console.warn('image command not yet supported');
}

function drawGroup(ctx, cmd) {
    if (!cmd.commands) return;
    for (const child of cmd.commands) {
        drawCommand(ctx, child);
    }
}
