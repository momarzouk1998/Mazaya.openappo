-- CreateTable
CREATE TABLE "mazaya"."order_extra_costs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "cost_type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_extra_costs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mazaya"."order_extra_costs" ADD CONSTRAINT "order_extra_costs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "mazaya"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
