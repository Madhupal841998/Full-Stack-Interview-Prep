# Phase 16 — File Upload and Media Processing

> **Part of:** Backend Engineering Zero-to-Expert Roadmap
> **Comes after:** Phase 15 — Background Jobs and Messaging
> **Comes next:** Phase 17 — Distributed Systems
> **Priority:** The whole phase is **MUST KNOW**.

---

## Why This Phase Matters

Almost every real backend has to accept a file from a user at some point: a profile photo, a resume, an invoice PDF, a video for a course. This sounds simple, and that is exactly why it is dangerous. A careless file-upload feature is one of the most common ways a backend gets **hacked**, **filled with garbage data**, or **taken down by its own users**.

This phase answers three questions, in this order:

1. **How do I accept a file safely?** (multipart parsing, streaming, size limits, validating what was actually sent — not what the client claims)
2. **Where does the file actually live?** (not on your server's disk — in **object storage**, reached directly by the client wherever possible)
3. **How do I turn a raw file into something useful** (a resized image, a thumbnail, a transcoded video) **without blocking your API**?

> **One picture to keep in your head for the whole phase:**
> Your backend is a **hotel reception desk**, not a warehouse.
> Guests (files) should not be stored behind the reception desk (your server's disk or memory). They go straight to the **hotel's storage facility** (object storage, like S3), using a **temporary, single-use key** (a presigned URL) that reception handed them.
> Reception's job is to: check the guest has a valid reason to be there (**auth**), check the guest is not obviously a threat (**validation**), hand out the temporary key, and then **write down what happened in the guest log** (a database row tracking status). The actual unpacking and cleaning of the room (resizing, transcoding, scanning) is done later by **housekeeping** (a background worker), not by the receptionist.

This phase builds directly on:
- **Phase 4 (Node.js Core)** — streams, buffers, backpressure
- **Phase 15 (Background Jobs and Messaging)** — queues, workers, retry, idempotency

If those ideas feel shaky, a quick review before this phase will pay off, because file processing is one of the most natural places to use a background job queue.

---

## How To Use This Phase

Every topic follows the same 12-step order as the roadmap:

| # | Step | What you do |
|---|------|-------------|
| 1 | Proper definition | Read the exact, correct meaning |
| 2 | Simple meaning | Understand it with a real-world analogy |
| 3 | Why it is needed | Know what problem it solves |
| 4 | How it works internally | See what is happening under the hood |
| 5 | Syntax and API | Learn the exact code form |
| 6 | Small example | Run a tiny example yourself |
| 7 | Real backend usage | See where it appears in Node.js/Express work |
| 8 | Edge cases | Learn the strange behaviors |
| 9 | Common mistakes | Learn what breaks in real projects |
| 10 | Interview answer | Practice a short, clear answer |
| 11 | Practice problem | Write code without copying |
| 12 | Production considerations | Know what matters when real users depend on it |

Steps 5 and 6 are combined into one code block.

**Practice rule:** for this phase, do not only read the code. Actually try to break your own upload endpoint: send a huge file, send a `.exe` renamed to `.jpg`, send no `Content-Length`, disconnect halfway through. This phase is mostly about defending against a hostile or careless client.

---

## Setup For This Phase

```bash
mkdir phase-16-uploads && cd phase-16-uploads
npm init -y
npm i express busboy file-type sharp @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm i -D typescript tsx @types/node @types/express @types/busboy
npx tsc --init
```

| Package | Role in this phase |
|---------|--------------------|
| `busboy` | Low-level, **streaming** multipart form parser (no buffering to disk or memory) |
| `file-type` | Detects the real file type from its **content** (magic bytes), not its name |
| `sharp` | Fast image resizing, format conversion, and metadata reading |
| `@aws-sdk/client-s3` | Talks to S3-compatible object storage |
| `@aws-sdk/s3-request-presigner` | Generates **presigned URLs** for direct upload/download |

You do not need a real AWS account to learn the ideas: MinIO (a free, self-hosted, S3-compatible server) or LocalStack can run locally for practice. The S3 SDK code is the same either way; only the endpoint URL changes.

---

## Phase 16 Map and Time Guide

| Section | Topic | Rough time (1–2 hrs/day) |
|---------|-------|---------------------------|
| 16.1 | Accepting Uploads Safely | ~1 week |
| 16.2 | Object Storage and Presigned URLs | ~1 week |
| 16.3 | Media Processing | ~1 week |
| 16.4 | Status Tracking, Access Control and Lifecycle | ~1 week |
| — | Phase 16 capstone project + revision | ~1 week |

---

## Table of Contents

- [16.1 Accepting Uploads Safely](#161-accepting-uploads-safely)
- [16.2 Object Storage and Presigned URLs](#162-object-storage-and-presigned-urls)
- [16.3 Media Processing](#163-media-processing)
- [16.4 Status Tracking, Access Control and Lifecycle](#164-status-tracking-access-control-and-lifecycle)
- [Phase 16 Capstone Project](#phase-16-capstone-project--secure-media-upload-service)
- [Phase 16 Interview Question Bank](#phase-16-interview-question-bank)
- [Phase 16 Exit Checklist](#phase-16-exit-checklist)

---

# 16.1 Accepting Uploads Safely

**Goal:** Accept a file over HTTP without trusting anything the client says about it, and without letting one upload take down your server.

**Topics in this section:** multipart uploads → streaming uploads → file size limits → MIME validation → extension validation → virus scanning concepts.

---

## 16.1.1 Multipart Uploads

1. **Definition** — `multipart/form-data` is an HTTP encoding for a request body that can hold **several parts**: text fields and one or more files, each with its own headers. It is the standard way a browser `<form>` or a mobile app sends a file.
2. **Simple meaning** — A multipart request is a **parcel with several smaller boxes inside, each with its own label**. One box might be labeled "title" and contain text. Another is labeled "photo" and contains binary image data. A special string, the **boundary**, marks where each box starts and ends.
3. **Why it is needed** — Plain JSON cannot hold binary data cleanly. Multipart lets a request carry mixed data — some text fields and one or more files — in a single HTTP call.
4. **How it works internally**
   - The request has a header like `Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXYZ`.
   - The body is a sequence of parts, each separated by `--boundary`, each part having its own small header block (`Content-Disposition`, `Content-Type`) and then raw bytes.
   - A **parser** reads the body byte by byte (or chunk by chunk) and splits it into fields and files as it goes. It does **not** need to hold the whole body in memory to do this — see 16.1.2.
5. **Syntax and API + 6. Small example**

```ts
// A raw multipart body looks roughly like this (simplified):
//
// ------WebKitFormBoundaryXYZ
// Content-Disposition: form-data; name="title"
//
// My Vacation Photo
// ------WebKitFormBoundaryXYZ
// Content-Disposition: form-data; name="photo"; filename="beach.jpg"
// Content-Type: image/jpeg
//
// <raw JPEG bytes...>
// ------WebKitFormBoundaryXYZ--

import express from "express";
import Busboy from "busboy";

const app = express();

app.post("/uploads", (req, res) => {
  const bb = Busboy({ headers: req.headers });

  bb.on("field", (name, value) => {
    console.log("field:", name, value);          // e.g. "title" -> "My Vacation Photo"
  });

  bb.on("file", (name, fileStream, info) => {
    const { filename, mimeType } = info;
    console.log("file:", name, filename, mimeType);
    fileStream.resume();                          // for now, just drain it (see 16.1.2)
  });

  bb.on("close", () => res.status(201).json({ message: "Upload received" }));
  bb.on("error", (err) => res.status(400).json({ message: "Bad upload" }));

  req.pipe(bb);
});
```

7. **Real backend usage** — Profile picture upload, document upload, bulk CSV import, chat file attachments — anywhere a client sends a file alongside (or instead of) JSON fields.
8. **Edge cases**
   - A client can lie about `filename`, `mimeType`, and field order. **None of the headers on a part are trustworthy on their own** (see 16.1.4).
   - A part can have **no filename** (a plain text field) or an **empty file** (0 bytes).
   - Multiple files can share the same field name (`photos[]`), and a client can send far more files than your form expects.
9. **Common mistakes** — Trusting `info.mimeType` or `filename` as the truth. Not setting any limit on the number of files or fields (a hostile client can send thousands of tiny parts to exhaust memory or CPU). Forgetting to handle the `error` event on the parser or the file stream.
10. **Interview answer** — "`multipart/form-data` lets one HTTP request carry several parts — text fields and files — separated by a boundary string. I parse it with a streaming parser like Busboy, which reads the body as it arrives instead of buffering the whole thing, and I never trust the filename or content type a part claims for itself."
11. **Practice problem** — Build the endpoint above. Send a request with two text fields and one file using `curl -F`. Log every event Busboy emits, in order.
12. **Production considerations** — Never build your own multipart parser. Use a well-maintained library, and keep it updated (parser bugs are a classic source of security incidents).

---

## 16.1.2 Streaming Uploads

1. **Definition** — A **streaming upload** processes the file's bytes **as they arrive**, in small chunks, instead of waiting for the entire file to arrive and holding it all in memory (or writing the whole thing to a temp file) before doing anything with it.
2. **Simple meaning** — Think back to Phase 1's restaurant analogy. A **buffering** upload is like waiting for an entire truck to be unloaded into your kitchen before you start cooking. A **streaming** upload is like a **conveyor belt**: ingredients move past you continuously, and you deal with each piece as it passes, never holding the whole truck's cargo at once.
3. **Why it is needed** — A single Node.js process has limited memory. If ten users each upload a 500 MB video at the same time and your server buffers each one fully in memory, that is 5 GB gone instantly, and your process crashes. Streaming keeps memory usage roughly constant, no matter the file size.
4. **How it works internally** — Busboy (and Node.js streams generally) deliver the file as a **Readable stream**, in chunks (`data` events, or async iteration). You can `.pipe()` that stream directly to its final destination — another stream, a hash function, or, best of all, **directly to object storage** — without ever holding the complete file in your process's memory. This uses the same **backpressure** mechanism from Phase 1.5 and Phase 4: if the destination is slow, Node.js automatically pauses reading more chunks.
5. **Syntax and API + 6. Small example**

```ts
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";

bb.on("file", async (name, fileStream, info) => {
  // Compute a hash WHILE streaming, with no extra pass over the data
  const hash = crypto.createHash("sha256");
  fileStream.on("data", (chunk) => hash.update(chunk));

  try {
    // Stream straight to disk (a temp location) without buffering in memory
    await pipeline(fileStream, createWriteStream(`/tmp/${info.filename}`));
    console.log("sha256:", hash.digest("hex"));
  } catch (err) {
    console.error("Upload stream failed:", err);
    // IMPORTANT: clean up any partial file here
  }
});

// The BEST option for a backend: stream straight into object storage,
// never touching your server's disk at all (full example in 16.2).
```

7. **Real backend usage** — Large file uploads (videos, archives, datasets). Computing a checksum while the file streams by, so you never need a second read pass. Streaming the file body directly into an S3 `PutObject` or `UploadPart` call.
8. **Edge cases**
   - If you need to **inspect** the file's real content (see 16.1.4) before deciding where it should go, you must read the **first chunk**, check it, and only then continue streaming the rest — you cannot "un-read" a stream.
   - A slow destination (a slow disk, a slow network to S3) will make Node.js apply backpressure and pause reading from the client. This is correct behavior, but it means one slow upload can occupy a connection for a long time — plan timeouts accordingly.
   - If the client disconnects mid-upload, the stream emits an `error` or simply ends early. You must detect this and clean up any partial file.
9. **Common mistakes** — Using `req.body` style buffering (like a naive `multer.memoryStorage()`) for large files "because it's simpler." Reading the entire stream into an array of chunks with `fileStream.on("data", chunks.push)` and concatenating at the end — this defeats the whole purpose of streaming.
10. **Interview answer** — "Streaming means I process a file in chunks as it arrives, instead of buffering the whole thing in memory first. Node.js streams give me backpressure for free, so a slow destination naturally slows down how fast I read from the client. This keeps memory usage flat regardless of file size, which matters a lot for large uploads under concurrent load."
11. **Practice problem** — Modify the endpoint from 16.1.1 to stream the file to a temp file **and** compute its SHA-256 hash at the same time, without reading the file twice. Log memory usage (`process.memoryUsage().heapUsed`) before and during a 200 MB upload to confirm it stays flat.
12. **Production considerations** — Prefer streaming directly to object storage over writing to local disk at all — local disk on a container is often small, ephemeral, and shared across requests, and it disappears when the container restarts.

---

## 16.1.3 File Size Limits

1. **Definition** — A **file size limit** is a hard cap on how many bytes a single file (or an entire request) may contain, enforced **before** the whole file has been received, not after.
2. **Simple meaning** — A **luggage scale at airport check-in**. The airline does not wait until your bag is fully loaded onto the plane to discover it is too heavy — the scale rejects it immediately, at the counter.
3. **Why it is needed** — Without a limit, a malicious or buggy client can send an enormous file (or claim to send one forever) and exhaust your server's memory, disk, network bandwidth, or the object storage bill. This is a common and cheap **denial-of-service** vector.
4. **How it works internally** — A streaming parser can be told a byte limit and will **stop early**, emitting a `limit` or `error` event, once the limit is crossed — it does not need to receive the whole oversized file first. Limits should exist at multiple layers: the reverse proxy / load balancer, the parser, and the application logic.
5. **Syntax and API + 6. Small example**

```ts
const MAX_FILE_BYTES = 10 * 1024 * 1024;        // 10 MB
const MAX_FIELDS = 10;
const MAX_FILES = 1;

const bb = Busboy({
  headers: req.headers,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES,
    fields: MAX_FIELDS,
  },
});

let limitHit = false;

bb.on("file", (name, fileStream, info) => {
  fileStream.on("limit", () => {
    limitHit = true;
    fileStream.resume();                         // drain the rest so the request can finish
    // (the destination write should also be aborted/cleaned up here)
  });
});

bb.on("close", () => {
  if (limitHit) return res.status(413).json({ message: "File too large" });
  res.status(201).json({ message: "Upload received" });
});

// Defense in depth: also cap the WHOLE request body at your web server / reverse proxy
// (e.g. nginx: client_max_body_size 15m;)
```

7. **Real backend usage** — Every public upload endpoint needs a size limit matched to its purpose: a few MB for a profile photo, tens or hundreds of MB for a video, and a separate, much larger flow (16.2.3) for anything bigger than that.
8. **Edge cases**
   - `Content-Length` is a **claim** from the client, not a guarantee — a chunked-encoding request may not send it at all. Always enforce the limit while **reading**, not only by checking the header first.
   - Hitting a file-size limit mid-stream leaves a **partial** upload sitting in whatever destination you were writing to. You must clean it up.
   - Limits should differ by **route and by user tier**, not be one global number for the whole app.
9. **Common mistakes** — Only checking `Content-Length` and trusting it. Setting the limit only in the application code and forgetting the reverse proxy, so a giant request still occupies a worker process before your code ever sees it. Not cleaning up a partial file after a limit is hit.
10. **Interview answer** — "I enforce file size limits at multiple layers: the reverse proxy rejects oversized requests before they reach the app, and the streaming parser stops early once a configured byte limit is crossed, rather than waiting for the whole file. I never trust `Content-Length` alone, because it is just a header the client sends."
11. **Practice problem** — Set a 1 MB limit and try uploading a 5 MB file. Confirm the server rejects it quickly (not after fully receiving 5 MB) and that no partial file is left on disk.
12. **Production considerations** — Pick limits deliberately per use case, return a clear `413 Payload Too Large`, and monitor how often the limit is hit — a sudden spike can be a sign of abuse or of a legitimate need to raise the limit.

---

## 16.1.4 MIME Validation and Extension Validation

1. **Definition**
   - **Extension validation** checks the file name's suffix (`.jpg`, `.pdf`).
   - **MIME validation (by claimed header)** checks the `Content-Type` the client sent for that part.
   - **Real content validation ("magic bytes")** inspects the **actual first few bytes** of the file to determine its true type, independent of what the client claims.
2. **Simple meaning** — The filename and the `Content-Type` header are like a **label someone wrote on a box by hand** — easy to fake. The magic bytes are like **X-raying the box** to see what is really inside, no matter what the label says.
3. **Why it is needed** — A file named `photo.jpg` with `Content-Type: image/jpeg` can still contain **anything**: an executable, a script, an HTML file with embedded JavaScript (which, if ever served back with the wrong content type, can lead to XSS), or a corrupted image crafted to exploit a bug in an image-processing library. Trusting the name or the header alone is a classic vulnerability.
4. **How it works internally** — Real file formats start with a distinctive sequence of bytes (a **signature** or "magic number"): a PNG always starts with `89 50 4E 47`, a JPEG with `FF D8 FF`, a PDF with `%PDF`. A content-sniffing library reads just the first chunk of bytes and matches them against known signatures, giving you the file's **true** type regardless of its name or header.
5. **Syntax and API + 6. Small example**

```ts
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

bb.on("file", async (name, fileStream, info) => {
  const ext = getExtension(info.filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    fileStream.resume();
    return res.status(400).json({ message: "File extension not allowed" });
  }

  // Read only the first chunk to sniff the real type, then decide
  const firstChunk: Buffer = await new Promise((resolve, reject) => {
    fileStream.once("data", resolve);
    fileStream.once("error", reject);
  });

  const detected = await fileTypeFromBuffer(firstChunk);
  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    fileStream.resume();                          // drain and reject
    return res.status(400).json({ message: "File content does not match an allowed image type" });
  }

  // Now it's safe to continue: pipe firstChunk + the rest of fileStream onward
  // (e.g. to object storage — see 16.2)
});

function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i);
}
```

7. **Real backend usage** — Every upload endpoint that accepts specific file types (images, PDFs, documents) should check the real content, not just the name or header, especially before ever **serving that file back to another user's browser**.
8. **Edge cases**
   - Extension checks alone are trivially bypassed by renaming a file.
   - Some formats (like plain text or CSV) have **no** reliable magic bytes — for these, other checks matter more (size limits, content scanning, strict `Content-Disposition` on download).
   - A file can be a **valid but malicious** image (a crafted PNG that exploits a decoder bug) — magic-byte checking confirms the *type*, not that the file is *safe* (that's what dedicated scanning and using well-patched libraries is for).
   - Checking only the first few bytes is fast, but some polyglot files are crafted to look valid as one type while smuggling a second format later in the bytes; combine this with strict libraries and least-privilege processing.
9. **Common mistakes** — Validating only the extension. Validating only the client-supplied `Content-Type`. Rejecting based on extension **or** MIME type, but never actually opening the bytes.
10. **Interview answer** — "The client's filename and `Content-Type` header are just labels the client chose — I never trust them alone. I check the real file content by reading its magic bytes with a content-sniffing library, and I compare that against an allow-list of exactly the types I support, rejecting anything else."
11. **Practice problem** — Rename a `.txt` file to `photo.jpg`, set `Content-Type: image/jpeg` manually with `curl`, and upload it. Confirm your endpoint rejects it based on the real content check, even though the name and header look correct.
12. **Production considerations** — Always validate on an **allow-list** ("only these exact types"), never a deny-list ("everything except these"). Store the **detected** MIME type (not the client's claim) alongside the file, and use it — not the client's header — whenever you serve the file back.

---

## 16.1.5 Virus Scanning Concepts

1. **Definition** — **Virus (malware) scanning** is checking an uploaded file's content against known malware signatures (and sometimes behavioral heuristics) before treating it as safe to store, process, or share with other users.
2. **Simple meaning** — It is the **security checkpoint at a border crossing**, done **after** the luggage-weight check (size limit) and the customs-declaration check (MIME/extension validation), but before the traveler is allowed to walk freely into the country (before the file is trusted by the rest of your system).
3. **Why it is needed** — Content validation confirms a file **looks like** a valid JPEG or PDF. It says nothing about whether that file also contains a known virus payload, a macro-based exploit inside an Office document, or other malicious content. Any system where one user's upload can later be **downloaded by other users** (shared drives, support ticket attachments, course materials) is a serious risk without this.
4. **How it works internally** — In practice, you do not write your own malware detection. A common open-source option is **ClamAV**, which runs as a daemon; your backend sends it the file's bytes (over a socket) and gets back a clean/infected verdict, using a signature database that is updated regularly. This is usually done as an **asynchronous step** in the background job pipeline (Phase 15), not inline in the request, because scanning takes real time.
5. **Syntax and API + 6. Small example**

```ts
// Conceptual flow (ClamAV via its daemon, using a client library)
import NodeClam from "clamscan";                 // one common wrapper library

async function scanBuffer(buffer: Buffer): Promise<{ isInfected: boolean; viruses: string[] }> {
  const clam = await new NodeClam().init({
    clamdscan: { host: "clamav", port: 3310 },    // the ClamAV daemon, often a sidecar container
  });
  const { isInfected, viruses } = await clam.scanBuffer(buffer);
  return { isInfected, viruses };
}

// Used as a background job step (see 16.3.5 and Phase 15)
async function processUploadJob(uploadId: string) {
  const file = await downloadFromStorage(uploadId);
  const { isInfected, viruses } = await scanBuffer(file);

  if (isInfected) {
    await markUploadFailed(uploadId, `Malware detected: ${viruses.join(", ")}`);
    await quarantineOrDeleteFile(uploadId);
    return;
  }
  await continueProcessing(uploadId);              // resize, transcode, etc.
}
```

7. **Real backend usage** — Any system where files move between users: shared team drives, support attachments, course upload portals, marketplace listing images. Less critical (but still good practice) for files only the uploader will ever see again, like a personal backup.
8. **Edge cases** — Scanning takes time and CPU, so it must not block the HTTP response — the upload should be accepted, marked `PROCESSING`, and scanned asynchronously (16.4.1). No scanner catches 100% of threats (especially brand-new, unknown malware) — it is a strong layer, not a guarantee. Large files may need to be scanned in chunks or have a size cap specifically for scanning.
9. **Common mistakes** — Treating "passed the MIME check" as "safe." Scanning synchronously inside the request handler, making uploads slow and fragile. Not having any quarantine/failure path — just silently accepting infected files if the scanner call fails.
10. **Interview answer** — "MIME and extension validation confirm a file's *shape*; they say nothing about malicious *content*. For any system where files can reach other users, I add an asynchronous malware scan, typically with ClamAV, as a background job step after upload. If the scan fails, I mark the upload as failed and quarantine or delete the file, rather than silently letting it through."
11. **Practice problem** — Set up ClamAV locally (or read its docs closely if you cannot run it), and sketch the background job that: downloads the file from storage, scans it, and transitions the upload's status based on the result.
12. **Production considerations** — Decide clearly what happens on a scanner **outage** (fail closed — reject the upload — is usually safer than fail open). Keep the scanner's signature database updated automatically. Log every infected detection for security monitoring.

---

## 16.1 Practice Projects

- **Secure upload endpoint:** a single `/uploads` route that streams the file (never buffering it fully), enforces a size limit, validates the real content type against an allow-list, and rejects anything else with a clear `4xx` status.
- **Abuse test suite:** a script that tries to break your endpoint — oversized file, renamed extension, no `Content-Length`, mid-upload disconnect, hundreds of tiny fields — and confirms every case is handled gracefully.

**16.1 is done when you can:**
- [ ] Explain multipart encoding and parse it with a streaming parser
- [ ] Explain why streaming keeps memory flat regardless of file size
- [ ] Enforce a file size limit that stops an oversized upload early, not after the fact
- [ ] Validate a file's real content type using magic bytes, not its name or header
- [ ] Explain where and why virus scanning fits into the upload pipeline

---

# 16.2 Object Storage and Presigned URLs

**Goal:** Understand why files do not belong on your application server, and how to move them directly between the client and storage, safely and efficiently.

**Topics in this section:** object storage → presigned URLs → multipart object upload (for large files) → private vs public files (introduced here, expanded in 16.4).

---

## 16.2.1 Object Storage

1. **Definition** — **Object storage** is a storage system (like Amazon S3, Google Cloud Storage, Cloudflare R2, or the self-hosted MinIO) that stores files as **objects**, each identified by a **key** (a path-like string) inside a **bucket** (a top-level container), accessed over HTTP, without a traditional folder-and-permissions filesystem underneath.
2. **Simple meaning** — Think of your application server's disk as a **small personal drawer** — convenient, but limited, and it empties out when you move desks (when a container restarts). Object storage is a **massive, professional warehouse** built only for storing and retrieving boxes (files) by their label (key). It does not run your application code; it only stores and serves objects.
3. **Why it is needed** — Application servers, especially in modern deployments (containers, auto-scaling groups), are often **stateless and ephemeral** — their local disk can vanish on restart or redeploy, and it is not shared between multiple server instances. Files need a home that: (a) survives server restarts, (b) is reachable from every server instance, (c) scales to huge sizes and huge numbers of files, and (d) can serve files directly to users without your application acting as a slow middleman for every byte.
4. **How it works internally** — Every object is addressed by `bucket + key`, for example bucket `my-app-uploads`, key `users/42/avatar/original.jpg`. There are no real "folders" — the `/` in a key is just a character; storage consoles simulate folder browsing by grouping keys with a shared prefix. Objects are accessed with simple HTTP verbs under the hood: `PUT` to upload, `GET` to download, `DELETE` to remove. Each bucket has **access policies** controlling who can do what, separate from your application's own database and permission system.
5. **Syntax and API + 6. Small example**

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "us-east-1",
  // For a local MinIO instance instead of real AWS, you would also set:
  // endpoint: "http://localhost:9000",
  // forcePathStyle: true,
});

const BUCKET = "my-app-uploads";

// Upload a buffer or stream directly from the server (small files / internal use)
async function uploadObject(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// A well-designed key includes structure that helps later:
// users/{userId}/uploads/{uploadId}/original.jpg
// users/{userId}/uploads/{uploadId}/thumbnail.jpg
function buildKey(userId: number, uploadId: string, variant: string, ext: string): string {
  return `users/${userId}/uploads/${uploadId}/${variant}${ext}`;
}
```

7. **Real backend usage** — Profile pictures, documents, videos, exported reports, backups — essentially any file your application handles ends up in object storage, not on the application server's own disk.
8. **Edge cases**
   - Object storage is usually **eventually consistent** for some operations in some providers (less true for S3 today, which offers strong read-after-write consistency, but always check your provider's guarantees).
   - There is no atomic "rename" — a rename is really a copy-then-delete, which matters when you plan key structures.
   - Deleting a bucket's contents can be **slow** at scale; plan lifecycle rules (16.4.5) instead of manual bulk deletes where possible.
9. **Common mistakes** — Storing uploaded files on the application server's local disk "to keep it simple," which breaks the moment you run more than one server instance or redeploy. Using a single flat bucket with no key structure, making later cleanup and access control painful. Putting sensitive data in the **key itself** (keys can appear in logs and URLs).
10. **Interview answer** — "Object storage keeps files outside the application server, addressed by a bucket and a key over HTTP, instead of on a local filesystem. I use it because application servers are stateless and disposable in modern deployments — local disk does not survive restarts and is not shared across instances — while object storage is durable, scalable, and can serve files directly to users."
11. **Practice problem** — Set up a local MinIO container. Upload a file with `PutObjectCommand`, list it back, and delete it. Design a key structure for a multi-tenant app where each file belongs to one user and one upload.
12. **Production considerations** — Design your key naming convention **before** you have millions of objects — it is very hard to reorganize later. Separate buckets (or clearly separated key prefixes) for different environments (dev/staging/prod) and for public vs private content.

---

## 16.2.2 Presigned URLs

1. **Definition** — A **presigned URL** is a temporary, single-purpose URL, cryptographically signed by your backend using its storage credentials, that grants **whoever holds it** permission to perform one specific operation (usually upload or download one specific object) for a limited time — without needing the storage system's real credentials themselves.
2. **Simple meaning** — It is a **timed, single-use guest pass**. Reception (your backend) does not hand out the master key to the warehouse (your storage credentials). Instead, it issues a paper pass that says "this bearer may open **exactly this one door**, and **only until 3 PM**." The guest never touches the master key at all.
3. **Why it is needed** — Without presigned URLs, every file byte would have to flow **through** your application server: client → your server → storage (for uploads) and storage → your server → client (for downloads). That wastes your server's bandwidth and memory, and makes it a bottleneck for something it does not need to be involved in. Presigned URLs let the **client talk directly to storage**, while your server keeps full control over **who** gets a URL and **what** they're allowed to do with it.
4. **How it works internally** — Your backend has real credentials for the storage service. When asked, it uses those credentials to sign a request (or just a URL) for one specific action, embedding an expiry timestamp and the exact operation allowed. The storage service itself verifies this signature when the request arrives — your backend is not "in the loop" at request time at all. This is the same idea as a **signed JWT** (Phase 8): anyone can verify the signature is valid without needing to ask the issuer again, but only the issuer could have created it.
5. **Syntax and API + 6. Small example**

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "my-app-uploads";

// 1) Client asks YOUR backend: "I want to upload a file"
// 2) Your backend authenticates the user, validates the request, then:
async function createUploadUrl(userId: number, uploadId: string, contentType: string) {
  const key = `users/${userId}/uploads/${uploadId}/original`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,          // locks the upload to this exact content type
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });   // valid for 5 minutes
  return { url, key };
}

// 3) The CLIENT uploads directly to storage using that URL (pseudocode, runs in the browser):
//    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
//    Your server's bandwidth is not used at all for the file bytes.

// Same idea for downloads of PRIVATE files:
async function createDownloadUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 60 });   // short-lived, just enough to fetch it
}
```

7. **Real backend usage** — Direct-to-storage upload flows for profile pictures, videos, and documents. Serving **private** files (see 16.4.2) to an authorized user without making the whole bucket public.
8. **Edge cases**
   - A presigned URL is valid for **anyone who has it**, until it expires — there is no additional identity check at request time. Treat it like a bearer token: do not log it, do not put it somewhere it could leak (like a GET query string that ends up in server logs or browser history for a download link, though this is a normal and accepted trade-off for short-lived, narrowly-scoped URLs).
   - Keep expiry times **short** — long enough for the realistic upload/download to complete, not a minute longer than necessary.
   - The signed request can lock down more than just the key — you can constrain `ContentType`, `ContentLength` ranges, and more, so a signed upload URL cannot be reused to upload a different kind of file than intended.
9. **Common mistakes** — Generating a presigned URL **before** checking that the requesting user is actually authorized to write to that key. Setting expiry times far longer than needed "just in case." Forgetting that a presigned **upload** URL says nothing about the file's *content* — you still need the validation from 16.1 to run on it (this normally happens in the background processing step, right after upload, since the browser uploaded directly to storage and your server never saw the bytes).
10. **Interview answer** — "A presigned URL is a time-limited, signed URL that lets a client perform one specific storage operation directly, without going through my server and without holding my storage credentials. My backend authenticates and authorizes the user first, then generates the URL. This keeps file bytes off my application server entirely, which is much more scalable for uploads and downloads."
11. **Practice problem** — Build an endpoint `POST /uploads/presign` that checks the user is logged in, generates an upload key scoped to that user, and returns a presigned `PUT` URL good for 5 minutes. Use `curl` or a browser to actually `PUT` a file to that URL.
12. **Production considerations** — Always generate the key **server-side** (never let the client choose it), scoped by user ID, so one user cannot overwrite another user's files. Since the server never sees the bytes of a direct-to-storage upload, content validation (16.1.4) and virus scanning (16.1.5) must happen as an **asynchronous step after upload**, triggered by a storage event or a client confirmation call — not inline during the request.

---

## 16.2.3 Multipart Object Upload (Large Files)

1. **Definition** — **Multipart object upload** (a storage-service feature, not to be confused with the HTTP `multipart/form-data` from 16.1.1) is a way to upload one large object as **several independent parts**, uploaded separately (in parallel, and with retries per part), and then joined together into a single object by a final "complete" call.
2. **Simple meaning** — Instead of mailing one enormous, fragile package (a single giant upload that fails and must fully restart if the connection drops once), you **split it into several smaller boxes**, mail them separately (possibly to several delivery trucks at once), and the warehouse **assembles them back into one item** once every box has arrived.
3. **Why it is needed** — A single HTTP `PUT` for a multi-gigabyte file is fragile: any network hiccup means starting over from byte zero. Multipart object upload lets you retry **only the failed part** (typically a few MB), upload several parts **in parallel** for speed, and know the upload's real progress part by part.
4. **How it works internally** — Three steps: (1) `CreateMultipartUpload` tells storage "I'm about to send this object in parts," returning an `UploadId`. (2) `UploadPart` is called once per chunk (each part, except possibly the last, must meet a minimum size, commonly 5 MB), each returning an `ETag` that identifies that part. (3) `CompleteMultipartUpload` sends the list of part numbers and their `ETag`s, and storage assembles them, in order, into the final object. If anything goes wrong partway through, `AbortMultipartUpload` cancels the whole thing and frees any storage used by uploaded-but-unused parts.
5. **Syntax and API + 6. Small example**

```ts
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";

async function uploadLargeFile(key: string, chunks: Buffer[]) {
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key }));

  const parts: { ETag: string; PartNumber: number }[] = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const partNumber = i + 1;
      const result = await s3.send(new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId,
        PartNumber: partNumber,
        Body: chunks[i],
      }));
      parts.push({ ETag: result.ETag!, PartNumber: partNumber });
    }

    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId,
      MultipartUpload: { Parts: parts },
    }));
  } catch (err) {
    // Always clean up on failure, or storage keeps billing for the orphaned parts
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId }));
    throw err;
  }
}

// In a real direct-from-browser flow, your backend issues a PRESIGNED URL for each
// UploadPart call, so the browser uploads parts directly to storage — your server just
// coordinates CreateMultipartUpload, hands out per-part presigned URLs, and later calls
// CompleteMultipartUpload once the client reports every part's ETag.
```

7. **Real backend usage** — Video uploads, large dataset uploads, backup/export downloads that also support resumable behavior. Most serious "upload a big file" UIs (think a course platform accepting video lessons) use this under the hood.
8. **Edge cases**
   - Uploaded-but-never-completed multipart uploads **still cost storage money** until explicitly aborted or cleaned up by a lifecycle rule (16.4.5) — this is a genuinely common source of unexpected storage bills.
   - Parts (other than the last) must meet the provider's minimum part size — you cannot split into arbitrarily tiny pieces.
   - The client, not just the server, needs real support for retrying an individual failed part — this is exactly what makes true "resumable upload" possible.
9. **Common mistakes** — Using multipart object upload for small files (added complexity for no benefit — a single `PutObject`, or a single presigned `PUT` URL, is simpler and sufficient below a size threshold, commonly configured around 100 MB). Forgetting to call `AbortMultipartUpload` on failure, leaving orphaned, billed storage. Uploading parts sequentially when they could run in parallel for a large speed gain.
10. **Interview answer** — "For large files, I split the upload into parts using the storage service's multipart upload API: create the multipart upload, send each part (optionally in parallel, and each independently retryable), then complete it once every part has succeeded. This makes large uploads resilient to network failures and lets me report real progress, instead of one fragile all-or-nothing request."
11. **Practice problem** — Split a 20 MB file into 5 MB chunks in code, and upload it using the three-step multipart flow above. Then intentionally fail on one part and confirm `AbortMultipartUpload` correctly cleans it up.
12. **Production considerations** — Set a **lifecycle rule** on your bucket to automatically abort incomplete multipart uploads after a set number of days (this is a standard, built-in storage feature, and it is cheap insurance against forgotten cleanup).

---

## 16.2 Practice Projects

- **Direct-to-storage upload flow:** an endpoint that authenticates a user, generates a presigned upload URL scoped to that user, and a small script (or browser page) that uploads a real file directly to storage using it — with zero file bytes passing through your application server.
- **Large-file uploader:** split a big file into parts, upload them with the multipart object upload API, and handle a simulated mid-upload failure by aborting cleanly.

**16.2 is done when you can:**
- [ ] Explain why files belong in object storage, not on the application server's disk
- [ ] Explain how a presigned URL lets a client bypass your server for the file bytes, while your server still controls who gets one
- [ ] Explain the three-step multipart object upload flow and why it matters for large files
- [ ] Explain why an aborted or incomplete multipart upload still needs explicit cleanup

---

# 16.3 Media Processing

**Goal:** Turn a raw uploaded file into something your application can actually use — resized images, thumbnails, transcoded video — without ever doing this heavy work inside the HTTP request itself.

**Topics in this section:** image resizing → thumbnail generation → metadata extraction → video transcoding concepts → background processing.

> **Reminder from Phase 1.5:** media processing is **CPU-heavy work**. It must never run synchronously inside a request handler on your main API process, or it will block the event loop and every other request behind it. Everything in this section assumes the work happens in a **background job** (Phase 15), triggered after the raw file has safely arrived in storage.

---

## 16.3.1 Image Resizing

1. **Definition** — **Image resizing** is generating one or more new versions of an uploaded image at different dimensions (and often different formats and quality settings), suited to how the image will actually be displayed.
2. **Simple meaning** — A photo lab that takes your **one original negative** and prints it in several standard sizes — wallet size, postcard size, poster size — because nobody needs a poster-sized print just to see a thumbnail in a contact list.
3. **Why it is needed** — Serving a 4000×3000 pixel, 8 MB original photo to display a 40×40 pixel avatar wastes enormous bandwidth and makes pages slow to load, especially on mobile networks. Generating the right sizes **once**, ahead of time, is far cheaper than resizing on every single view.
4. **How it works internally** — A native image-processing library (Sharp, built on the fast `libvips` engine) decodes the image's compressed bytes into raw pixel data, applies a resampling algorithm to compute new pixel values at the target dimensions, then re-encodes the result into the desired output format. This is genuinely CPU- and memory-intensive work — resampling algorithms examine and blend many source pixels per output pixel to avoid a blurry or jagged result.
5. **Syntax and API + 6. Small example**

```ts
import sharp from "sharp";

interface ImageVariant {
  name: string;
  width: number;
  height?: number;              // omit to preserve aspect ratio
}

const VARIANTS: ImageVariant[] = [
  { name: "thumbnail", width: 150, height: 150 },
  { name: "medium", width: 800 },
  { name: "large", width: 1600 },
];

async function generateVariants(inputBuffer: Buffer): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();

  for (const variant of VARIANTS) {
    const output = await sharp(inputBuffer)
      .resize(variant.width, variant.height, {
        fit: variant.height ? "cover" : "inside",   // "cover" crops to fill; "inside" preserves full image
        withoutEnlargement: true,                     // never upscale a small original
      })
      .webp({ quality: 82 })                          // modern format: smaller files, wide browser support
      .toBuffer();

    results.set(variant.name, output);
  }

  return results;
}
```

7. **Real backend usage** — Profile pictures, product photos on an e-commerce site, blog post cover images — anywhere the same source image needs to appear at multiple sizes across an app or website.
8. **Edge cases**
   - Resizing can consume a **lot** of memory for very large source images (a 50-megapixel photo can decode to hundreds of MB of raw pixel data) — always cap the accepted source resolution, not just the file byte size.
   - `fit: "cover"` crops the image to exactly fill the target box (good for square avatars); `fit: "inside"` preserves the whole image, shrinking to fit (good for previews where cropping would lose content).
   - Some image formats (animated GIFs, certain color profiles, images with an embedded orientation flag from a phone camera) need special handling or they render sideways or lose their animation.
9. **Common mistakes** — Resizing on every single page view instead of once at upload time. Not setting `withoutEnlargement`, which can stretch a small image into a blurry large one. Ignoring the EXIF orientation flag, producing sideways thumbnails from photos taken on a phone held vertically.
10. **Interview answer** — "I generate a fixed set of resized variants once, right after upload, in a background job — never on the fly during a request. I use a native library built on `libvips` for speed, cap the accepted source resolution to control memory use, and pick `fit: cover` or `fit: inside` depending on whether cropping to an exact box or preserving the whole image is correct for that variant."
11. **Practice problem** — Generate a 150×150 cropped thumbnail and an 800-pixel-wide preview (aspect ratio preserved) from one source image. Confirmed by inspecting the output files' actual dimensions.
12. **Production considerations** — Decide your fixed variant sizes **deliberately**, based on where they're actually displayed in your product (not "just in case" sizes). Always keep the **original** file too — you cannot regenerate lost detail from a downscaled copy if requirements change later.

---

## 16.3.2 Thumbnail Generation

1. **Definition** — A **thumbnail** is specifically the smallest, fastest-loading preview variant of a file, generated for use in lists, grids, and search results — a specific and very common case of the general resizing idea from 16.3.1, and, for video and some document types, involving a different generation technique entirely.
2. **Simple meaning** — The small preview picture on a video streaming app's home screen, or the little file icon-with-preview you see in a folder view — designed to let you **recognize** the content at a glance, not to be studied closely.
3. **Why it is needed** — A page showing 50 items in a grid should not have to load 50 full-resolution images just to render small previews — that is enormously wasteful of bandwidth and makes the page slow.
4. **How it works internally** — For an **image**, this is resizing (16.3.1) down to a small size, often with more aggressive compression since fine detail is not needed. For a **video**, a thumbnail is usually a single **frame extracted at a specific timestamp** (commonly a few seconds in, to avoid a black opening frame) using a video-processing tool. For a **PDF or document**, it is typically a **rendered image of the first page**.
5. **Syntax and API + 6. Small example**

```ts
import sharp from "sharp";

// Image thumbnail: small, cropped to a square, more compressed
async function generateImageThumbnail(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(200, 200, { fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();
}

// Video thumbnail (conceptual — real implementation uses ffmpeg, see 16.3.3)
// ffmpeg -i input.mp4 -ss 00:00:03 -vframes 1 -vf scale=200:-1 thumbnail.jpg
//
//   -ss 00:00:03   seek to 3 seconds in (skip a likely black/blank opening frame)
//   -vframes 1     extract exactly one frame
//   -vf scale=...  resize that one extracted frame
async function generateVideoThumbnail(inputPath: string, outputPath: string) {
  await runFfmpeg([
    "-i", inputPath,
    "-ss", "00:00:03",
    "-vframes", "1",
    "-vf", "scale=200:-1",
    outputPath,
  ]);
}
```

7. **Real backend usage** — Video platform home pages and search results, document management systems showing file previews, e-commerce product grids, chat apps showing an image preview before it's opened in full.
8. **Edge cases** — A video thumbnail extracted at a fixed timestamp can land on a black frame, a transition, or a blank moment for a very short video — some systems generate a few candidate frames and pick the best, or let a human choose. A PDF's first page might be a mostly-blank cover page, giving a poor preview.
9. **Common mistakes** — Generating a thumbnail from the wrong source — resizing an already-resized "medium" variant repeatedly, compounding quality loss, instead of always resizing from the original. Extracting a video frame at `00:00:00`, which is very often black or a logo card.
10. **Interview answer** — "A thumbnail is the smallest preview variant, generated once and stored alongside the original. For images it's a small, more heavily compressed resize; for video it's a single extracted frame, usually a few seconds in to avoid a blank opening frame; for documents it's typically a rendered image of the first page. I always generate it from the original source, never from an already-processed variant, to avoid compounding quality loss."
11. **Practice problem** — Generate an image thumbnail. If you have `ffmpeg` available, extract a single frame from a short video at the 3-second mark and resize it.
12. **Production considerations** — Always resize/extract from the **original**, stored file, not from a previously generated variant. Cache thumbnails aggressively at the CDN layer (Phase 14) — they are requested extremely often and change essentially never once generated.

---

## 16.3.3 Video Transcoding Concepts

1. **Definition** — **Transcoding** is converting a video from one encoding (**codec**, **resolution**, **bitrate**, or **container format**) into one or more different encodings, so it plays reliably and efficiently across different devices, network conditions, and players.
2. **Simple meaning** — A single master recipe (the original video) gets **translated into several serving sizes**: a small, low-detail version for someone on a slow mobile connection, and a large, high-detail version for someone on fast home wifi with a big screen — the same "meal," prepared and packaged differently depending on who's ordering it, so the app can automatically pick whichever version fits each viewer's connection.
3. **Why it is needed** — An uploaded source video might be in a format a viewer's browser cannot play at all, might be needlessly huge for what most viewers actually need, and gives no way to adapt to a viewer's changing network speed mid-playback. Transcoding into multiple standard "renditions" solves all three.
4. **How it works internally** — **`ffmpeg`** is the standard, near-universal open-source tool for this. It decodes the source video frame by frame and re-encodes it using a target codec (commonly **H.264** for broad compatibility, or the more efficient but newer **H.265**/**AV1**) at chosen resolutions and bitrates. For **adaptive streaming** (where a video player automatically switches quality based on the viewer's connection, mid-playback), the video is split into short segments (a few seconds each) at each rendition, described by a manifest file — this is what **HLS** and **DASH** formats provide.
5. **Syntax and API + 6. Small example**

```ts
// Conceptual ffmpeg commands (run via a child process from a background worker,
// never inline in an HTTP request — a single transcode can take minutes)

// Transcode to a single standard, web-friendly rendition:
// ffmpeg -i input.mov -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k output_720p.mp4
//
//   -c:v libx264     video codec: H.264 (extremely widely supported)
//   -crf 23          quality level (lower = better quality, larger file; 18-28 is a typical range)
//   -preset medium   trade-off between encoding speed and compression efficiency
//   -c:a aac         audio codec: AAC (standard, widely supported)

interface TranscodeJob {
  inputPath: string;
  renditions: { name: string; width: number; bitrate: string }[];
}

async function transcodeVideo(job: TranscodeJob): Promise<Map<string, string>> {
  const outputs = new Map<string, string>();

  for (const rendition of job.renditions) {
    const outputPath = `/tmp/${rendition.name}.mp4`;
    await runFfmpeg([
      "-i", job.inputPath,
      "-vf", `scale=${rendition.width}:-2`,
      "-c:v", "libx264",
      "-b:v", rendition.bitrate,
      "-c:a", "aac",
      outputPath,
    ]);
    outputs.set(rendition.name, outputPath);
  }

  return outputs;
}

// Then each output is uploaded to object storage (16.2), just like an image variant
```

7. **Real backend usage** — Any platform that hosts user- or creator-uploaded video: an online course platform, a social app with video posts, a company's internal training video library.
8. **Edge cases** — Transcoding is by far the **most CPU-intensive** operation in this entire phase — a single video can take many minutes of dedicated CPU time, so this work is often offloaded to a dedicated worker pool, a specialized transcoding queue, or even a managed cloud transcoding service, rather than running on general-purpose application servers at all. Some source formats or codecs are exotic enough that `ffmpeg` needs specific build flags or additional libraries to handle them.
9. **Common mistakes** — Attempting to transcode video synchronously in a request handler, or even in a lightweight background worker meant for quick jobs — this genuinely needs dedicated, isolated compute resources with real CPU limits set. Generating far more renditions than the app actually serves, wasting processing time and storage.
10. **Interview answer** — "Transcoding converts a source video into one or more standard renditions — different codec, resolution, and bitrate — so it plays reliably and adapts to each viewer's device and connection. I run it with `ffmpeg` inside a dedicated background worker, never inline in a request, because a single transcode can take minutes of real CPU time. For adaptive streaming, the output is split into short segments per rendition with a manifest, which is what HLS and DASH provide."
11. **Practice problem** — If `ffmpeg` is available, transcode a short sample video into two renditions (for example, 480p and 720p) and confirm both play correctly. Sketch (no need to fully implement) how you would model an HLS manifest referencing several renditions.
12. **Production considerations** — Set explicit **CPU and memory limits** on transcoding workers so one huge video cannot starve other jobs. Track transcoding job **duration and failure rate** closely — this is usually the slowest and most failure-prone step in the whole upload pipeline, and users notice when it's broken.

---

## 16.3.4 Metadata Extraction

1. **Definition** — **Metadata extraction** is reading structural and descriptive information embedded in a file — dimensions, duration, codec, color profile, camera settings, GPS coordinates, creation date — without necessarily transforming the file's actual content.
2. **Simple meaning** — The **spec sheet stapled to a manufactured product**: length, weight, material, date made — informative facts *about* the item, separate from the item itself.
3. **Why it is needed** — Your application often needs to **know things about a file** before or without displaying it: showing "3:42" next to a video before it loads, validating that an uploaded image meets a minimum resolution requirement, storing when and where a photo was actually taken, or simply knowing a file's dimensions to reserve the correct space in a page layout before the image itself has loaded (avoiding layout shift).
4. **How it works internally** — Most media formats embed metadata in a structured header section, separate from the actual pixel or audio/video data — reading it does **not** require decoding the whole file. Image libraries like Sharp expose this directly; for video, `ffprobe` (which ships alongside `ffmpeg`) reads container and stream metadata quickly, without transcoding anything.
5. **Syntax and API + 6. Small example**

```ts
import sharp from "sharp";

async function extractImageMetadata(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,          // "jpeg", "png", "webp", ...
    hasAlpha: meta.hasAlpha,
    orientation: meta.orientation, // from EXIF — important for correct display rotation
    sizeBytes: meta.size,
  };
}

// ffprobe (ships with ffmpeg) for video metadata — fast, reads headers only, no transcoding
// ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
}

async function extractVideoMetadata(path: string): Promise<VideoMetadata> {
  const raw = await runFfprobe(path);            // returns parsed JSON, shape simplified here
  const videoStream = raw.streams.find((s: any) => s.codec_type === "video");
  const audioStream = raw.streams.find((s: any) => s.codec_type === "audio");
  return {
    durationSeconds: Number(raw.format.duration),
    width: videoStream.width,
    height: videoStream.height,
    videoCodec: videoStream.codec_name,
    audioCodec: audioStream?.codec_name ?? null,
  };
}
```

7. **Real backend usage** — Showing video duration and dimensions in a UI before playback. Enforcing minimum-resolution rules on uploaded photos. Reading and then usually **stripping** GPS/location data from photos before public display, for user privacy (see the edge case below). Sorting a media library by capture date using embedded metadata rather than upload date.
8. **Edge cases** — EXIF metadata in photos can include **precise GPS coordinates** of where the photo was taken — a real privacy concern if a photo is displayed publicly with metadata intact; many platforms deliberately strip this on processing. Metadata can be **missing, malformed, or deliberately spoofed** by the uploader — never treat it as fully trustworthy without sanity-checking (for example, a claimed video duration of 9999 hours should raise suspicion).
9. **Common mistakes** — Trusting embedded metadata as if it were verified fact (a duration or dimension claimed in metadata can, in principle, be malformed or mismatched from the real decoded content). Forgetting to strip sensitive EXIF data (GPS location, device serial numbers) from images before they're made public.
10. **Interview answer** — "Metadata extraction reads a file's embedded header information — dimensions, duration, codec, GPS data for photos — without decoding the full content, which is fast because it only reads the file's structured header section. I use it to display useful info before full processing completes and to validate uploads, but for anything user-facing or public, I also actively strip sensitive metadata like GPS coordinates, and I don't blindly trust extracted values without basic sanity checks."
11. **Practice problem** — Extract width, height, and format from a sample image. Then strip its EXIF data entirely and confirm, by re-extracting, that the metadata is now empty.
12. **Production considerations** — Store useful, sanitized metadata (dimensions, duration) as **structured columns** in your database for fast querying and display, rather than re-reading the file every time. Strip privacy-sensitive metadata (especially GPS) from any image or video before it can be viewed by anyone other than the uploader.

---

## 16.3.5 Background Processing

1. **Definition** — **Background processing**, in this phase, means running every step covered so far in this section — validation beyond the initial check, virus scanning, resizing, thumbnailing, transcoding, metadata extraction — as one or more **asynchronous jobs**, using the job queue and worker concepts from Phase 15, triggered right after a raw file safely lands in storage.
2. **Simple meaning** — Back to the hotel analogy: the guest (the file) checks in at reception (the upload endpoint) and is immediately given a room key (an "upload accepted" response). **Housekeeping** (a background worker) then does the actual cleaning, restocking, and preparation **after** check-in is already complete — the guest is not kept standing at the front desk while all of that happens.
3. **Why it is needed** — Resizing, transcoding, and scanning are all genuinely slow, CPU-heavy operations (16.3.1–16.3.3 and 16.1.5). If any of this ran inside the HTTP request that accepted the upload, the client would sit waiting for minutes, the connection could easily time out, and — critically, per Phase 1.5 — that CPU work would **block the event loop**, freezing every other request on that server process in the meantime.
4. **How it works internally** — This directly reuses Phase 15's job queue pattern: after a file is confirmed to have landed in storage (either the server uploaded it directly, or the client confirmed a direct-to-storage upload completed), the server **enqueues a job** (containing the upload's ID or storage key) and immediately returns a response to the client. One or more separate **worker processes**, running independently from the API servers, pull jobs off the queue and run the actual processing pipeline: validate → scan → extract metadata → resize/transcode → upload results back to storage → update the database status.
5. **Syntax and API + 6. Small example**

```ts
// API server: accepts the upload confirmation, enqueues work, responds immediately
app.post("/uploads/:uploadId/confirm", async (req, res) => {
  const { uploadId } = req.params;

  await markUploadStatus(uploadId, "UPLOADED");     // see 16.4.1 for the full status model
  await processingQueue.add("process-upload", { uploadId });

  res.status(202).json({ uploadId, status: "UPLOADED" });   // 202 Accepted: work is queued, not done yet
});

// Separate worker process: does the actual heavy lifting
processingQueue.process("process-upload", async (job) => {
  const { uploadId } = job.data;

  try {
    await markUploadStatus(uploadId, "PROCESSING");

    const file = await downloadFromStorage(uploadId);
    await validateRealContentType(file);              // 16.1.4, now that we have the actual bytes
    await scanForMalware(file);                        // 16.1.5

    const metadata = await extractMetadata(file);       // 16.3.4
    const variants = await generateVariants(file);      // 16.3.1 / 16.3.2

    for (const [name, buffer] of variants) {
      await uploadObject(buildKey(uploadId, name), buffer);
    }

    await saveMetadataAndVariants(uploadId, metadata, variants.keys());
    await markUploadStatus(uploadId, "COMPLETED");
  } catch (err) {
    await markUploadStatus(uploadId, "FAILED", { reason: String(err) });
    throw err;                                          // let the queue's retry logic (Phase 15) decide next steps
  }
});
```

7. **Real backend usage** — This is the standard shape of essentially every real media pipeline: upload service, courseware platforms, social apps, document management systems. The pattern is always: accept fast, confirm receipt, process asynchronously, notify or let the client poll for completion.
8. **Edge cases** — The client needs a way to **know when processing finishes** — either polling a status endpoint (16.4.1), a webhook/notification, or a real-time channel (WebSocket, Server-Sent Events). A job can fail partway through after already uploading some variants — cleanup and retry logic must account for partial completion, not just full success or full failure. Two workers must never process the **same** upload concurrently (an idempotency concern directly from Phase 15).
9. **Common mistakes** — Doing any of this processing synchronously "just for now" and never circling back to fix it before real users arrive. Forgetting to update the upload's status on **failure**, leaving it stuck showing `PROCESSING` forever from the client's point of view. Not making the job idempotent, so a retried job re-uploads duplicate variants or double-charges a paid transcoding API.
10. **Interview answer** — "The upload endpoint's only job is to accept the file quickly and confirm it landed in storage — it returns immediately with a `202` and enqueues a background job. A separate worker process handles validation, scanning, resizing, and transcoding asynchronously, updating the upload's status as it progresses. This keeps the API responsive and keeps CPU-heavy work off the servers handling live user traffic, using the same queue and retry patterns as any other background job."
11. **Practice problem** — Wire together an upload confirmation endpoint, a queue, and a worker that runs the full pipeline (even with a fake/stubbed validation and resize step) end to end, and confirm the status transitions correctly through `UPLOADED → PROCESSING → COMPLETED`.
12. **Production considerations** — Monitor queue depth and job processing time for the upload-processing queue specifically — a backlog here directly means users staring at a stuck "processing" status. Scale worker count independently from API server count, since their resource needs (CPU-heavy vs. I/O-heavy) are very different.

---

## 16.3 Practice Projects

- **Image variant pipeline:** given an uploaded image, generate thumbnail, medium, and large variants plus extracted metadata, all inside a background job, and upload every result to object storage.
- **End-to-end async pipeline:** connect an upload confirmation endpoint to a real queue and worker, with status tracking, and observe the full lifecycle from `UPLOADED` to `COMPLETED` (and separately, force a failure and confirm it reaches `FAILED` cleanly).

**16.3 is done when you can:**
- [ ] Explain why media processing must never run inline in an HTTP request
- [ ] Generate resized image variants and a thumbnail from one source file
- [ ] Explain, at a concept level, what video transcoding does and why adaptive renditions exist
- [ ] Extract and sanity-check metadata from a file, and explain the EXIF/GPS privacy concern
- [ ] Describe the full background processing pipeline from upload confirmation to completed status

---

# 16.4 Status Tracking, Access Control and Lifecycle

**Goal:** Give every upload a visible, trustworthy status; decide correctly who can access each file; and stop old or unwanted files from living forever.

**Topics in this section:** upload status tracking → access control and private vs public files → retention and deletion.

---

## 16.4.1 Upload Status Tracking

1. **Definition** — **Upload status tracking** means storing a row in your database for every upload, with an explicit **status field** that moves through a small, fixed set of states as the file is received and processed, so both your backend and the client always know exactly where an upload stands.
2. **Simple meaning** — The **parcel tracking number** you get from a courier: `Order Placed → Picked Up → In Transit → Out for Delivery → Delivered` (or `Delivery Failed`). You do not have to guess where your parcel is — the status tells you, at every point.
3. **Why it is needed** — Uploading and processing a file is not instantaneous, and it can **fail** at several distinct points (upload interrupted, virus detected, transcoding crashed). Without an explicit status, your application (and the user) has no reliable way to know whether a file is safe to use yet, still being worked on, or permanently failed and needs to be re-uploaded.
4. **How it works internally** — This is a small **state machine**, exactly like the `OrderStatus` example from Phase 2.3.6 (discriminated unions) and Phase 2's capstone. The roadmap's exact states for this phase are: `UPLOADED` (the raw file safely arrived), `PROCESSING` (a background worker is actively working on it), `COMPLETED` (all processing succeeded; variants are ready to serve), and `FAILED` (something went wrong; the raw file may still exist, but no variants are usable). Every status change should be written to the database **before or immediately as** the corresponding step happens, never inferred after the fact.
5. **Syntax and API + 6. Small example**

```ts
type UploadStatus = "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";

interface Upload {
  id: string;
  userId: number;
  status: UploadStatus;
  originalKey: string;
  variantKeys: Record<string, string>;   // e.g. { thumbnail: "...", medium: "..." }
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Only these transitions are allowed — reject anything else
const ALLOWED_TRANSITIONS: Record<UploadStatus, UploadStatus[]> = {
  UPLOADED: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: [],                          // terminal
  FAILED: ["PROCESSING"],                 // allow a manual retry
};

class InvalidTransitionError extends Error {}

async function transitionUpload(uploadId: string, next: UploadStatus, details?: { reason?: string }) {
  const upload = await getUploadById(uploadId);
  if (!upload) throw new NotFoundError("Upload", uploadId);

  if (!ALLOWED_TRANSITIONS[upload.status].includes(next)) {
    throw new InvalidTransitionError(`Cannot go from ${upload.status} to ${next}`);
  }

  await updateUpload(uploadId, {
    status: next,
    failureReason: next === "FAILED" ? (details?.reason ?? "Unknown error") : null,
    updatedAt: new Date(),
  });
}

// Client polls this endpoint (or receives the same shape over a WebSocket/SSE channel)
app.get("/uploads/:id/status", async (req, res) => {
  const upload = await getUploadById(req.params.id);
  if (!upload) return res.status(404).json({ message: "Not found" });
  res.json({
    id: upload.id,
    status: upload.status,
    failureReason: upload.failureReason,
    variants: upload.status === "COMPLETED" ? upload.variantKeys : undefined,
  });
});
```

7. **Real backend usage** — Every upload-and-process pipeline needs this: a video platform showing "Processing your video..." with a spinner, a document tool showing "Scanning for viruses...", a photo app that greys out an avatar until it's ready.
8. **Edge cases** — A job can **crash** without ever reaching a `catch` block that sets `FAILED` (a worker process killed mid-job, an out-of-memory crash) — a periodic sweep that finds uploads stuck in `PROCESSING` past a reasonable timeout, and marks them `FAILED`, is essential (this connects directly to the visibility timeout / dead-letter concepts from Phase 15). Retrying from `FAILED` back to `PROCESSING` needs the same idempotency care as any retried job.
9. **Common mistakes** — Inferring status from "does the file exist in storage" instead of an explicit database field — fragile and slow to query at scale. No timeout/sweep for stuck `PROCESSING` rows, so a crashed job leaves users staring at a permanent spinner. Allowing an invalid transition (like jumping straight from `UPLOADED` to `COMPLETED`, skipping processing) because nothing enforces the state machine.
10. **Interview answer** — "I model upload status as an explicit state machine — `UPLOADED`, `PROCESSING`, `COMPLETED`, `FAILED` — stored as a column, with only specific transitions allowed, the same pattern as an order status. I also run a periodic sweep for uploads stuck in `PROCESSING` past a timeout, because a crashed worker can leave a job in that state forever otherwise, and I make sure that gets marked `FAILED` so the client isn't stuck waiting indefinitely."
11. **Practice problem** — Implement the transition function and its allow-list above with real tests: a valid transition succeeds, an invalid one throws, and a `FAILED` upload can be retried back to `PROCESSING`. Then write the "stuck upload sweep" query.
12. **Production considerations** — Expose status changes to the client in near-real-time (polling with a reasonable interval, or push via WebSocket/SSE) rather than making them refresh a page. Alert on an abnormally high `FAILED` rate — it is often the first sign that a scanning or transcoding dependency is broken.

---

## 16.4.2 Access Control: Private vs Public Files

1. **Definition** — **Access control** for files means deciding, for every object in storage, **who is allowed to read it** — and enforcing that decision consistently, not just hoping nobody guesses the URL. A **public** file is intentionally readable by anyone with its URL. A **private** file requires proof of authorization (via your application) for every access.
2. **Simple meaning** — A **public** file is a poster taped to a shop window — anyone walking past can see it, no questions asked. A **private** file is a document in a locked filing cabinet — you must show your ID to reception (authenticate with your app) and reception must confirm you're allowed to see **this specific document** (authorize) before they unlock the cabinet and hand you a copy for a moment.
3. **Why it is needed** — Files often carry different sensitivity: a public product photo should load instantly for anyone via a CDN, with no authentication overhead, but a user's private tax document, medical scan, or personal photo must never be reachable by a guessed or leaked URL alone.
4. **How it works internally** — There are really only two safe patterns:
   - **Public**: the bucket (or specific key prefix) has a storage-level policy that allows anonymous `GET` requests. Anyone with the URL can fetch it directly, typically through a CDN in front of storage for speed.
   - **Private**: the bucket denies all direct anonymous access. Every read must go through your **application**, which checks the requester's identity and permissions, and then either (a) streams the file's bytes back through your server, or — far more efficiently — (b) issues a short-lived **presigned download URL** (16.2.2) scoped to exactly that one file, which the client then uses directly.

   The key mistake to avoid: there is **no safe middle ground** of "technically private, but I'll just not link to it publicly" (**security by obscurity**) — a leaked, logged, or guessed URL defeats that instantly, since anyone with the URL can access it with no further check.
5. **Syntax and API + 6. Small example**

```ts
// Public: served directly, ideally through a CDN — no application involvement per request
// https://cdn.myapp.com/public/products/42/main.jpg

// Private: EVERY access goes through an authorization check first
app.get("/uploads/:id/download", requireAuth, async (req, res) => {
  const upload = await getUploadById(req.params.id);
  if (!upload) return res.status(404).json({ message: "Not found" });

  // The actual authorization decision — this is the part that must never be skipped
  const canAccess =
    upload.userId === req.user.id ||                 // owner
    (await userHasSharedAccess(req.user.id, upload.id)); // or explicitly shared with them

  if (!canAccess) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const url = await createDownloadUrl(upload.originalKey);   // presigned, short-lived (16.2.2)
  res.json({ url, expiresIn: 60 });
});

// Bucket policy sketch: private buckets should deny public access entirely at the storage
// layer too — defense in depth — so a bug in application logic cannot expose everything.
```

7. **Real backend usage** — Public: product images, public blog media, marketing assets. Private: user documents, private messages' attachments, anything behind a paywall or a "shared with specific people" feature, internal company files.
8. **Edge cases** — A file's sensitivity can **change over time** — a document shared privately today might be intentionally made public later (or vice versa); your key structure and access logic need to handle a status that can change, not assume it's fixed forever. **CDN caching** of a private file, if misconfigured, can accidentally make it effectively public by caching a response at an edge node without repeating the authorization check for the next viewer.
9. **Common mistakes** — Making a bucket fully public "just for now" and forgetting private files were ever added to it later. Checking authorization only for the **first** access and then handing out a long-lived or non-expiring URL that anyone can reuse forever. Relying purely on an unguessable random key as the only protection ("security by obscurity") for something that is genuinely sensitive.
10. **Interview answer** — "I split files into public and private at the storage-policy level, not just by convention. Public files are served directly, usually through a CDN, with no per-request check needed. For private files, every single access goes through my application first, which authenticates the user and authorizes that specific access, and only then issues a short-lived presigned URL scoped to that one file. I never rely on an unguessable URL alone as protection — that's not real access control."
11. **Practice problem** — Build the private download endpoint above, including the ownership check, and confirm a second, non-owner user correctly receives a `403`. Then try (and fail) to fetch the private object's storage URL directly, without going through your endpoint.
12. **Production considerations** — Set the storage-level bucket policy to **deny public access by default**, and explicitly allow it only for the specific prefix that truly should be public — this way, a bug in your application code cannot accidentally expose private files (defense in depth). Regularly audit which buckets/prefixes actually are public and confirm that's intentional.

---

## 16.4.3 Retention and Deletion

1. **Definition** — **Retention** is how long a file is kept before it is automatically or intentionally removed. **Deletion** is the actual removal — which can be a **soft delete** (marked as deleted in your database, but the object still physically exists in storage for a grace period) or a **hard delete** (the object is permanently and irreversibly removed from storage).
2. **Simple meaning** — A **soft delete** is moving a document to the recycle bin — it is out of the way and out of normal view, but you (or a compliance team) can still recover it for a while. A **hard delete** is emptying the recycle bin for good — there is no going back.
3. **Why it is needed** — Storage is not free, and keeping every file forever, including ones a user explicitly deleted or ones tied to a cancelled account, costs real money at scale and can even create legal or compliance risk (some regulations require deletion within a specific window once requested). At the same time, **immediately, permanently** deleting on a single user action is dangerous — a user's accidental click, or a bug in your own code, should not be unrecoverable.
4. **How it works internally**
   - A **soft delete** is a database-level status change (`deletedAt: Date | null`, or reusing the status field with a `DELETED` value) — the object stays in storage, but your application's normal queries and access checks now treat it as gone.
   - After a defined grace period (a common choice is 30 days), a scheduled background job performs the **hard delete**, actually calling `DeleteObjectCommand` against storage.
   - Many object storage providers also support **lifecycle rules** configured directly on the bucket — for example, "automatically delete anything under this prefix 90 days after creation," or "automatically abort incomplete multipart uploads after 7 days" (16.2.3) — enforced by the storage service itself, with no application code needed at all.
5. **Syntax and API + 6. Small example**

```ts
// Step 1: user-facing delete is a SOFT delete
app.delete("/uploads/:id", requireAuth, async (req, res) => {
  const upload = await getUploadById(req.params.id);
  if (!upload || upload.userId !== req.user.id) {
    return res.status(404).json({ message: "Not found" });
  }
  await updateUpload(upload.id, { deletedAt: new Date() });
  res.status(204).send();
});

// Every normal read query must now exclude soft-deleted rows
async function getActiveUploadById(id: string) {
  return db.uploads.findFirst({ where: { id, deletedAt: null } });
}

// Step 2: a scheduled background job (Phase 15) performs the HARD delete after a grace period
async function purgeExpiredSoftDeletes() {
  const GRACE_PERIOD_DAYS = 30;
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const toPurge = await db.uploads.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });

  for (const upload of toPurge) {
    await deleteObject(upload.originalKey);
    for (const key of Object.values(upload.variantKeys)) {
      await deleteObject(key);
    }
    await db.uploads.delete({ where: { id: upload.id } });   // now a real, permanent hard delete
  }
}

// Step 3 (storage-level, configured once, needs no application code):
// A bucket lifecycle rule: "expire objects under uploads/tmp/ after 1 day"
// (useful for cleaning up incomplete or abandoned direct uploads automatically)
```

7. **Real backend usage** — "Delete my account" flows, a user removing a document or photo, cleaning up abandoned/incomplete uploads that were never confirmed, complying with a data-deletion request under privacy regulations.
8. **Edge cases** — Deleting a file that other records still **reference** (an image used in three different posts) needs a clear decision: cascade the delete, block it, or just break the reference gracefully — this is a real design decision, not an afterthought. Regulatory deletion requests sometimes have a **maximum allowed time window** (for example, a legal requirement to fully purge within 30 days of a verified request) — the grace period and purge job must be tuned to actually satisfy that.
9. **Common mistakes** — Hard-deleting immediately on a single user click, with zero recovery window, then having no good answer when a user (or your own team) makes a mistake. Soft-deleting in the database but **forgetting to actually run the hard-delete job**, silently accumulating storage costs and unpurged sensitive data forever. Not excluding soft-deleted rows from normal application queries, so "deleted" files still show up in lists.
10. **Interview answer** — "User-facing deletes are soft deletes — I set a `deletedAt` timestamp, and every normal query filters those out, so it's instantly gone from the user's point of view but still recoverable. A scheduled background job then performs the real, permanent deletion from storage and the database after a grace period, commonly around 30 days. For fully automatic cleanup — like abandoned, never-confirmed uploads — I also use the storage provider's own lifecycle rules, so it happens even if my application code has a bug."
11. **Practice problem** — Implement soft delete (with the query filter) and the grace-period purge job above. Test that a soft-deleted upload disappears from a normal "my uploads" list immediately, but is only actually removed from storage after the purge job runs.
12. **Production considerations** — Document your retention policy clearly (how long is "deleted but recoverable," how long until permanent removal) — this is often a real legal/compliance requirement, not just an engineering preference. Monitor total storage growth over time; a missing or broken purge job is a very common, very quiet source of a slowly growing storage bill.

---

## 16.4 Practice Projects

- **Full status + access control API:** upload creation, status polling, a private download endpoint with a real ownership check, and a public-file path served without any per-request check.
- **Soft-delete-then-purge pipeline:** a delete endpoint that soft-deletes, a query layer that correctly excludes soft-deleted rows everywhere, and a scheduled job that hard-deletes anything past its grace period.

**16.4 is done when you can:**
- [ ] Design and enforce an upload status state machine, including handling a stuck/crashed job
- [ ] Explain the difference between public and private file access, and why "unguessable URL" is not real access control
- [ ] Implement a private download endpoint with a genuine per-request authorization check
- [ ] Explain the difference between soft delete and hard delete, and why both matter
- [ ] Explain what a storage lifecycle rule is and give one real use for it

---

# Phase 16 Capstone Project — Secure Media Upload Service

**Goal:** Combine everything from Phase 16 into one working service, exactly matching the roadmap's practice list: build secure file upload, upload directly to object storage, create a processing job, and track `UPLOADED`, `PROCESSING`, `COMPLETED`, and `FAILED`.

**What you build:** an image upload service for a fictional app (reuse your Phase 15 queue setup, and your Phase 2 typed error/config patterns).

### Requirements

1. **Presign endpoint:** `POST /uploads` — authenticated user requests a presigned upload URL for an image, scoped to their own user ID, with content type locked to an allow-list (`image/jpeg`, `image/png`, `image/webp`). Creates an `UPLOADED`-pending database row.
2. **Direct-to-storage upload:** the client uploads the file bytes straight to storage using the presigned URL — your server's bandwidth is not used.
3. **Confirmation endpoint:** `POST /uploads/:id/confirm` — client tells your server the upload finished. Server marks the row `UPLOADED` and enqueues a processing job. Returns `202`.
4. **Background worker:**
   - Downloads the raw file from storage.
   - Validates the **real** content type against the allow-list (magic bytes, not the client's original claim).
   - (Optional, if you have a scanner available) runs a malware scan.
   - Extracts metadata (dimensions, format).
   - Generates `thumbnail` (200×200, cropped) and `medium` (800px wide, preserved aspect ratio) variants.
   - Uploads every variant to storage under a clear key structure.
   - Transitions status: `UPLOADED → PROCESSING → COMPLETED`, or `→ FAILED` with a reason on any error.
5. **Status endpoint:** `GET /uploads/:id/status` — returns current status, and variant URLs (presigned, short-lived) once `COMPLETED`.
6. **Access control:** only the uploading user (or someone with explicit shared access) can view a private upload's status or get a download URL. Enforce this with a real per-request check, not an unguessable ID alone.
7. **Stuck-job sweep:** a scheduled job that finds uploads stuck in `PROCESSING` past a timeout (say, 10 minutes) and marks them `FAILED`.
8. **Soft delete:** `DELETE /uploads/:id` — soft-deletes (excluded from all normal queries immediately); a separate purge job hard-deletes from storage after a grace period.
9. **Tests:** cover the state machine's allowed/rejected transitions, the access-control check (owner vs. non-owner), and the worker pipeline (mock the actual image processing if needed, but test the status transitions and error handling for real).

### Where each Phase 16 idea is used

| Phase 16 idea | Where you use it |
|----------------|-------------------|
| Multipart / streaming | Read closely, but bypassed here in favor of direct-to-storage (still write the streaming version as a stretch goal) |
| File size limits, MIME validation | Enforced both at presign time (allow-list) and again for real in the worker (magic bytes) |
| Presigned URLs | Upload URL and every private download URL |
| Object storage keys | `users/{userId}/uploads/{uploadId}/{variant}` |
| Image resizing, thumbnails, metadata | The core of the worker pipeline |
| Background processing (+ Phase 15) | The whole confirm → enqueue → worker flow |
| Status tracking / state machine | `UPLOADED / PROCESSING / COMPLETED / FAILED`, with an allow-list of transitions |
| Access control | Per-request ownership check on the status/download endpoints |
| Retention and deletion | Soft delete + scheduled hard-delete purge job |

### Milestones

- **Day 1–2:** presign endpoint, storage setup (real S3 or local MinIO), key structure, upload confirmation endpoint, and the status state machine with tests.
- **Day 3:** worker: real content validation, metadata extraction, image variant generation.
- **Day 4:** wire the worker into your Phase 15 queue; full status transitions working end to end.
- **Day 5:** access control on the status/download endpoints; stuck-job sweep.
- **Day 6:** soft delete + purge job.
- **Day 7:** tests, cleanup, and a short README explaining every design choice **in simple English**.

### Done when

- [ ] A real image can be uploaded directly to storage, processed, and its variants retrieved, end to end
- [ ] An upload with a renamed/mismatched extension is rejected by the worker's real content check, even though it passed the presign-time allow-list on extension alone
- [ ] A non-owner gets `403` trying to view another user's private upload status or download URL
- [ ] Killing the worker mid-job (simulated) results in the upload eventually reaching `FAILED` via the stuck-job sweep, not staying `PROCESSING` forever
- [ ] A soft-deleted upload disappears from normal queries immediately, and is actually removed from storage only after the purge job runs
- [ ] You can explain the design to another developer out loud in 5 minutes

---

# Phase 16 Interview Question Bank

Practice these **out loud, in simple English**, in 60–90 seconds each. Use one analogy and one code example.

### Accepting uploads (16.1)
1. What is `multipart/form-data`, and how does a streaming parser read it?
2. Why does streaming an upload matter for memory usage, and how does backpressure fit in?
3. Why is `Content-Length` not enough to enforce a file size limit?
4. Why can't you trust a file's extension or `Content-Type` header? How do you check the real type?
5. Where does virus scanning fit in the pipeline, and why not run it inline in the request?

### Object storage (16.2)
6. Why shouldn't uploaded files live on the application server's local disk?
7. What is a presigned URL, and what problem does it solve?
8. Walk through the three-step multipart object upload flow for a large file.
9. What happens if a multipart object upload is never completed or aborted?

### Media processing (16.3)
10. Why must image resizing and video transcoding run in a background job, never inline?
11. What's the difference between `fit: cover` and `fit: inside` when resizing?
12. How is a video thumbnail generated, and why avoid timestamp zero?
13. What is transcoding, and why does a platform generate multiple renditions of the same video?
14. What privacy concern exists with image metadata, and what do you do about it?

### Status, access, lifecycle (16.4)
15. Design the upload status state machine. What happens if a worker crashes mid-job?
16. What's the difference between a public and a private file, and how do you serve each safely?
17. Why is an unguessable URL not real access control?
18. Soft delete vs hard delete: why do you need both?
19. What is a storage lifecycle rule, and give a real example of using one.

### Scenario questions

20. A user uploads a 2 GB video from a flaky mobile connection. Walk through the full flow you'd design, from the client's first request to the video being watchable.
21. Your team notices the storage bill quietly growing every month with no matching growth in active users. What are the first three things you'd check?
22. A support ticket says "my profile picture has been stuck on 'Processing' for two days." Walk through how you'd debug it, and how your system should have already caught this on its own.

---

# Weekly Study Method for Phase 16

| Day | Focus | What to do in Phase 16 |
|-----|-------|--------------------------|
| **Monday — Learn** | Definition, internals, examples | Read the topic. Draw the analogy. |
| **Tuesday — Code** | Write without copying | Type every example. Run it against a local MinIO or a real test bucket. |
| **Wednesday — Backend usage** | Use it in a project | Apply the topic to your capstone (presign, worker, status). |
| **Thursday — Break it on purpose** | Adversarial testing | Try to defeat your own upload endpoint: oversized file, renamed extension, mid-upload disconnect, unauthorized access attempt. |
| **Friday — Interview practice** | Answer out loud in simple English | Pick 5 questions from the bank. 60–90 seconds each. |
| **Saturday — Project work** | One meaningful feature | Implement one capstone feature. |
| **Sunday — Revision** | Review and record | Re-do 2 exercises from memory. Add entries to `mistakes.md`. |

---

# Top 10 File Upload and Media Processing Mistakes (Quick Review)

| # | Mistake | Better habit |
|---|---------|---------------|
| 1 | Buffering the whole file in memory before processing | Stream it, chunk by chunk, ideally straight to storage |
| 2 | Trusting the client's filename or `Content-Type` | Check the real content (magic bytes) against an allow-list |
| 3 | Only checking `Content-Length`, not enforcing during the read | Cap size at the reverse proxy **and** the streaming parser |
| 4 | Storing uploaded files on the application server's disk | Object storage, reached directly via presigned URLs |
| 5 | Resizing/transcoding synchronously in the request | A background job/worker, queued after upload confirmation |
| 6 | Relying on an unguessable URL for a private file | Real per-request authentication and authorization |
| 7 | Long-lived or non-expiring presigned URLs | Short expiry, scoped to exactly the needed action |
| 8 | No timeout for stuck `PROCESSING` uploads | A scheduled sweep that fails them out after a reasonable window |
| 9 | Hard-deleting immediately on a user click | Soft delete first, hard delete after a grace period |
| 10 | Leaving incomplete multipart uploads and orphaned parts forever | A storage lifecycle rule to auto-abort/expire them |

---

# Phase 16 Exit Checklist

You are ready for **Phase 17 — Distributed Systems** when you can do **all** of these without looking at notes:

**Concepts**
- [ ] Explain multipart form encoding and why a streaming parser matters for memory
- [ ] Explain why file content must be validated by its real bytes, not its name or header
- [ ] Explain why object storage, not the application server's disk, is the right home for files
- [ ] Explain presigned URLs and the three-step multipart object upload flow
- [ ] Explain why media processing belongs in a background job, never inline in a request
- [ ] Explain the upload status state machine and what happens when a worker crashes
- [ ] Explain public vs private file access, and why an unguessable URL is not access control
- [ ] Explain soft delete vs hard delete and where storage lifecycle rules fit in

**Skills**
- [ ] Build a streaming upload endpoint with real size limits and content validation
- [ ] Generate a presigned upload URL and a presigned download URL
- [ ] Generate image variants (thumbnail + at least one resize) and extract metadata
- [ ] Wire an upload confirmation into a background queue/worker with status transitions
- [ ] Write a per-request access-control check for a private file
- [ ] Implement soft delete with a correct query filter, plus a grace-period purge job

**Proof of work**
- [ ] Secure upload endpoint from 16.1, tested against deliberately bad input
- [ ] Direct-to-storage presigned upload flow from 16.2, tested end to end
- [ ] Capstone "Secure Media Upload Service" finished, with tests
- [ ] At least 15 interview questions answered out loud in simple English
- [ ] New entries in your `mistakes.md` file

> **Reminder from the roadmap:** the practice goal for this phase is to build secure file upload, upload directly to object storage, create a processing job, and track `UPLOADED`, `PROCESSING`, `COMPLETED`, and `FAILED` — end to end, not just in theory.

**Next:** Phase 17 — Distributed Systems. The presigned-URL pattern (a signed, verifiable permission that doesn't require a round trip to the issuer) and the background-job pipeline you built here both reappear in distributed-systems form once your app runs across many servers and regions.

---
