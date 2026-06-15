import { Worker, Job } from 'bullmq';
import prisma from '../lib/prisma';
import { downloadFile, extractTextFromFile, detectContentType } from '../services/document.service';
import { indexPageContent } from '../services/indexing.service';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const documentWorker = new Worker('document-queue', async (job: Job) => {
    const { chatbotId, fileUrl, fileName, mimeType } = job.data as {
        chatbotId: string;
        fileUrl: string;
        fileName: string;
        mimeType: string;
    };

    try {
        logger.info(`Indexing document for bot ${chatbotId}: ${fileName}`);

        const chatbot = await prisma.chatbot.findUnique({ where: { id: chatbotId } });
        if (!chatbot) throw new Error('Chatbot not found');

        const pageCount = await prisma.crawlPage.count({ where: { chatbotId } });
        if (pageCount >= chatbot.pageLimit) {
            throw new Error(`Page limit reached (${chatbot.pageLimit}). Remove sources or increase the limit.`);
        }

        await prisma.chatbot.update({
            where: { id: chatbotId },
            data: { status: 'indexing' },
        });

        const buffer = await downloadFile(fileUrl);
        const text = await extractTextFromFile(buffer, fileName, mimeType);

        if (!text.trim()) {
            throw new Error('No text content could be extracted from the file');
        }

        const contentType = detectContentType(fileName, mimeType);
        const pageRecord = await prisma.crawlPage.create({
            data: {
                chatbotId,
                url: `upload://${fileName}`,
                title: fileName,
                sourceType: 'upload',
            },
        });

        const indexed = await indexPageContent(
            chatbotId,
            pageRecord.id,
            text,
            contentType === 'markdown'
        );

        const totalPages = await prisma.crawlPage.count({ where: { chatbotId } });

        await prisma.chatbot.update({
            where: { id: chatbotId },
            data: {
                status: 'ready',
                pagesCrawled: totalPages,
            },
        });

        logger.info(`Document indexed: ${fileName} → ${indexed} chunks`);
        return { chunks: indexed, pageId: pageRecord.id };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Document indexing failed';
        logger.error(`Document worker failed for bot ${chatbotId}: ${message}`);
        await prisma.chatbot.update({
            where: { id: chatbotId },
            data: { status: 'ready' },
        }).catch(() => {});
        throw error;
    }
}, {
    connection: { url: REDIS_URL },
    concurrency: 2,
});

documentWorker.on('completed', (job) => {
    logger.info(`Document job ${job?.id} completed`);
});

documentWorker.on('failed', (job, err) => {
    logger.error(`Document job ${job?.id} failed: ${err.message}`);
});
