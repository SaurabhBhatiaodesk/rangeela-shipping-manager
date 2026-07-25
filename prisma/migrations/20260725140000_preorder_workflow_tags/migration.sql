-- AlterTable
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "pieceMadeTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "leavingForCanadaTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "arrivedInCanadaTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "pieceMadeEmailSentTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "leavingEmailSentTag" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "arrivedEmailSentTag" TEXT NOT NULL DEFAULT '';
