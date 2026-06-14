-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tax_office" TEXT,
    "tax_number" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yarn_stocks" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "yarn_type" TEXT NOT NULL,
    "ne_number" TEXT,
    "color" TEXT NOT NULL,
    "color_code" TEXT,
    "lot_number" TEXT NOT NULL,
    "initial_kg" DECIMAL(10,2) NOT NULL,
    "current_kg" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yarn_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- AddForeignKey
ALTER TABLE "yarn_stocks" ADD CONSTRAINT "yarn_stocks_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
