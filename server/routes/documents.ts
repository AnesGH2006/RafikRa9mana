/**
 * Document download route — serves generated .docx files from tmp/documents/
 */
import { Router } from "express";
import { existsSync } from "fs";
import { join } from "path";

const router = Router();

router.get("/documents/download/:id", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = req.params.id.replace(/[^a-f0-9-]/g, ""); // sanitize UUID
  if (!id) { res.status(400).json({ error: "Invalid document id" }); return; }

  const filePath = join(process.cwd(), "tmp", "documents", `doc_${id}.docx`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "الوثيقة غير موجودة أو انتهت صلاحيتها" });
    return;
  }

  res.download(filePath, `document_${id}.docx`);
});

export default router;
