// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { Pool } from "pg";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import os from "os";
import { Readable } from "stream";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

let __dirname = "";
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) { __dirname = process.cwd(); }

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://localhost:8000";
const MEMORIES_FOLDER_NAME = process.env.MEMORIES_FOLDER_NAME || "anh cacke";
const MEMORIES_FOLDER_ID = process.env.MEMORIES_FOLDER_ID || "";

const DRIVE_ACCOUNTS = [
  { folderId: process.env.DRIVE_FOLDER_ID_1 || "", refreshToken: process.env.DRIVE_REFRESH_TOKEN_1 || "" },
  { folderId: process.env.DRIVE_FOLDER_ID_2 || "", refreshToken: process.env.DRIVE_REFRESH_TOKEN_2 || "" },
  { folderId: process.env.DRIVE_FOLDER_ID_3 || "", refreshToken: process.env.DRIVE_REFRESH_TOKEN_3 || "" },
  { folderId: process.env.DRIVE_FOLDER_ID_4 || "", refreshToken: process.env.DRIVE_REFRESH_TOKEN_4 || "" },
  { folderId: process.env.DRIVE_FOLDER_ID_5 || "", refreshToken: process.env.DRIVE_REFRESH_TOKEN_5 || "" },
].filter(account => account.folderId !== "" && account.refreshToken !== "");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function initDB(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS albums (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS media (id SERIAL PRIMARY KEY, drive_file_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, thumbnail_link TEXT, album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS tags (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS media_tags (media_id INTEGER REFERENCES media(id) ON DELETE CASCADE, tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (media_id, tag_id));
        CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT, color TEXT DEFAULT 'bg-white', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS schedule (id SERIAL PRIMARY KEY, subject TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, room TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        
        CREATE TABLE IF NOT EXISTS face_embeddings (
          id SERIAL PRIMARY KEY, media_id INTEGER REFERENCES media(id) ON DELETE CASCADE, face_index INTEGER NOT NULL, 
          embedding REAL[] NOT NULL, bbox JSONB, thumbnail_base64 TEXT, cluster_id INTEGER, quality FLOAT DEFAULT 0, 
          type VARCHAR(10) DEFAULT 'face',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS face_clusters (id SERIAL PRIMARY KEY, name TEXT, cover_face_id INTEGER, centroid REAL[], face_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS memories (id SERIAL PRIMARY KEY, title TEXT, type TEXT DEFAULT 'person', cluster_id INTEGER REFERENCES face_clusters(id) ON DELETE CASCADE, media_ids INTEGER[], cover_media_id INTEGER, video_base64 TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      `);
      await pool.query(`
        ALTER TABLE media ADD COLUMN IF NOT EXISTS face_processed BOOLEAN DEFAULT FALSE;
        ALTER TABLE media ADD COLUMN IF NOT EXISTS face_count INTEGER DEFAULT 0;
        ALTER TABLE media ADD COLUMN IF NOT EXISTS has_people BOOLEAN DEFAULT NULL;
      `);
      await pool.query(`
        ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS thumbnail_base64 TEXT;
        ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'face';
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS video_base64 TEXT;
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_face_embeddings_media ON face_embeddings(media_id);
        CREATE INDEX IF NOT EXISTS idx_face_embeddings_cluster ON face_embeddings(cluster_id);
        CREATE INDEX IF NOT EXISTS idx_media_face_processed ON media(face_processed);
      `);
      console.log("Database initialized successfully.");
      return;
    } catch (err) {
      console.error(`DB init failed (attempt ${i + 1}):`, err);
      if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
    }
  }
  process.exit(1);
}
initDB().catch(console.error);

async function dbQuery(q: string, _: string, p: any[] = []) { return (await pool.query(q, p)).rows; }
async function dbGet(q: string, _: string, p: any[] = []) { return (await pool.query(q, p)).rows[0]; }
async function dbRun(q: string, _: string, p: any[] = []) { return await pool.query(q, p); }
async function dbInsertReturningId(q: string, _: string, p: any[] = []) { return (await pool.query(q, p)).rows[0].id; }

function getDriveClient(refreshToken: string) {
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, "https://developers.google.com/oauthplayground");
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
}

async function getOrCreateMemoriesFolder(drive: any, parentFolderId: string): Promise<string> {
  if (MEMORIES_FOLDER_ID) return MEMORIES_FOLDER_ID;
  try {
    const res = await drive.files.list({
      q: `name='${MEMORIES_FOLDER_NAME}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)', spaces: 'drive',
    });
    if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

    const folder = await drive.files.create({
      requestBody: { name: MEMORIES_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [parentFolderId] },
      fields: 'id',
    });
    return folder.data.id;
  } catch (error) {
    console.error("Lỗi khi tạo thư mục Memories:", error);
    return parentFolderId;
  }
}

let currentAccountIndex = 0;
const app = express();
app.use(express.json({ limit: "200mb" }));
app.use((req, res, next) => { req.setTimeout(10 * 60 * 1000); res.setTimeout(10 * 60 * 1000); next(); });

// ============================================================
// CLOUDFLARE CACHE HELPERS
// ============================================================
type CachePolicy = "static-immutable" | "long" | "medium" | "short" | "realtime" | "mutation";

function setCache(res: express.Response, policy: CachePolicy) {
  switch (policy) {
    case "static-immutable":
      // Ảnh/video đã upload không bao giờ đổi → cache 1 năm ở Cloudflare + browser
      res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
      res.setHeader("Vary", "Accept-Encoding");
      break;
    case "long":
      // Dữ liệu ít đổi (notes, schedule) → 1 ngày
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
      break;
    case "medium":
      // Danh sách album, people, memories → 1 giờ ở edge, 5 phút ở browser
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
      break;
    case "short":
      // Danh sách media có search/album → 5 phút ở edge
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
      break;
    case "realtime":
      // Trạng thái scan, progress → không cache
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      break;
    case "mutation":
      // POST/PUT/DELETE → cấm cache tuyệt đối
      res.setHeader("Cache-Control", "no-store");
      break;
  }
}

// Cache-Tag để purge chọn lọc trên Cloudflare (tuỳ chọn nhưng rất hữu ích)
function setCacheTags(res: express.Response, ...tags: string[]) {
  if (tags.length > 0) res.setHeader("Cache-Tag", tags.join(","));
}

// ============================================================
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 * 1024 } });

async function downloadDriveFile(fileId: string): Promise<Buffer | null> {
  for (const account of DRIVE_ACCOUNTS) {
    try {
      const res = await getDriveClient(account.refreshToken).files.get({ fileId, alt: "media", acknowledgeAbuse: true }, { responseType: "arraybuffer" });
      return Buffer.from(res.data as ArrayBuffer);
    } catch (e: any) { if (e.code === 404) continue; }
  }
  return null;
}

async function extractVideoFrames(driveFileId: string, mediaId: number): Promise<Buffer[]> {
  const videoBuf = await downloadDriveFile(driveFileId);
  if (!videoBuf) return [];
  const tmpDir = path.join(os.tmpdir(), `vid_${mediaId}_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpVideo = path.join(tmpDir, `video.mp4`);
  fs.writeFileSync(tmpVideo, videoBuf);
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpVideo).screenshots({ count: 5, folder: tmpDir, filename: `frame-%i.jpg`, size: "1280x?" }).on("end", () => resolve()).on("error", (err) => reject(err));
    });
    const frames: Buffer[] = [];
    for (const file of fs.readdirSync(tmpDir).filter(f => f.startsWith("frame-"))) frames.push(fs.readFileSync(path.join(tmpDir, file)));
    return frames;
  } catch (err) { return []; } finally { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} }
}

async function processMediaFaces(mediaId: number): Promise<boolean> {
  const media = await dbGet("SELECT * FROM media WHERE id = $1", "", [mediaId]);
  if (!media || media.face_processed) return true;
  try {
    let imageBuffers: Buffer[] = [];
    if (media.mime_type.startsWith("video/")) imageBuffers = await extractVideoFrames(media.drive_file_id, media.id);
    else if (media.mime_type.startsWith("image/")) {
      const buf = await downloadDriveFile(media.drive_file_id);
      if (buf) imageBuffers = [buf];
    }
    if (imageBuffers.length === 0) {
      await dbRun("UPDATE media SET face_processed = TRUE, has_people = FALSE, face_count = 0 WHERE id = $1", "", [mediaId]);
      return true;
    }
    await dbRun("DELETE FROM face_embeddings WHERE media_id = $1", "", [mediaId]);
    let totalObjectsFound = 0, objIndex = 0;
    const seenEmbeddings: { vec: number[], type: string }[] = [];

    for (const imgBuffer of imageBuffers) {
      const formData = new FormData();
      formData.append("file", new Blob([imgBuffer], { type: "image/jpeg" }), "img.jpg");
      const detectRes = await fetch(`${FACE_SERVICE_URL}/detect`, { method: "POST", body: formData });
      if (!detectRes.ok) continue;

      const data = await detectRes.json();
      for (const obj of (data.objects || [])) {
        let isDuplicate = false;
        for (const seen of seenEmbeddings) {
          if (seen.type !== obj.type || seen.vec.length !== obj.embedding.length) continue;
          let dot = 0; for (let i = 0; i < obj.embedding.length; i++) dot += obj.embedding[i] * seen.vec[i];
          if (dot > 0.65) { isDuplicate = true; break; }
        }
        if (isDuplicate) continue;

        seenEmbeddings.push({ vec: obj.embedding, type: obj.type });
        totalObjectsFound++;
        await dbRun(
          `INSERT INTO face_embeddings (media_id, face_index, embedding, bbox, thumbnail_base64, quality, type) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          "", [media.id, objIndex, obj.embedding, JSON.stringify(obj.bbox), obj.thumbnail, obj.det_score, obj.type]
        );
        objIndex++;
      }
    }
    await dbRun("UPDATE media SET face_processed = TRUE, face_count = $1, has_people = $2 WHERE id = $3", "", [totalObjectsFound, totalObjectsFound > 0, mediaId]);
    return true;
  } catch (err) { return false; }
}

async function reclusterFaces() {
  const allEmbeddings = await dbQuery("SELECT id, embedding, type FROM face_embeddings WHERE quality > 0.4", "");
  if (allEmbeddings.length === 0) {
    await dbRun("UPDATE face_embeddings SET cluster_id = NULL", "");
    await dbRun("DELETE FROM face_clusters", "");
    return;
  }
  const vectors = allEmbeddings.map((e: any) => e.embedding);
  const types = allEmbeddings.map((e: any) => e.type);
  const ids = allEmbeddings.map((e: any) => e.id);

  const clusterRes = await fetch(`${FACE_SERVICE_URL}/cluster`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeddings: vectors, types: types }) });
  if (!clusterRes.ok) return;
  const { clusters } = await clusterRes.json();

  const existingClusters = await dbQuery("SELECT id, name, centroid, cover_face_id FROM face_clusters", "");
  await dbRun("UPDATE face_embeddings SET cluster_id = NULL", "");
  const newClusterIds: number[] = [];

  for (const clusterIndices of clusters) {
    if (clusterIndices.length < 2) continue;
    const clusterEmbeddings = clusterIndices.map((i: number) => vectors[i]);
    const vecLength = clusterEmbeddings[0].length;
    const centroid = new Array(vecLength).fill(0);
    for (const emb of clusterEmbeddings) for (let j = 0; j < vecLength; j++) centroid[j] += emb[j] / clusterEmbeddings.length;

    const cNorm = Math.sqrt(centroid.reduce((s, v) => s + v * v, 0)) || 1;
    for (let j = 0; j < vecLength; j++) centroid[j] /= cNorm;

    let matched = null, bestSim = 0.55;
    for (const old of existingClusters) {
      if (!old.centroid || !Array.isArray(old.centroid) || old.centroid.length !== vecLength) continue;
      let dot = 0; for (let j = 0; j < vecLength; j++) dot += centroid[j] * old.centroid[j];
      if (dot > bestSim) { bestSim = dot; matched = old; }
    }
    const faceIdsInCluster = clusterIndices.map((i: number) => ids[i]);
    const bestFaceRow = await dbGet(`SELECT id FROM face_embeddings WHERE id = ANY($1) ORDER BY quality DESC LIMIT 1`, "", [faceIdsInCluster]);
    const coverFaceId = bestFaceRow?.id || faceIdsInCluster[0];

    let clusterId: number;
    if (matched) {
      clusterId = matched.id;
      await dbRun("UPDATE face_clusters SET centroid = $1, face_count = $2, cover_face_id = $3, updated_at = NOW() WHERE id = $4", "", [centroid, clusterIndices.length, coverFaceId, clusterId]);
    } else {
      clusterId = await dbInsertReturningId(`INSERT INTO face_clusters (centroid, face_count, cover_face_id, name) VALUES ($1, $2, $3, $4) RETURNING id`, "", [centroid, clusterIndices.length, coverFaceId, null]);
    }
    newClusterIds.push(clusterId);
    for (const idx of clusterIndices) await dbRun("UPDATE face_embeddings SET cluster_id = $1 WHERE id = $2", "", [clusterId, ids[idx]]);
  }
  if (newClusterIds.length === 0) await dbRun("DELETE FROM face_clusters", "");
  else await dbRun(`DELETE FROM face_clusters WHERE id NOT IN (${newClusterIds.map((_, i) => `$${i + 1}`).join(",")})`, "", newClusterIds);
}

let scanState = { running: false, total: 0, done: 0, current: "" };
async function scanAllFaces() {
  if (scanState.running) return;
  scanState = { running: true, total: 0, done: 0, current: "" };
  try {
    const unprocessed = await dbQuery("SELECT id, name FROM media WHERE face_processed = FALSE OR face_processed IS NULL", "");
    scanState.total = unprocessed.length;
    for (const m of unprocessed) {
      scanState.current = m.name;
      await processMediaFaces(m.id);
      scanState.done++;
    }
    await reclusterFaces();
  } catch (err) {} finally { scanState.running = false; }
}

async function renderMemoryVideo(memoryId: number) {
  const memory = await dbGet("SELECT * FROM memories WHERE id = $1", "", [memoryId]);
  if (!memory) return;

  try {
    await dbRun("UPDATE memories SET status = 'rendering' WHERE id = $1", "", [memoryId]);

    const media = await dbQuery(
      `SELECT DISTINCT m.* FROM media m
       JOIN face_embeddings fe ON m.id = fe.media_id
       WHERE fe.cluster_id = $1 AND m.mime_type LIKE 'image/%'
       ORDER BY m.created_at DESC
       LIMIT 20`,
      "", [memory.cluster_id]
    );

    if (media.length < 2) {
      await dbRun("UPDATE memories SET status = 'failed' WHERE id = $1", "", [memoryId]);
      return;
    }

    const imagePaths: string[] = [];
    const tmpDir = path.join(os.tmpdir(), `mem_${memoryId}_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const m of media) {
      const buf = await downloadDriveFile(m.drive_file_id);
      if (buf) { const p = path.join(tmpDir, `img_${m.id}.jpg`); fs.writeFileSync(p, buf); imagePaths.push(p); }
    }

    if (imagePaths.length < 2) {
      await dbRun("UPDATE memories SET status = 'failed' WHERE id = $1", "", [memoryId]);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    const concatFile = path.join(tmpDir, `concat.txt`);
    fs.writeFileSync(concatFile, imagePaths.map(p => `file '${p.replace(/\\/g, "/")}'\nduration 3`).concat([`file '${imagePaths[imagePaths.length - 1].replace(/\\/g, "/")}'`]).join("\n"));

    const outputPath = path.join(tmpDir, `memory.mp4`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg().input(concatFile).inputOptions(["-f concat", "-safe 0"]).outputOptions(["-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-r", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]).output(outputPath).on("end", () => resolve()).on("error", (err) => reject(err)).run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    let driveFileId: string | null = null;
    for (const account of DRIVE_ACCOUNTS) {
      try {
        const drive = getDriveClient(account.refreshToken);
        const memoriesFolderId = await getOrCreateMemoriesFolder(drive, account.folderId);

        const driveRes = await drive.files.create({
          requestBody: { name: `Memory_${memoryId}.mp4`, parents: [memoriesFolderId] },
          media: { mimeType: "video/mp4", body: Readable.from(videoBuffer) },
          fields: "id",
        });
        driveFileId = driveRes.data.id || null;
        break;
      } catch (e) { continue; }
    }

    if (!driveFileId) throw new Error("Không thể upload video Memories lên Drive");

    const coverMediaId = media[0]?.id || null;
    await dbRun(
      `UPDATE memories SET status = 'ready', video_base64 = $1, media_ids = $2, cover_media_id = $3 WHERE id = $4`,
      "", [driveFileId, media.map((m: any) => m.id), coverMediaId, memoryId]
    );

    console.log(`Memory ${memoryId} rendered and saved.`);
  } catch (err) {
    console.error(`Render memory ${memoryId} error:`, err);
    await dbRun("UPDATE memories SET status = 'failed' WHERE id = $1", "", [memoryId]);
  }
}


// ==========================================
// ROUTES API
// ==========================================

// ---------- Albums ----------
app.get("/api/albums", async (req, res) => {
  setCache(res, "medium");
  setCacheTags(res, "albums");
  try { res.json(await dbQuery("SELECT * FROM albums ORDER BY name ASC", "")); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.post("/api/albums", async (req, res) => {
  setCache(res, "mutation");
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  try { const id = await dbInsertReturningId("INSERT INTO albums (name) VALUES ($1) RETURNING id", "", [name]); res.json({ id, name }); }
  catch { res.status(400).json({ error: "Exists" }); }
});

app.delete("/api/albums/:id", async (req, res) => {
  setCache(res, "mutation");
  try { await dbRun("DELETE FROM albums WHERE id = $1", "", [req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});

// ---------- Media upload ----------
app.post("/api/media", upload.single("file"), async (req, res) => {
  setCache(res, "mutation");
  const file = req.file; const { album_id } = req.body;
  if (!file) return res.status(400).json({ error: "No file" });
  try {
    const fileBuffer = file.buffer;
    let driveFileId: string | null = null, thumbnailLink: string | null = null, lastError: any = null;
    for (let attempt = 0; attempt < DRIVE_ACCOUNTS.length; attempt++) {
      const i = (currentAccountIndex + attempt) % DRIVE_ACCOUNTS.length; const account = DRIVE_ACCOUNTS[i];
      try {
        const driveRes = await getDriveClient(account.refreshToken).files.create({ requestBody: { name: file.originalname, parents: [account.folderId] }, media: { mimeType: file.mimetype, body: Readable.from(fileBuffer) }, fields: "id, thumbnailLink" });
        driveFileId = driveRes.data.id || null; thumbnailLink = driveRes.data.thumbnailLink || null; currentAccountIndex = i; break;
      } catch (error: any) { lastError = error; const isQuota = error.response?.data?.error?.errors?.some((e: any) => e.reason === "storageQuotaExceeded" || e.reason === "quotaExceeded"); if (!isQuota && !error.message?.includes("invalid_grant")) break; }
    }
    if (!driveFileId) throw lastError || new Error("Upload failed");
    const mediaId = await dbInsertReturningId("INSERT INTO media (drive_file_id, name, mime_type, size, album_id, thumbnail_link) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", "", [driveFileId, file.originalname, file.mimetype, file.size, album_id || null, thumbnailLink]);
    processMediaFaces(mediaId).then(() => reclusterFaces().catch(console.error)).catch(console.error);
    res.json({ success: true, mediaId });
  } catch (error: any) { res.status(500).json({ error: "Failed" }); }
});

// ---------- Media list ----------
app.get("/api/media", async (req, res) => {
  setCache(res, "short");
  const { search, album_id, tag } = req.query;
  let queryPg = `SELECT m.*, a.name as album_name, STRING_AGG(t.name, ',') as tags FROM media m LEFT JOIN albums a ON m.album_id = a.id LEFT JOIN media_tags mt ON m.id = mt.media_id LEFT JOIN tags t ON mt.tag_id = t.id WHERE 1=1`;
  const params: any[] = []; let p = 1;
  if (search) { queryPg += ` AND m.name ILIKE $${p++}`; params.push(`%${search}%`); }
  if (album_id) { queryPg += ` AND m.album_id = $${p++}`; params.push(album_id); }
  if (tag) { queryPg += ` AND m.id IN (SELECT media_id FROM media_tags mt2 JOIN tags t2 ON mt2.tag_id = t2.id WHERE t2.name = $${p++})`; params.push(tag); }
  queryPg += ` GROUP BY m.id, a.name ORDER BY m.created_at DESC`;
  if (album_id) setCacheTags(res, `album-${album_id}`);
  try { res.json(await dbQuery(queryPg, "", params)); } catch (e) { res.status(500).json({ error: "DB Err" }); }
});

// ---------- Media file (stream) ----------
app.get("/api/media/:id/file", async (req, res) => {
  setCache(res, "static-immutable");
  setCacheTags(res, `media-${req.params.id}`, `media-file-${req.params.id}`);
  try {
    const media = await dbGet("SELECT * FROM media WHERE id = $1", "", [req.params.id]);
    if (!media) return res.status(404).json({ error: "Not found" });
    let driveRes: any = null;
    for (const account of DRIVE_ACCOUNTS) {
      try {
        const meta = await getDriveClient(account.refreshToken).files.get({ fileId: media.drive_file_id, fields: "size" });
        if (meta.data.size) res.setHeader("Content-Length", meta.data.size);
        driveRes = await getDriveClient(account.refreshToken).files.get({ fileId: media.drive_file_id, alt: "media", acknowledgeAbuse: true }, { responseType: "stream" }); break;
      } catch (e: any) { if (e.code === 404) continue; }
    }
    if (!driveRes) return res.status(404).json({ error: "Not in Drive" });
    res.setHeader("Content-Type", media.mime_type);
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.name)}`);
    res.on("close", () => { try { driveRes?.data?.destroy?.(); } catch {} });
    driveRes.data.pipe(res);
  } catch { res.status(500).json({ error: "Err" }); }
});

// ---------- Media thumbnail ----------
app.get("/api/media/:id/thumbnail", async (req, res) => {
  setCache(res, "static-immutable");
  setCacheTags(res, `media-${req.params.id}`, `media-thumb-${req.params.id}`);
  try {
    const media = await dbGet("SELECT * FROM media WHERE id = $1", "", [req.params.id]);
    if (!media) return res.status(404).json({ error: "Not found" });
    const size = parseInt(req.query.size as string) || 400;
    let thumbnailLink = media.thumbnail_link;
    if (!thumbnailLink) {
      for (const account of DRIVE_ACCOUNTS) {
        try {
          const f = await getDriveClient(account.refreshToken).files.get({ fileId: media.drive_file_id, fields: "thumbnailLink" });
          if (f.data.thumbnailLink) { thumbnailLink = f.data.thumbnailLink; await dbRun("UPDATE media SET thumbnail_link = $1 WHERE id = $2", "", [thumbnailLink, media.id]); break; }
        } catch { continue; }
      }
    }
    if (!thumbnailLink) return res.redirect(`/api/media/${req.params.id}/file`);
    const response = await fetch(thumbnailLink.replace(/=s\d+$/, `=s${size}`), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("HTTP Err");
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.redirect(`/api/media/${req.params.id}/file`); }
});

// ---------- Media delete ----------
app.delete("/api/media/:id", async (req, res) => {
  setCache(res, "mutation");
  try {
    const media = await dbGet("SELECT * FROM media WHERE id = $1", "", [req.params.id]);
    if (!media) return res.status(404).json({ error: "Not found" });
    for (const account of DRIVE_ACCOUNTS) { try { await getDriveClient(account.refreshToken).files.delete({ fileId: media.drive_file_id }); break; } catch (e: any) { if (e.code === 404) continue; } }
    await dbRun("DELETE FROM media WHERE id = $1", "", [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Err" }); }
});

app.put("/api/media/:id/album", async (req, res) => {
  setCache(res, "mutation");
  try { await dbRun("UPDATE media SET album_id = $1 WHERE id = $2", "", [req.body.album_id || null, req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});


// ==========================================
// API DRIVE (Dành riêng cho tab Folder)
// ==========================================
app.get("/api/drive/files", async (req, res) => {
  // Cache 10 phút ở edge vì folder Drive có thể thay đổi khi có upload mới
  setCache(res, "short");
  setCacheTags(res, "drive");
  try {
    const { folderId } = req.query;
    if (!folderId) return res.status(400).json({ error: "folderId is required" });

    let filesData: any[] = [];
    let success = false;

    for (const account of DRIVE_ACCOUNTS) {
      try {
        const drive = getDriveClient(account.refreshToken);
        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`,
          fields: 'files(id, name, mimeType, size)',
          pageSize: 1000,
          orderBy: 'name_natural'
        });
        filesData = response.data.files || [];
        success = true;
        break;
      } catch (e: any) { continue; }
    }

    if (!success) return res.status(404).json({ error: "Không tìm thấy folder hoặc không có quyền truy cập." });

    res.json(filesData);
  } catch (error: any) {
    console.error("Drive files error:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách file từ Drive." });
  }
});

app.get("/api/drive/stream/:id", async (req, res) => {
  setCache(res, "static-immutable");
  setCacheTags(res, `drive-${req.params.id}`);
  try {
    const { id } = req.params;
    const isDownload = req.query.download === "true";
    const isThumbnail = req.query.thumbnail === "true";

    let driveRes: any = null;
    for (const account of DRIVE_ACCOUNTS) {
      try {
        driveRes = await getDriveClient(account.refreshToken).files.get(
          { fileId: id, alt: "media", acknowledgeAbuse: true },
          { responseType: "stream" }
        );
        break;
      } catch (e: any) { if (e.code === 404) continue; }
    }

    if (!driveRes) return res.status(404).json({ error: "File not found on Drive" });

    if (isThumbnail) {
      const meta = await driveRes.data;
      res.setHeader("Content-Type", meta.headers?.["content-type"] || "image/jpeg");
    } else {
      // Trả đúng MIME type để <video>/<img> render được, KHÔNG dùng octet-stream
      const meta = await getDriveClient(DRIVE_ACCOUNTS[0].refreshToken).files.get({ fileId: id, fields: "mimeType" }).catch(() => null);
      res.setHeader("Content-Type", meta?.data?.mimeType || "application/octet-stream");
    }

    if (isDownload) res.setHeader("Content-Disposition", `attachment`);

    driveRes.data.pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to stream file" });
  }
});

// ==========================================
// API KHÁC (Faces, Memories, ...)
// ==========================================
app.get("/api/faces/scan/status", (req, res) => {
  setCache(res, "realtime");
  res.json(scanState);
});

app.post("/api/faces/scan", (req, res) => {
  setCache(res, "mutation");
  if (scanState.running) return res.json({ success: false });
  scanAllFaces().catch(console.error);
  res.json({ success: true });
});

app.get("/api/faces/people", async (req, res) => {
  setCache(res, "medium");
  setCacheTags(res, "people");
  try { res.json(await dbQuery(`SELECT c.*, f.thumbnail_base64 as cover_thumb FROM face_clusters c LEFT JOIN face_embeddings f ON c.cover_face_id = f.id WHERE c.face_count >= 2 ORDER BY c.face_count DESC`, "")); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.get("/api/faces/thumbnail/:faceId", async (req, res) => {
  setCache(res, "static-immutable");
  setCacheTags(res, `face-${req.params.faceId}`);
  try {
    const face = await dbGet("SELECT thumbnail_base64 FROM face_embeddings WHERE id = $1", "", [req.params.faceId]);
    if (!face || !face.thumbnail_base64) return res.status(404).end();
    res.setHeader("Content-Type", "image/jpeg");
    res.send(Buffer.from(face.thumbnail_base64, "base64"));
  } catch { res.status(500).end(); }
});

app.get("/api/faces/people/:clusterId/media", async (req, res) => {
  setCache(res, "medium");
  setCacheTags(res, `cluster-${req.params.clusterId}`);
  try { res.json(await dbQuery(`SELECT m.*, fe.face_index FROM media m JOIN face_embeddings fe ON m.id = fe.media_id WHERE fe.cluster_id = $1 ORDER BY m.created_at DESC`, "", [req.params.clusterId])); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.get("/api/faces/no-people", async (req, res) => {
  setCache(res, "medium");
  setCacheTags(res, "no-people");
  try { res.json(await dbQuery(`SELECT * FROM media WHERE has_people = FALSE AND face_processed = TRUE ORDER BY created_at DESC`, "")); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.put("/api/faces/people/:id", async (req, res) => {
  setCache(res, "mutation");
  try { await dbRun("UPDATE face_clusters SET name = $1, updated_at = NOW() WHERE id = $2", "", [req.body.name, req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.delete("/api/faces/people/:id", async (req, res) => {
  setCache(res, "mutation");
  try {
    await dbRun("UPDATE face_embeddings SET cluster_id = NULL WHERE cluster_id = $1", "", [req.params.id]);
    await dbRun("DELETE FROM face_clusters WHERE id = $1", "", [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Err" }); }
});

// ---------- Memories ----------
app.get("/api/memories", async (req, res) => {
  // Status có thể đổi (pending → rendering → ready) nên cache ngắn
  setCache(res, "short");
  setCacheTags(res, "memories");
  try {
    res.json(await dbQuery(`SELECT m.id, m.title, m.type, m.cluster_id, m.media_ids, m.cover_media_id, m.status, m.created_at, c.name as cluster_name FROM memories m LEFT JOIN face_clusters c ON m.cluster_id = c.id ORDER BY m.created_at DESC`, ""));
  } catch { res.status(500).json({ error: "Err" }); }
});

app.post("/api/memories/create", async (req, res) => {
  setCache(res, "mutation");
  try {
    const id = await dbInsertReturningId(`INSERT INTO memories (title, type, cluster_id, status) VALUES ($1, 'person', $2, 'pending') RETURNING id`, "", [req.body.title || "Memories", req.body.clusterId]);
    res.json({ memoryId: id });
    renderMemoryVideo(id).catch(console.error);
  } catch { res.status(500).json({ error: "Err" }); }
});

app.get("/api/memories/:id/video", async (req, res) => {
  setCache(res, "static-immutable");
  setCacheTags(res, `memory-${req.params.id}`);
  try {
    const mem = await dbGet("SELECT video_base64 FROM memories WHERE id = $1", "", [req.params.id]);
    if (!mem || !mem.video_base64) return res.status(404).json({ error: "Not ready" });
    let driveRes: any = null;
    for (const account of DRIVE_ACCOUNTS) {
      try { driveRes = await getDriveClient(account.refreshToken).files.get({ fileId: mem.video_base64, alt: "media", acknowledgeAbuse: true }, { responseType: "stream" }); break; }
      catch (e: any) { if (e.code === 404) continue; }
    }
    if (!driveRes) return res.status(404).json({ error: "Not found on Drive" });
    res.setHeader("Content-Type", "video/mp4");
    driveRes.data.pipe(res);
  } catch { res.status(500).json({ error: "Err" }); }
});

app.get("/api/memories/:id/cover", async (req, res) => {
  setCache(res, "static-immutable");
  setCacheTags(res, `memory-${req.params.id}`, "memories");
  try {
    const mem = await dbGet("SELECT cover_media_id FROM memories WHERE id = $1", "", [req.params.id]);
    if (!mem?.cover_media_id) return res.status(404).end();
    res.redirect(`/api/media/${mem.cover_media_id}/thumbnail?size=600`);
  } catch { res.status(404).end(); }
});

app.delete("/api/memories/:id", async (req, res) => {
  setCache(res, "mutation");
  try { await dbRun("DELETE FROM memories WHERE id = $1", "", [req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});

// ---------- Notes ----------
app.get("/api/notes", async (req, res) => {
  setCache(res, "long");
  setCacheTags(res, "notes");
  try { res.json(await dbQuery("SELECT * FROM notes ORDER BY created_at DESC", "")); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.post("/api/notes", async (req, res) => {
  setCache(res, "mutation");
  const { title, content, color } = req.body;
  try { const id = await dbInsertReturningId("INSERT INTO notes (title, content, color) VALUES ($1, $2, $3) RETURNING id", "", [title, content, color]); res.json({ id, title, content, color }); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.put("/api/notes/:id", async (req, res) => {
  setCache(res, "mutation");
  const { title, content, color } = req.body;
  try { await dbRun("UPDATE notes SET title=$1, content=$2, color=$3 WHERE id=$4", "", [title, content, color, req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.delete("/api/notes/:id", async (req, res) => {
  setCache(res, "mutation");
  try { await dbRun("DELETE FROM notes WHERE id = $1", "", [req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});

// ---------- Schedule ----------
app.get("/api/schedule", async (req, res) => {
  setCache(res, "long");
  setCacheTags(res, "schedule");
  try { res.json(await dbQuery("SELECT * FROM schedule ORDER BY day_of_week, start_time", "")); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.post("/api/schedule", async (req, res) => {
  setCache(res, "mutation");
  const { subject, day_of_week, start_time, end_time, room } = req.body;
  try { const id = await dbInsertReturningId("INSERT INTO schedule (subject, day_of_week, start_time, end_time, room) VALUES ($1,$2,$3,$4,$5) RETURNING id", "", [subject, day_of_week, start_time, end_time, room]); res.json({ id, subject, day_of_week, start_time, end_time, room }); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.put("/api/schedule/:id", async (req, res) => {
  setCache(res, "mutation");
  const { subject, day_of_week, start_time, end_time, room } = req.body;
  try { await dbRun("UPDATE schedule SET subject=$1, day_of_week=$2, start_time=$3, end_time=$4, room=$5 WHERE id=$6", "", [subject, day_of_week, start_time, end_time, room, req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});

app.delete("/api/schedule/:id", async (req, res) => {
  setCache(res, "mutation");
  try { await dbRun("DELETE FROM schedule WHERE id = $1", "", [req.params.id]); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Err" }); }
});


// ==========================================
// CẤU HÌNH STATIC & KHỞI ĐỘNG SERVER
// ==========================================
async function startServer() {
  const cleanUp = () => {
    const dirs = ['face_cache', 'thumb_cache', 'memories', 'uploads'];
    for (const dir of dirs) {
      const fullPath = path.join(__dirname, dir);
      if (fs.existsSync(fullPath)) {
        try { fs.rmSync(fullPath, { recursive: true, force: true }); } catch {}
      }
    }
    console.log("Đã dọn dẹp các thư mục cache cũ.");
  };
  cleanUp();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    // Static assets (JS/CSS/HTML của Vite build) → cache mạnh 1 năm
    app.use(
      express.static(path.join(__dirname, "dist"), {
        setHeaders: (res, filePath) => {
          // Assets có hash trong tên → cache immutable
          if (/\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|avif)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
          } else {
            // index.html → KHÔNG cache để luôn nhận bản mới khi deploy
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );

    // SPA fallback
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API route not found" });
      }
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () => {
    const runBackgroundScanner = async () => {
      if (scanState.running) return;
      try {
        const unprocessed = await dbQuery("SELECT id, name FROM media WHERE face_processed = FALSE OR face_processed IS NULL LIMIT 1", "");
        if (unprocessed.length > 0) {
          scanState = { running: true, total: 1, done: 0, current: unprocessed[0].name };
          await processMediaFaces(unprocessed[0].id);
          scanState = { running: false, total: 0, done: 0, current: "" };
          await reclusterFaces();
        }
      } catch { scanState = { running: false, total: 0, done: 0, current: "" }; }
    };
    setInterval(runBackgroundScanner, 30 * 1000);
    console.log(`Server listening on port ${process.env.PORT || 3001}`);
  });
  server.timeout = 10 * 60 * 1000;
}
startServer();
export default app;
