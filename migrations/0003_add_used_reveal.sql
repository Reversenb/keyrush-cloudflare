-- Migration number: 0003
ALTER TABLE "Progress" ADD COLUMN "usedReveal" BOOLEAN NOT NULL DEFAULT false;
