-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "os" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'basic',
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedCommand" TEXT NOT NULL,
    "hint" TEXT,
    "rewardExp" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "wpm" INTEGER NOT NULL DEFAULT 0,
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "passedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    CONSTRAINT "Progress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "googleId" TEXT,
    "displayName" TEXT,
    "avatar" TEXT DEFAULT 'Felix',
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "adminFavorites" TEXT NOT NULL DEFAULT '[]',
    "linuxLevel" INTEGER NOT NULL DEFAULT 1,
    "linuxExp" INTEGER NOT NULL DEFAULT 0,
    "windowsLevel" INTEGER NOT NULL DEFAULT 1,
    "windowsExp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "wpm" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Mission_os_level_key" ON "Mission"("os", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_missionId_key" ON "Progress"("userId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
