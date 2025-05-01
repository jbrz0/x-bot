-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "targetId" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InteractionLog_authorId_createdAt_idx" ON "InteractionLog"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "InteractionLog_type_createdAt_idx" ON "InteractionLog"("type", "createdAt");
