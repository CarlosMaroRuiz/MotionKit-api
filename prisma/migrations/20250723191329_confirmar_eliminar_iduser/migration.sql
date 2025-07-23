/*
  Warnings:

  - You are about to drop the column `userId` on the `Component` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL
);
INSERT INTO "new_Component" ("html", "id", "name") SELECT "html", "id", "name" FROM "Component";
DROP TABLE "Component";
ALTER TABLE "new_Component" RENAME TO "Component";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
