import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import db from "@/pages/api/config/connectDB";

const globalForPrisma = globalThis;

// Reaproveita o pool de connectDB em vez de abrir um segundo.
// Antes, cada módulo criava um Pool com max 10 apontando para o mesmo banco,
// somando 20 conexões possíveis por instância contra o limite padrão de 100 do
// Postgres — teto atingido com poucas instâncias.
const adapter = new PrismaPg(db);

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
