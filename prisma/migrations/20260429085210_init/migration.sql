-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "skills" TEXT[],
    "interests" TEXT[],
    "dilemma" TEXT,
    "linkedin_url" TEXT,
    "cv_text" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "starting_stage" TEXT NOT NULL,
    "starting_field" TEXT NOT NULL,
    "starting_role" TEXT NOT NULL,
    "transition_type" TEXT NOT NULL,
    "next_role" TEXT NOT NULL,
    "timeframe_months" INTEGER NOT NULL,
    "key_actions" TEXT[],
    "skills_gained" TEXT[],
    "outcome_24m" TEXT NOT NULL,
    "evidence_url" TEXT,
    "confidence" TEXT NOT NULL,
    "tags" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "path_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "recommendations" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "langfuse_trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "session_id" UUID,
    "email" TEXT NOT NULL,
    "magic_link_sent_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "followup_7d_sent_at" TIMESTAMP(3),
    "followup_30d_sent_at" TIMESTAMP(3),
    "followup_90d_sent_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_created_at_idx" ON "sessions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inputs_session_id_key" ON "inputs"("session_id");

-- CreateIndex
CREATE INDEX "inputs_stage_idx" ON "inputs"("stage");

-- CreateIndex
CREATE INDEX "inputs_field_idx" ON "inputs"("field");

-- CreateIndex
CREATE UNIQUE INDEX "paths_path_id_key" ON "paths"("path_id");

-- CreateIndex
CREATE INDEX "paths_locale_idx" ON "paths"("locale");

-- CreateIndex
CREATE INDEX "paths_starting_stage_idx" ON "paths"("starting_stage");

-- CreateIndex
CREATE INDEX "paths_starting_field_idx" ON "paths"("starting_field");

-- CreateIndex
CREATE INDEX "paths_transition_type_idx" ON "paths"("transition_type");

-- CreateIndex
CREATE INDEX "paths_confidence_idx" ON "paths"("confidence");

-- CreateIndex
CREATE INDEX "path_embeddings_model_idx" ON "path_embeddings"("model");

-- CreateIndex
CREATE UNIQUE INDEX "path_embeddings_path_id_model_key" ON "path_embeddings"("path_id", "model");

-- CreateIndex
CREATE UNIQUE INDEX "results_session_id_key" ON "results"("session_id");

-- CreateIndex
CREATE INDEX "results_created_at_idx" ON "results"("created_at");

-- CreateIndex
CREATE INDEX "results_model_idx" ON "results"("model");

-- CreateIndex
CREATE INDEX "email_subscriptions_email_idx" ON "email_subscriptions"("email");

-- CreateIndex
CREATE INDEX "email_subscriptions_user_id_idx" ON "email_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inputs" ADD CONSTRAINT "inputs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_embeddings" ADD CONSTRAINT "path_embeddings_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_subscriptions" ADD CONSTRAINT "email_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
