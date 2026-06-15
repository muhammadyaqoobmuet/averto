/**
 * (C) Copyright IBM Corp. 2026.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
import type { BatchInference } from "./batch_inference.mjs";
import type { DownloadFileContentParams, GetFileContentParams, ListFilesParams, UploadBatchFileParams, UploadedFile, UploadedFileCollection } from "./types/index.mjs";
import type { Response } from "../base/index.mjs";
/**
 * Class for managing files used in batch inference operations.
 *
 * Provides methods to upload, retrieve, list, download, and manage files associated with batch
 * inference jobs.
 */
export declare class Files {
    client: BatchInference;
    /**
     * Creates an instance of Files.
     *
     * @param {BatchInference} client - The BatchInference client instance.
     */
    constructor(client: BatchInference);
    /**
     * Upload a file for batch inference.
     *
     * Uploads a JSONL file containing batch requests. The file will be used as input for batch
     * inference jobs.
     *
     * @param {UploadBatchFileParams} params - The parameters to send to the service.
     * @param {string | ReadableStream | Blob} params.file - JSONL file containing batch requests.
     * @param {string} [params.projectId] - The project that contains the resource. Either `projectId`
     *   or `spaceId` has to be given.
     * @param {string} [params.spaceId] - The space that contains the resource. Either `spaceId` or
     *   `projectId` has to be given.
     * @param {OutgoingHttpHeaders} [params.headers] - Custom request headers
     * @returns {Promise<Response<UploadedFile>>} A promise that resolves to the response with
     *   uploaded file data
     */
    upload(params: UploadBatchFileParams): Promise<Response<UploadedFile>>;
    /**
     * Retrieve file details or list all files.
     *
     * When called with `fileId`, retrieves details of a specific file. When called without `fileId`,
     * retrieves a list of all files.
     *
     * @param {ListFilesParams | GetFileContentParams} params - The parameters to send to the service.
     * @param {string} [params.fileId] - The ID of the file to retrieve.
     * @param {string} [params.projectId] - The project that contains the resource. Either `projectId`
     *   or `spaceId` has to be given.
     * @param {string} [params.spaceId] - The space that contains the resource. Either `spaceId` or
     *   `projectId` has to be given.
     * @param {string} [params.after] - A cursor for pagination. Use the last file ID from the
     *   previous response to retrieve the next page.
     * @param {number} [params.limit] - Maximum number of files to return. Must be between 1 and
     *   10,000.
     * @param {string} [params.purpose] - Filter files by purpose.
     * @param {string} [params.order] - Order of results. Options are "asc" or "desc".
     * @param {OutgoingHttpHeaders} [params.headers] - Custom request headers
     * @returns {Promise<Response<UploadedFile | UploadedFileCollection>>} A promise that resolves to
     *   either a single file or a collection of files
     */
    getDetails(params: ListFilesParams): Promise<Response<UploadedFileCollection>>;
    getDetails(params: GetFileContentParams): Promise<Response<UploadedFile>>;
    /**
     * Retrieve file content.
     *
     * Retrieves the content of a specific file by its ID.
     *
     * @param {GetFileContentParams} params - The parameters to send to the service.
     * @param {string} params.fileId - The ID of the file to retrieve.
     * @param {string} [params.projectId] - The project that contains the resource. Either `projectId`
     *   or `spaceId` has to be given.
     * @param {string} [params.spaceId] - The space that contains the resource. Either `spaceId` or
     *   `projectId` has to be given.
     * @param {OutgoingHttpHeaders} [params.headers] - Custom request headers
     * @returns {Promise<Response<string>>} A promise that resolves to the response with file content
     */
    getContent(params: GetFileContentParams): Promise<Response<string>>;
    /**
     * Check if a file exists at the specified path.
     *
     * @private
     * @param {string} path - The file path to check.
     * @returns {Promise<boolean>} A promise that resolves to true if the file exists, false otherwise
     */
    private fileExists;
    /**
     * Download file content to local filesystem.
     *
     * Downloads the content of a file and saves it to the local filesystem. The file must be in JSONL
     * format.
     *
     * @param {DownloadFileContentParams} params - The parameters to send to the service.
     * @param {string} params.filename - Name of the file to save. Must end with `.jsonl`.
     * @param {string} [params.path] - Directory path where the file should be saved.
     * @param {string} [params.fileId] - The ID of the file to download.
     * @param {string} [params.projectId] - The project that contains the resource. Either `projectId`
     *   or `spaceId` has to be given.
     * @param {string} [params.spaceId] - The space that contains the resource. Either `spaceId` or
     *   `projectId` has to be given.
     * @param {OutgoingHttpHeaders} [params.headers] - Custom request headers
     * @returns {Promise<string>} A promise that resolves to a success message with the file path
     * @throws {Error} If the file already exists or if the filename doesn't end with `.jsonl`
     */
    download(params: DownloadFileContentParams): Promise<string>;
    /**
     * List all files.
     *
     * Retrieves a list of all files for the specified space or project.
     *
     * @param {ListFilesParams} params - The parameters to send to the service.
     * @param {string} [params.projectId] - The project that contains the resource. Either `projectId`
     *   or `spaceId` has to be given.
     * @param {string} [params.spaceId] - The space that contains the resource. Either `spaceId` or
     *   `projectId` has to be given.
     * @param {string} [params.after] - A cursor for pagination. Use the last file ID from the
     *   previous response to retrieve the next page.
     * @param {number} [params.limit] - Maximum number of files to return. Must be between 1 and
     *   10,000.
     * @param {string} [params.purpose] - Filter files by purpose.
     * @param {string} [params.order] - Order of results. Options are "asc" or "desc".
     * @param {OutgoingHttpHeaders} [params.headers] - Custom request headers
     * @returns {Promise<UploadedFile[]>} A promise that resolves to an array of files
     */
    list(params: ListFilesParams): Promise<UploadedFile[]>;
}
//# sourceMappingURL=files.d.mts.map