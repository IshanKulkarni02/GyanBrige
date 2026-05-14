import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import { defineConfig } from "prisma/config";

dotenvConfig({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
