import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if(!process.env.MYSQL_HOST) {
  throw new Error('no MYSQL_HOST variable in env file');
}

if(!process.env.MYSQL_USER) {
  throw new Error('no MYSQL_USER variable in env file');
}

if(!process.env.MYSQL_ROOT_PASSWORD) {
  throw new Error('no MYSQL_ROOT_PASSWORD variable in env file');
}

if(!process.env.MYSQL_DATABASE) {
  throw new Error('no MYSQL_DATABASE variable in env file');
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.MYSQL_HOST!,
    port: 3306,
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
    database: process.env.MYSQL_DATABASE!,
  },
  // для использования параллельно с sequalize игнорим существующие неопределенные для drizzle таблицы
  strict: false,
});