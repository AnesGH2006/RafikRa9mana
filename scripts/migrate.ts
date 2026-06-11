import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function migrate() {
  console.log("Running migration...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      sid varchar PRIMARY KEY,
      sess jsonb NOT NULL,
      expire timestamp NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar UNIQUE,
      first_name varchar,
      last_name varchar,
      profile_image_url varchar,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS school_info (
      id varchar(64) PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nom varchar(255) NOT NULL DEFAULT '',
      wilaya varchar(100) NOT NULL DEFAULT '',
      commune varchar(100) NOT NULL DEFAULT '',
      annee varchar(20) NOT NULL DEFAULT '2025-2026',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`ALTER TABLE school_info ADD COLUMN IF NOT EXISTS directeur varchar(255) DEFAULT '';`);
  await db.execute(sql`ALTER TABLE school_info ADD COLUMN IF NOT EXISTS phone varchar(30) DEFAULT '';`);

  await db.execute(sql`DO $$ BEGIN CREATE TYPE niveau AS ENUM ('1AM','2AM','3AM','4AM'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE sexe AS ENUM ('M','F'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE statut_eleve AS ENUM ('nouveau','redoublant'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE resultat_eleve AS ENUM ('admis','non_admis'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS students (
      id varchar(64) PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nom_prenom varchar(255) NOT NULL,
      date_naissance varchar(30),
      niveau niveau NOT NULL,
      classe varchar(10) NOT NULL,
      sexe sexe NOT NULL,
      statut statut_eleve NOT NULL DEFAULT 'nouveau',
      resultat resultat_eleve,
      annee varchar(20) NOT NULL DEFAULT '2025-2026',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS grades (
      id varchar(64) PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id varchar(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      annee varchar(20) NOT NULL DEFAULT '2025-2026',
      trimestre integer NOT NULL CHECK (trimestre IN (1,2,3)),
      subject varchar(50) NOT NULL,
      score numeric(5,2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS absences (
      id varchar(64) PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id varchar(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      annee varchar(20) NOT NULL DEFAULT '2025-2026',
      trimestre integer NOT NULL,
      justified_hours integer NOT NULL DEFAULT 0,
      unjustified_hours integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  console.log("Migration complete.");
  await pool.end();
}

migrate().catch(e => { console.error(e); process.exit(1); });
