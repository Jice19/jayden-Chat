-- CreateTable
CREATE TABLE IF NOT EXISTS "rag_documents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "stored_name" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "ext" TEXT NOT NULL,
  "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "index_status" TEXT NOT NULL DEFAULT 'PENDING',
  "indexed_at" TIMESTAMPTZ,
  "index_error" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rag_documents_user_hash_size"
ON "rag_documents" ("user_id", "file_hash", "size");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_rag_documents_user_uploaded"
ON "rag_documents" ("user_id", "uploaded_at" DESC);
