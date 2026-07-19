-- CreateEnum
-- CreateTable
CREATE TABLE "mazaya"."customer_payments" (
    "id" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL DEFAULT 'نقدي',
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mazaya"."customer_payments" ADD CONSTRAINT "customer_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "mazaya"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mazaya"."customer_payments" ADD CONSTRAINT "customer_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "mazaya"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
