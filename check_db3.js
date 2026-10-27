import Database from "better-sqlite3";
const db = new Database("database.sqlite");
db.prepare("INSERT INTO media (drive_file_id, name, mime_type, size, album_id) VALUES (?, ?, ?, ?, ?)").run("test", "test", "test", 123, "1");
console.log(db.prepare("SELECT * FROM media WHERE name = 'test'").all());
