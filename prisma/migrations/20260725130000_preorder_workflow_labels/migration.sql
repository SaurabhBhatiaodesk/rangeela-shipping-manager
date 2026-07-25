-- AlterTable
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "pieceMadeLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "leavingForCanadaLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "arrivedInCanadaLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "depositFulfilledLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopKlaviyoSettings" ADD COLUMN "depositFulfilledDoneLabel" TEXT NOT NULL DEFAULT '';
