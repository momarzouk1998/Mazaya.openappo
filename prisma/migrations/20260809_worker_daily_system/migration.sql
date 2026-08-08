-- AlterTable: Add daily_rate and travel_daily_rate to workers
ALTER TABLE "mazaya"."workers" ADD COLUMN IF NOT EXISTS "daily_rate" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "mazaya"."workers" ADD COLUMN IF NOT EXISTS "travel_daily_rate" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable: worker_daily_logs
CREATE TABLE IF NOT EXISTS "mazaya"."worker_daily_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID NOT NULL,
    "order_id" UUID,
    "work_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daily_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "is_travel" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_travel_expenses
CREATE TABLE IF NOT EXISTS "mazaya"."worker_travel_expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expense_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT DEFAULT 'نقدي',
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_travel_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_bonuses
CREATE TABLE IF NOT EXISTS "mazaya"."worker_bonuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID NOT NULL,
    "bonus_type" TEXT NOT NULL DEFAULT 'مكافأة',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "bonus_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_weekly_settlements
CREATE TABLE IF NOT EXISTS "mazaya"."worker_weekly_settlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_days" INTEGER NOT NULL DEFAULT 0,
    "total_wages" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_bonuses" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_discounts" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_advances" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "settled_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_by" INTEGER,

    CONSTRAINT "worker_weekly_settlements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_daily_logs_worker_id_fkey') THEN
        ALTER TABLE "mazaya"."worker_daily_logs" ADD CONSTRAINT "worker_daily_logs_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "mazaya"."workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_daily_logs_order_id_fkey') THEN
        ALTER TABLE "mazaya"."worker_daily_logs" ADD CONSTRAINT "worker_daily_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "mazaya"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_travel_expenses_order_id_fkey') THEN
        ALTER TABLE "mazaya"."worker_travel_expenses" ADD CONSTRAINT "worker_travel_expenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "mazaya"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_bonuses_worker_id_fkey') THEN
        ALTER TABLE "mazaya"."worker_bonuses" ADD CONSTRAINT "worker_bonuses_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "mazaya"."workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_weekly_settlements_worker_id_fkey') THEN
        ALTER TABLE "mazaya"."worker_weekly_settlements" ADD CONSTRAINT "worker_weekly_settlements_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "mazaya"."workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
