const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json());

const {
  POSTGRES_USER = "user",
  POSTGRES_PASSWORD = "password",
  POSTGRES_DB = "testdb",
  POSTGRES_HOST = "db",
  POSTGRES_PORT = 5432,
  BACKUP_SECRET,
  AWS_REGION,
  S3_BUCKET_NAME,
  S3_BACKUP_PREFIX = "postgres",
} = process.env;

const pool = new Pool({
  user: POSTGRES_USER,
  host: POSTGRES_HOST,
  database: POSTGRES_DB,
  password: POSTGRES_PASSWORD,
  port: Number(POSTGRES_PORT),
});

const s3 = new S3Client({
  region: AWS_REGION,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      content TEXT
    )
  `);
}

function requireBackupSecret(req, res, next) {
  const provided = req.header("x-backup-secret");

  if (!BACKUP_SECRET) {
    return res.status(500).json({
      success: false,
      error: "BACKUP_SECRET is not configured",
    });
  }

  if (!provided || provided !== BACKUP_SECRET) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  next();
}

function buildTimestamp() {
  const now = new Date();

  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;
}

app.get("/messages", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM messages ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("GET /messages error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.post("/messages", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({
        success: false,
        error: "content is required",
      });
    }

    await pool.query("INSERT INTO messages(content) VALUES($1)", [content]);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("POST /messages error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.post("/backups", requireBackupSecret, async (req, res) => {
  const timestamp = buildTimestamp();
  const fileName = `${timestamp}.sql`;
  const localDir = "/tmp/backups";
  const localPath = path.join(localDir, fileName);
  const s3Key = `${S3_BACKUP_PREFIX}/${fileName}`;

  try {
    if (!AWS_REGION || !S3_BUCKET_NAME) {
      return res.status(500).json({
        success: false,
        error: "AWS_REGION or S3_BUCKET_NAME is not configured",
      });
    }

    fs.mkdirSync(localDir, { recursive: true });

    await execFileAsync(
      "pg_dump",
      [
        "-h", POSTGRES_HOST,
        "-p", String(POSTGRES_PORT),
        "-U", POSTGRES_USER,
        "-d", POSTGRES_DB,
        "-f", localPath,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: POSTGRES_PASSWORD,
        },
        maxBuffer: 1024 * 1024 * 10,
      }
    );

    const fileBuffer = fs.readFileSync(localPath);

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: "application/sql",
      })
    );

    fs.unlinkSync(localPath);

    return res.json({
      success: true,
      postgresBackup: s3Key,
    });
  } catch (error) {
    console.error("POST /backups error:", error);

    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    return res.status(500).json({
      success: false,
      error: "Backup failed",
      details: error.message,
    });
  }
});

initDb()
  .then(() => {
    app.listen(3000, () => {
      console.log("Backend running on 3000");
    });
  })
  .catch((error) => {
    console.error("Database init failed:", error);
    process.exit(1);
  });
