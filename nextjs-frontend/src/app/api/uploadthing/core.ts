import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

export const ourFileRouter = {
  knowledgeUploader: f({
    pdf: { maxFileSize: '32MB', maxFileCount: 10 },
    text: { maxFileSize: '8MB', maxFileCount: 10 },
    blob: { maxFileSize: '8MB', maxFileCount: 10 },
  })
    .middleware(async () => ({}))
    .onUploadComplete(async () => {}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
