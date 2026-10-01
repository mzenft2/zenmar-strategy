# Transcribes a city planner screenshot into building rectangles on the 40x32 grid.
# Geometry only: colours give the building class, the footprint gives the size.
# Workshops and 4x4 special buildings need a label read from the contact sheet.
# Usage: python scripts/transcribe-map.py <screenshot.png> <output-stem> [--labels labels.json]
import sys, json, os
import numpy as np, cv2
from PIL import Image, ImageDraw

W, H = 40, 32
IMG = None

def classify(rgb):
    hsv = cv2.cvtColor(rgb.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV).reshape(rgb.shape)
    h = hsv[..., 0].astype(np.int32) * 2; s = hsv[..., 1] / 255.0; v = hsv[..., 2] / 255.0
    cls = np.zeros(h.shape, dtype=np.uint8)  # 0 = other (border, text, background)
    cls[(h >= 190) & (h <= 232) & (s > 0.2) & (v > 0.7)] = 1   # home
    cls[(h >= 235) & (h <= 280) & (s > 0.25) & (v > 0.78)] = 2  # culture
    cls[(h >= 225) & (h <= 295) & (s > 0.05) & (s < 0.24) & (v > 0.55) & (v < 0.82)] = 3  # special
    cls[(h >= 58) & (h <= 105) & (s > 0.2) & (v > 0.7)] = 4    # farm
    cls[(h >= 40) & (h <= 57) & (s > 0.2) & (v > 0.7)] = 5     # workshop
    cls[(h >= 12) & (h <= 39) & (s > 0.2) & (v > 0.7)] = 6     # barracks
    cls[(s < 0.08) & (v > 0.78)] = 7                            # empty / locked / free
    return cls

NAMES = {1: 'home', 2: 'culture', 3: 'special', 4: 'farm', 5: 'workshop', 6: 'barracks'}
COLORS = {1: (60, 110, 200), 2: (120, 60, 200), 3: (90, 80, 110), 4: (60, 140, 40), 5: (170, 140, 0), 6: (200, 90, 20)}

def board_bbox(cls):
    # Extent of the built city (building colours only): the locked grey blocks and the
    # background carry no grid information the origin search could use.
    mask = (cls >= 1) & (cls <= 6)
    rows = np.where(mask.mean(axis=1) > 0.05)[0]; cols = np.where(mask.mean(axis=0) > 0.05)[0]
    return cols.min(), rows.min(), cols.max() + 1, rows.max() + 1

LABELS = None

def components(cls, code, min_area, with_labels=False):
    global LABELS
    mask = (cls == code).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
    LABELS = labels
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < min_area: continue
        if area < 0.45 * w * h: continue  # thin stray strips
        out.append((int(x), int(y), int(w), int(h), int(area)) + ((i,) if with_labels else ()))
    return out

def split_by_borders(cls, code, box, pitch, ox, oy, label):
    # Neighbouring buildings of one colour touch along a thin border line that lies
    # exactly on a grid line. Only grid lines inside the component are candidates, so
    # label bands and icons, which never sit on a grid line, cannot split a building.
    # Bounding boxes of irregular neighbours overlap, so every step works on the pixels
    # of this one component (its label), never on every pixel of the colour.
    x, y, w, h, area = box[:5]
    sub = (LABELS[y:y + h, x:x + w] == label)
    if sub.sum() == 0: return [box]
    region = IMG[y:y + h, x:x + w].astype(np.int32)
    fill = np.median(region.reshape(-1, 3)[sub.reshape(-1)], axis=0)
    nonfill = np.abs(region - fill).sum(axis=2) > 25
    gx0 = round((x - 1 - ox) / pitch); gy0 = round((y - 1 - oy) / pitch)
    gw = max(1, round((w + 2) / pitch)); gh = max(1, round((h + 2) / pitch))
    def line_cuts(count, origin_px, start_px, length, along):
        # A border shows as pixels that differ from the tile fill on BOTH sides of the
        # line, or as a change of shade between the two sides; either must run along
        # at least 80% of the line. Labels and icons never reach that coverage.
        out = []
        for k in range(1, count):
            lp = origin_px + (start_px + k) * pitch - (x if along == 'x' else y)
            best = 0.0
            for d in range(-2, 3):
                c = int(round(lp + d))
                if c - 4 < 0 or c + 4 >= length: continue
                if along == 'x':
                    line, a, b = region[:, c], region[:, c - 4], region[:, c + 4]; present = sub[:, c - 4] | sub[:, c + 4]
                else:
                    line, a, b = region[c, :], region[c - 4, :], region[c + 4, :]; present = sub[c - 4, :] | sub[c + 4, :]
                if present.sum() < pitch * 0.5: continue
                da = np.abs(line - a).sum(axis=1); db = np.abs(line - b).sum(axis=1); dab = np.abs(a - b).sum(axis=1)
                signal = ((da > 20) & (db > 20)) | (dab > 20)
                # Coverage counts only where the component exists beside the line, so an
                # L-shaped merge of two buildings still shows its full border.
                best = max(best, float(signal[present].mean()))
            if best > 0.75: out.append((best, int(round(lp))))
        return out
    # Guillotine recursion: cut along the strongest full-length border, then look
    # again inside each part. A mosaic of same-coloured buildings rarely shares one
    # border across its whole width, but every part of it does.
    best = (0.0, None)
    for along, count in (('x', gw), ('y', gh)):
        for cut in line_cuts(count, ox if along == 'x' else oy, gx0 if along == 'x' else gy0, w if along == 'x' else h, along):
            best = max(best, (cut[0], (along, cut[1])), key=lambda t: t[0])
    if best[1] is None: return [box]
    along, c = best[1]
    parts = [(x, y, c, h), (x + c, y, w - c, h)] if along == 'x' else [(x, y, w, c), (x, y + c, w, h - c)]
    out = []
    for (px, py, pw, ph) in parts:
        if pw < pitch * 0.6 or ph < pitch * 0.6: continue
        mask = (LABELS[py:py + ph, px:px + pw] == label).astype(np.uint8)
        n, sublabels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
        for i in range(1, n):
            sx, sy, sw, sh, sarea = stats[i]
            if sarea < 400 or sw < pitch * 0.6 or sh < pitch * 0.6: continue
            out += split_by_borders(cls, code, (px + int(sx), py + int(sy), int(sw), int(sh), int(sarea)), pitch, ox, oy, label)
    return out if out else [box]

def estimate_grid(cls):
    x0, y0, x1, y1 = board_bbox(cls)
    homes = components(cls, 1, 400)
    squares = [c for c in homes if abs(c[2] - c[3]) <= 3]
    sizes = sorted(c[2] for c in squares)
    small = [s for s in sizes if s < np.median(sizes) * 1.3] if sizes else sizes
    pitch = (np.median(small) + 2) / 2  # component excludes its 1px border on each side
    allc = [c for k in NAMES for c in components(cls, k, 200)]
    def best_origin(edges, start, p):
        # Any origin shifted by whole cells fits the edges equally well: take the one
        # nearest the visible board edge among the near-best candidates.
        cands = np.arange(start - p * 0.5, start + p * 0.5, 0.5)
        res = np.array([np.mean([abs(((e - o) / p) - round((e - o) / p)) for e in edges]) for o in cands])
        good = np.where(res <= res.min() + 0.02)[0]
        return float(cands[good[int(np.argmin(np.abs(cands[good] - start)))]])
    def refine(edges, origin, p):
        # Least squares over every building edge: a pitch error of a few tenths of a
        # pixel shifts grid lines by half a cell at the far side of the board.
        for _ in range(3):
            k = np.array([round((e - origin) / p) for e in edges]); e = np.array(edges, dtype=float)
            keep = np.abs(e - (origin + k * p)) < p * 0.25
            if keep.sum() < 4: break
            A = np.vstack([np.ones(keep.sum()), k[keep]]).T
            origin, p = np.linalg.lstsq(A, e[keep], rcond=None)[0]
        return float(origin), float(p)
    xe = [c[0] - 1 for c in allc] + [c[0] + c[2] + 1 for c in allc]
    ye = [c[1] - 1 for c in allc] + [c[1] + c[3] + 1 for c in allc]
    ox, px = refine(xe, best_origin([c[0] - 1 for c in allc], x0 - 1, pitch), pitch)
    oy, py = refine(ye, best_origin([c[1] - 1 for c in allc], y0 - 1, pitch), pitch)
    pitch = (px + py) / 2
    def origin_only(edges, origin, p):
        k = np.array([round((e - origin) / p) for e in edges]); e = np.array(edges, dtype=float)
        keep = np.abs(e - (origin + k * p)) < p * 0.25
        return float(np.mean(e[keep] - k[keep] * p)) if keep.sum() else origin
    ox = origin_only(xe, ox, pitch); oy = origin_only(ye, oy, pitch)
    return pitch, ox, oy, (int(x0), int(y0), int(x1), int(y1))

def footprint_ids(code, w, h):
    key = (w, h)
    if code == 1:
        return {(2, 2): 'smallHome', (3, 3): 'averageHome', (3, 2): 'premiumHome', (2, 3): 'premiumHome'}.get(key)
    if code == 2:
        return {(2, 2): 'moderateCulture', (2, 1): 'compactCulture', (1, 2): 'compactCulture', (1, 1): 'littleCulture', (3, 2): 'premiumCulture', (2, 3): 'premiumCulture', (4, 3): 'largeCulture', (3, 4): 'largeCulture'}.get(key)
    if code == 4:
        return {(4, 3): 'ruralFarm', (3, 4): 'ruralFarm', (4, 4): 'domesticFarm', (3, 3): 'premiumFarm'}.get(key)
    if code == 5:
        return 'workshop?' if key in [(4, 3), (3, 4)] else None
    if code == 6:
        return {(6, 5): 'siegeBarracks', (5, 6): 'siegeBarracks', (4, 5): 'cavalryBarracks', (5, 4): 'cavalryBarracks', (3, 5): 'rangedBarracks', (5, 3): 'rangedBarracks', (4, 4): 'infantryBarracks', (5, 5): 'heavyInfantryBarracks'}.get(key)
    if code == 3:
        return {(5, 5): 'cityHall', (2, 2): 'collectableMinoanWatchtowerV2', (3, 3): 'collectableSchoolV2', (2, 3): 'collectableArchitectsStudioV2', (3, 2): 'collectableArchitectsStudioV2', (5, 4): 'collectableAmphitheatre', (4, 5): 'collectableAmphitheatre', (4, 4): 'special4x4?'}.get(key)
    return None

def split_units(code, x, y, w, h):
    # Merged neighbours without a visible border: tile with the natural unit of the class.
    if code == 4:
        for uw, uh in [(4, 3), (3, 4), (4, 4), (3, 3)]:
            if w % uw == 0 and h % uh == 0 and (w // uw) * (h // uh) > 1:
                return [(x + i * uw, y + j * uh, uw, uh) for j in range(h // uh) for i in range(w // uw)]
        return None
    unit = {1: (2, 2), 2: (2, 2), 5: (4, 3)}.get(code)
    if unit and w % unit[0] == 0 and h % unit[1] == 0:
        return [(x + i * unit[0], y + j * unit[1], unit[0], unit[1]) for j in range(h // unit[1]) for i in range(w // unit[0])]
    if code == 2 and (w == 1 or h == 1):
        return [(x + i, y + j, 1, 1) for j in range(h) for i in range(w)] if w * h > 2 else None
    return None

def main():
    global IMG
    path, stem = sys.argv[1], sys.argv[2]
    labels = {}
    if '--labels' in sys.argv:
        labels = json.load(open(sys.argv[sys.argv.index('--labels') + 1], encoding='utf-8'))
    img = np.array(Image.open(path).convert('RGB')); IMG = img
    cls = classify(img)
    pitch, ox, oy, bbox = estimate_grid(cls)
    buildings, issues, needs = [], [], []
    for code in NAMES:
        raw = components(cls, code, 900 if code == 2 else 400, with_labels=True)
        boxes = [p for box in raw for p in split_by_borders(cls, code, box, pitch, ox, oy, box[5])]
        boxes = [b for b in boxes if b[2] >= pitch * 0.6 and b[3] >= pitch * 0.6]
        for box in boxes:
            x, y, w, h, area = box[:5]
            gx = round((x - 1 - ox) / pitch); gy = round((y - 1 - oy) / pitch)
            gw = max(1, round((w + 2) / pitch)); gh = max(1, round((h + 2) / pitch))
            if gx >= W or gy >= H: continue  # interface elements beside the board
            pieces = [(gx, gy, gw, gh)]
            if footprint_ids(code, gw, gh) is None:
                split = split_units(code, gx, gy, gw, gh)
                if split: pieces = split
            for (px, py, pw, ph) in pieces:
                pid = footprint_ids(code, pw, ph)
                item = {'x': px, 'y': py, 'w': pw, 'h': ph, 'cls': NAMES[code], 'id': pid, 'px': [x, y, w, h]}
                if pid is None:
                    issues.append(f'{NAMES[code]} {pw}x{ph} at ({px},{py}) px={x},{y},{w},{h}')
                buildings.append(item)
    buildings.sort(key=lambda b: (b['y'], b['x']))
    for i, b in enumerate(buildings):
        b['n'] = i
        if b['id'] in ('workshop?', 'special4x4?'):
            key = f"{b['x']},{b['y']}"
            if key in labels: b['id'] = labels[key]
            else: needs.append(b)
    grid = np.zeros((H, W), dtype=np.int32)
    for b in buildings:
        if b['x'] < 0 or b['y'] < 0 or b['x'] + b['w'] > W or b['y'] + b['h'] > H:
            issues.append(f"out of board: {b['id']} at ({b['x']},{b['y']})"); continue
        region = grid[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']]
        if region.any(): issues.append(f"overlap: {b['id']} at ({b['x']},{b['y']}) with #{int(region.max()) - 1}")
        region[:] = b['n'] + 1
    tiles = [bool(grid[(i // 10) * 4:(i // 10) * 4 + 4, (i % 10) * 4:(i % 10) * 4 + 4].any()) for i in range(80)]
    ann = Image.fromarray(img.copy()); d = ImageDraw.Draw(ann)
    for b in buildings:
        X = ox + b['x'] * pitch; Y = oy + b['y'] * pitch
        code = [k for k, v in NAMES.items() if v == b['cls']][0]
        d.rectangle([X + 1, Y + 1, X + b['w'] * pitch - 2, Y + b['h'] * pitch - 2], outline=COLORS[code], width=3)
        d.text((X + 4, Y + b['h'] * pitch - 16), f"#{b['n']} {b['id'] or '?'}", fill=(0, 0, 0))
    ann.save(stem + '-annotated.png')
    if needs:
        crops = []
        for b in needs:
            X = int(ox + b['x'] * pitch); Y = int(oy + b['y'] * pitch)
            crop = Image.fromarray(img[max(0, Y):Y + int(b['h'] * pitch), max(0, X):X + int(b['w'] * pitch)])
            crop = crop.resize((max(1, int(crop.width * 1.5)), max(1, int(crop.height * 1.5))))
            cd = ImageDraw.Draw(crop); cd.rectangle([0, 0, 70, 18], fill=(255, 255, 255)); cd.text((2, 2), f"#{b['n']} {b['x']},{b['y']}", fill=(0, 0, 0))
            crops.append(crop)
        cols = 4; cw = max(c.width for c in crops); ch = max(c.height for c in crops)
        sheet = Image.new('RGB', (cols * (cw + 8), ((len(crops) + cols - 1) // cols) * (ch + 8)), (40, 40, 40))
        for i, c in enumerate(crops): sheet.paste(c, ((i % cols) * (cw + 8), (i // cols) * (ch + 8)))
        sheet.save(stem + '-labels.png')
    out = {'source': os.path.basename(path), 'pitch': pitch, 'origin': [ox, oy], 'board': list(bbox), 'tiles': tiles,
           'layout': [{'id': b['id'], 'x': b['x'], 'y': b['y'], 'w': b['w'], 'h': b['h']} for b in buildings if b['id'] and b['x'] >= 0 and b['y'] >= 0 and b['x'] + b['w'] <= W and b['y'] + b['h'] <= H], 'issues': issues,
           'needs': [{'n': b['n'], 'x': b['x'], 'y': b['y'], 'cls': b['cls']} for b in needs]}
    json.dump(out, open(stem + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    counts = {}
    for b in buildings: counts[b['id']] = counts.get(b['id'], 0) + 1
    print(f"{os.path.basename(path)}: pitch={pitch:.2f} origin=({ox:.1f},{oy:.1f}) board={bbox} buildings={len(buildings)} places={sum(tiles)}")
    print('  counts:', json.dumps(counts, ensure_ascii=False))
    print('  issues:', len(issues)); [print('   -', i) for i in issues[:40]]
    print('  needs labels:', len(needs))

if __name__ == '__main__':
    main()
