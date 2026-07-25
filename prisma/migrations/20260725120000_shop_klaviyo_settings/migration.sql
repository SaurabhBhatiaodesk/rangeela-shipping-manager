-- CreateTable
CREATE TABLE IF NOT EXISTS "ShopKlaviyoSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "pieceMadeTemplateId" TEXT NOT NULL DEFAULT '',
    "leavingForCanadaTemplateId" TEXT NOT NULL DEFAULT '',
    "arrivedInCanadaTemplateId" TEXT NOT NULL DEFAULT '',
    "thursdayTemplateId" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
