import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 7000,
  serverType: process.env.SERVER_TYPE,
  databaseUrl: process.env.DATABASE_URL,
};
