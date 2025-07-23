-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "userId" TEXT NOT NULL
);
INSERT INTO "new_Component" ("html", "id", "name", "userId") SELECT "html", "id", "name", "userId" FROM "Component";
DROP TABLE "Component";
ALTER TABLE "new_Component" RENAME TO "Component";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
