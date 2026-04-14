const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: "user",
  host: "db",
  database: "testdb",
  password: "password",
  port: 5432,
});

// init table
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    content TEXT
  );
`);

app.get("/messages", async (req, res) => {
  const result = await pool.query("SELECT * FROM messages");
  res.json(result.rows);
});

app.post("/messages", async (req, res) => {
  const { content } = req.body;
  await pool.query("INSERT INTO messages(content) VALUES($1)", [content]);
  res.sendStatus(201);
});

app.listen(3000, () => console.log("Backend running on 3000"));