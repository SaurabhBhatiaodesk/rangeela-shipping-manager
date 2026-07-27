-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopKlaviyoSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "klaviyoApiKey" TEXT NOT NULL DEFAULT '',
    "pieceMadeTemplateId" TEXT NOT NULL DEFAULT '',
    "leavingForCanadaTemplateId" TEXT NOT NULL DEFAULT '',
    "arrivedInCanadaTemplateId" TEXT NOT NULL DEFAULT '',
    "thursdayTemplateId" TEXT NOT NULL DEFAULT '',
    "pieceMadeLabel" TEXT NOT NULL DEFAULT '',
    "leavingForCanadaLabel" TEXT NOT NULL DEFAULT '',
    "arrivedInCanadaLabel" TEXT NOT NULL DEFAULT '',
    "depositFulfilledLabel" TEXT NOT NULL DEFAULT '',
    "depositFulfilledDoneLabel" TEXT NOT NULL DEFAULT '',
    "pieceMadeTag" TEXT NOT NULL DEFAULT '',
    "leavingForCanadaTag" TEXT NOT NULL DEFAULT '',
    "arrivedInCanadaTag" TEXT NOT NULL DEFAULT '',
    "pieceMadeEmailSentTag" TEXT NOT NULL DEFAULT '',
    "leavingEmailSentTag" TEXT NOT NULL DEFAULT '',
    "arrivedEmailSentTag" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopKlaviyoSettings" ("arrivedEmailSentTag", "arrivedInCanadaLabel", "arrivedInCanadaTag", "arrivedInCanadaTemplateId", "depositFulfilledDoneLabel", "depositFulfilledLabel", "leavingEmailSentTag", "leavingForCanadaLabel", "leavingForCanadaTag", "leavingForCanadaTemplateId", "pieceMadeEmailSentTag", "pieceMadeLabel", "pieceMadeTag", "pieceMadeTemplateId", "shop", "thursdayTemplateId", "updatedAt") SELECT "arrivedEmailSentTag", "arrivedInCanadaLabel", "arrivedInCanadaTag", "arrivedInCanadaTemplateId", "depositFulfilledDoneLabel", "depositFulfilledLabel", "leavingEmailSentTag", "leavingForCanadaLabel", "leavingForCanadaTag", "leavingForCanadaTemplateId", "pieceMadeEmailSentTag", "pieceMadeLabel", "pieceMadeTag", "pieceMadeTemplateId", "shop", "thursdayTemplateId", "updatedAt" FROM "ShopKlaviyoSettings";
DROP TABLE "ShopKlaviyoSettings";
ALTER TABLE "new_ShopKlaviyoSettings" RENAME TO "ShopKlaviyoSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
